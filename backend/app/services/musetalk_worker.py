#!/usr/bin/env python
"""
Vivora — persistent MuseTalk V1.5 lip-sync worker.

This process is launched once by ``AvatarAnimator`` (app/services/animator.py).
It loads the MuseTalk models a single time and then serves inference jobs over a
tiny JSON-lines protocol on stdin/stdout, so every avatar reply reuses the
already-loaded weights instead of paying the multi-minute model-load cost again.

Why it lives here (in our repo) instead of inside models/MuseTalk/scripts:
    backend/models/ is gitignored, so anything written into the cloned MuseTalk
    tree disappears on a fresh checkout. Keeping the worker in version control
    fixes the "worker script missing → always falls back to a static photo" bug.
    The animator launches us with cwd = the MuseTalk directory and PYTHONPATH
    pointed at it, so ``import musetalk...`` resolves correctly.

Protocol
--------
1. Parent writes ONE init line (JSON) then reads lines until it sees ``READY``:
       {"unet_model_path": "...", "unet_config": "...", "whisper_dir": "...",
        "vae_type": "sd-vae" | "/abs/.../models/sd-vae", "use_float16": true}
2. For each job the parent writes ONE line (JSON) and reads ONE result line:
       job    -> {"image": "<image OR video path>", "audio": "<wav>",
                  "output": "<out.mp4>", "coord_cache": "<optional pkl>"}
       result -> {"status": "ok", "output": "..."} | {"status": "error", "msg": "..."}

The ``image`` field may be an image (JPG/PNG) OR a video (MP4/WEBM/MOV). A video
avatar cycles through the recorded frames while the mouth is driven by the audio,
which is what makes the result feel like a live person rather than a photo.

IMPORTANT: MuseTalk's library code prints freely to stdout and uses tqdm. To keep
the JSON protocol clean we rebind sys.stdout to stderr for the whole process and
write protocol lines only through the private handle captured below.
"""

# The heavy imports (torch/cv2/musetalk) are intentionally placed *after* we
# capture stdout, so isort's single-block ordering doesn't apply here.
# ruff: noqa: I001

import hashlib
import json
import os
import pickle
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

# ── Capture the *real* stdout for the protocol, then silence everything else ──
_PROTO_OUT = sys.stdout
sys.stdout = sys.stderr  # all library prints / tqdm now go to stderr


def _emit(obj: dict) -> None:
    """Write a single protocol message to the real stdout and flush."""
    _PROTO_OUT.write(json.dumps(obj) + "\n")
    _PROTO_OUT.flush()


def _ready() -> None:
    _PROTO_OUT.write("READY\n")
    _PROTO_OUT.flush()


# ── Heavy imports (torch, cv2, MuseTalk) happen after we own stdout ───────────
import cv2  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from transformers import WhisperModel  # noqa: E402

from musetalk.utils.audio_processor import AudioProcessor  # noqa: E402
from musetalk.utils.blending import (  # noqa: E402
    get_image_blending,
    get_image_prepare_material,
)
from musetalk.utils.face_parsing import FaceParsing  # noqa: E402
from musetalk.utils.preprocessing import get_landmark_and_bbox, read_imgs  # noqa: E402
from musetalk.utils.utils import datagen, load_all_model  # noqa: E402

# MuseTalk V1.5 fixed hyper-parameters (mirrors scripts/realtime_inference.py)
VERSION = "v15"
EXTRA_MARGIN = 10
PARSING_MODE = "jaw"
LEFT_CHEEK_WIDTH = 90
RIGHT_CHEEK_WIDTH = 90
AUDIO_PAD_LEFT = 2
AUDIO_PAD_RIGHT = 2
FPS = 25

# How many seconds of a driving video we actually turn into the cyclic frame
# bank. More frames = more preprocessing + memory for little extra realism, so
# we cap it. Overridable via env for GPU boxes that want richer motion.
MAX_DRIVE_SECONDS = int(os.environ.get("MUSETALK_MAX_DRIVE_SECONDS", "20"))

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}


class MuseTalkEngine:
    """Loads models once; prepares + caches per-avatar material; renders clips."""

    def __init__(self, cfg: dict):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        # float16 only makes sense on a CUDA device with Tensor Cores. On CPU it
        # is both unsupported for many ops and slower, so we stay in float32.
        self.use_fp16 = bool(cfg.get("use_float16", False)) and self.device.type == "cuda"

        vae_type = cfg["vae_type"]
        # load_all_model resolves the VAE as os.path.join("models", vae_type)
        # relative to cwd (the MuseTalk dir), so it wants the *name* not a path.
        if os.path.sep in vae_type or "/" in vae_type:
            vae_type = os.path.basename(vae_type.rstrip("/\\"))

        self.vae, self.unet, self.pe = load_all_model(
            unet_model_path=cfg["unet_model_path"],
            vae_type=vae_type,
            unet_config=cfg["unet_config"],
            device=self.device,
        )
        self.timesteps = torch.tensor([0], device=self.device)

        if self.use_fp16:
            self.pe = self.pe.half().to(self.device)
            self.vae.vae = self.vae.vae.half().to(self.device)
            self.unet.model = self.unet.model.half().to(self.device)
        else:
            self.pe = self.pe.to(self.device)
            self.vae.vae = self.vae.vae.to(self.device)
            self.unet.model = self.unet.model.to(self.device)

        self.weight_dtype = self.unet.model.dtype

        self.audio_processor = AudioProcessor(feature_extractor_path=cfg["whisper_dir"])
        self.whisper = (
            WhisperModel.from_pretrained(cfg["whisper_dir"])
            .to(device=self.device, dtype=self.weight_dtype)
            .eval()
        )
        self.whisper.requires_grad_(False)

        self.fp = FaceParsing(
            left_cheek_width=LEFT_CHEEK_WIDTH,
            right_cheek_width=RIGHT_CHEEK_WIDTH,
        )

        # Smaller batches on CPU keep memory sane; GPUs can chew through more.
        self.batch_size = 20 if self.device.type == "cuda" else 4

        # In-memory cache of prepared avatars: {hash: prepared-dict}
        self._prepared: dict = {}
        # Where prepared material is persisted between restarts.
        self._cache_root = Path("results") / "vivora_prepared"
        self._cache_root.mkdir(parents=True, exist_ok=True)

    # ── driving-media → frames ────────────────────────────────────────────────

    def _load_source_frames(self, src: str, frames_dir: Path) -> list:
        """Extract frames from an image or a video into frames_dir as PNGs.

        Returns the sorted list of frame file paths. Images yield one frame;
        videos yield up to MAX_DRIVE_SECONDS * fps frames.
        """
        frames_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(src).suffix.lower()

        if ext in VIDEO_EXTS:
            cap = cv2.VideoCapture(src)
            src_fps = cap.get(cv2.CAP_PROP_FPS) or FPS
            max_frames = int(MAX_DRIVE_SECONDS * src_fps)
            count = 0
            while count < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                cv2.imwrite(str(frames_dir / f"{count:08d}.png"), frame)
                count += 1
            cap.release()
            if count == 0:
                raise RuntimeError("Could not read any frames from the driving video")
        else:
            frame = cv2.imread(src)
            if frame is None:
                raise RuntimeError(f"Could not read avatar image: {src}")
            cv2.imwrite(str(frames_dir / "00000000.png"), frame)

        return sorted(str(p) for p in frames_dir.glob("*.png"))

    # ── per-avatar preparation (cached) ────────────────────────────────────────

    def _prepare(self, src: str) -> dict:
        key = hashlib.md5(str(Path(src).resolve()).encode()).hexdigest()
        if key in self._prepared:
            return self._prepared[key]

        adir = self._cache_root / key
        frames_dir = adir / "full_imgs"
        masks_dir = adir / "masks"
        coords_pkl = adir / "coords.pkl"
        latents_pt = adir / "latents.pt"
        mask_coords_pkl = adir / "mask_coords.pkl"

        # Reuse a fully-prepared avatar from a previous run/restart.
        if coords_pkl.exists() and latents_pt.exists() and mask_coords_pkl.exists():
            frame_list = read_imgs(sorted(str(p) for p in frames_dir.glob("*.png")))
            mask_list = read_imgs(sorted(str(p) for p in masks_dir.glob("*.png")))
            with open(coords_pkl, "rb") as f:
                coord_list = pickle.load(f)
            with open(mask_coords_pkl, "rb") as f:
                mask_coords_list = pickle.load(f)
            input_latent_list = torch.load(latents_pt, map_location=self.device)
            prepared = {
                "frame_list_cycle": frame_list,
                "coord_list_cycle": coord_list,
                "mask_list_cycle": mask_list,
                "mask_coords_list_cycle": mask_coords_list,
                "input_latent_list_cycle": input_latent_list,
            }
            self._prepared[key] = prepared
            return prepared

        # Fresh preparation.
        for d in (frames_dir, masks_dir):
            if d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True, exist_ok=True)

        img_list = self._load_source_frames(src, frames_dir)
        coord_list, frame_list = get_landmark_and_bbox(img_list, 0)

        input_latent_list = []
        placeholder = (0.0, 0.0, 0.0, 0.0)
        for idx, (bbox, frame) in enumerate(zip(coord_list, frame_list)):
            if bbox == placeholder:
                continue
            x1, y1, x2, y2 = bbox
            y2 = min(y2 + EXTRA_MARGIN, frame.shape[0])  # v15 extra margin
            coord_list[idx] = [x1, y1, x2, y2]
            crop = frame[y1:y2, x1:x2]
            resized = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_LANCZOS4)
            input_latent_list.append(self.vae.get_latents_for_unet(resized))

        if not input_latent_list:
            raise RuntimeError(
                "No face detected in the avatar. Use a clear, front-facing photo or video."
            )

        # Ping-pong the frames so looping the driving clip has no hard cut.
        frame_list_cycle = frame_list + frame_list[::-1]
        coord_list_cycle = coord_list + coord_list[::-1]
        input_latent_list_cycle = input_latent_list + input_latent_list[::-1]

        mask_list_cycle = []
        mask_coords_list_cycle = []
        for i, frame in enumerate(frame_list_cycle):
            cv2.imwrite(str(frames_dir / f"{i:08d}.png"), frame)
            x1, y1, x2, y2 = coord_list_cycle[i]
            mask, crop_box = get_image_prepare_material(
                frame, [x1, y1, x2, y2], fp=self.fp, mode=PARSING_MODE
            )
            cv2.imwrite(str(masks_dir / f"{i:08d}.png"), mask)
            mask_list_cycle.append(mask)
            mask_coords_list_cycle.append(crop_box)

        with open(coords_pkl, "wb") as f:
            pickle.dump(coord_list_cycle, f)
        with open(mask_coords_pkl, "wb") as f:
            pickle.dump(mask_coords_list_cycle, f)
        torch.save(input_latent_list_cycle, latents_pt)

        prepared = {
            "frame_list_cycle": frame_list_cycle,
            "coord_list_cycle": coord_list_cycle,
            "mask_list_cycle": mask_list_cycle,
            "mask_coords_list_cycle": mask_coords_list_cycle,
            "input_latent_list_cycle": input_latent_list_cycle,
        }
        self._prepared[key] = prepared
        return prepared

    # ── inference ───────────────────────────────────────────────────────────

    @torch.no_grad()
    def render(self, src: str, audio_path: str, output_path: str) -> None:
        prep = self._prepare(src)
        frame_cycle = prep["frame_list_cycle"]
        coord_cycle = prep["coord_list_cycle"]
        mask_cycle = prep["mask_list_cycle"]
        mask_coord_cycle = prep["mask_coords_list_cycle"]
        latent_cycle = prep["input_latent_list_cycle"]

        features, librosa_length = self.audio_processor.get_audio_feature(
            audio_path, weight_dtype=self.weight_dtype
        )
        whisper_chunks = self.audio_processor.get_whisper_chunk(
            features,
            self.device,
            self.weight_dtype,
            self.whisper,
            librosa_length,
            fps=FPS,
            audio_padding_length_left=AUDIO_PAD_LEFT,
            audio_padding_length_right=AUDIO_PAD_RIGHT,
        )
        video_num = len(whisper_chunks)

        tmp_dir = Path(tempfile.mkdtemp(prefix="vivora_frames_"))
        try:
            gen = datagen(whisper_chunks, latent_cycle, self.batch_size)
            idx = 0
            for whisper_batch, latent_batch in gen:
                audio_feat = self.pe(whisper_batch.to(self.device))
                latent_batch = latent_batch.to(device=self.device, dtype=self.unet.model.dtype)
                pred = self.unet.model(
                    latent_batch, self.timesteps, encoder_hidden_states=audio_feat
                ).sample
                pred = pred.to(device=self.device, dtype=self.vae.vae.dtype)
                recon = self.vae.decode_latents(pred)
                for res_frame in recon:
                    if idx >= video_num:
                        break
                    bbox = coord_cycle[idx % len(coord_cycle)]
                    ori = frame_cycle[idx % len(frame_cycle)].copy()
                    x1, y1, x2, y2 = bbox
                    try:
                        rf = cv2.resize(res_frame.astype(np.uint8), (x2 - x1, y2 - y1))
                        mask = mask_cycle[idx % len(mask_cycle)]
                        mcb = mask_coord_cycle[idx % len(mask_coord_cycle)]
                        combined = get_image_blending(ori, rf, bbox, mask, mcb)
                    except Exception:
                        # Never leave a gap in the frame sequence (ffmpeg's image2
                        # demuxer stops at the first missing index) — fall back to
                        # the untouched source frame so A/V stays in sync.
                        combined = ori
                    cv2.imwrite(str(tmp_dir / f"{idx:08d}.png"), combined)
                    idx += 1

            if idx == 0:
                raise RuntimeError("MuseTalk produced no frames")

            self._mux(tmp_dir, audio_path, output_path)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @staticmethod
    def _mux(frames_dir: Path, audio_path: str, output_path: str) -> None:
        """Encode PNG frames → H.264 and mux with the audio track."""
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        silent = frames_dir / "_silent.mp4"
        enc = subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-r", str(FPS),
                "-f", "image2",
                "-i", str(frames_dir / "%08d.png"),
                "-vcodec", "libx264",
                "-vf", "format=yuv420p",
                "-crf", "18",
                str(silent),
            ],
            capture_output=True,
        )
        if enc.returncode != 0:
            raise RuntimeError(f"ffmpeg encode failed: {enc.stderr.decode(errors='replace')}")

        mux = subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(audio_path),
                "-i", str(silent),
                "-c:v", "copy",
                "-c:a", "aac",
                "-shortest",
                str(output_path),
            ],
            capture_output=True,
        )
        if mux.returncode != 0:
            raise RuntimeError(f"ffmpeg mux failed: {mux.stderr.decode(errors='replace')}")


def main() -> None:
    # 1) init
    init_line = sys.stdin.readline()
    if not init_line:
        return
    try:
        cfg = json.loads(init_line)
        engine = MuseTalkEngine(cfg)
    except Exception as e:
        _emit({"status": "fatal", "msg": f"init failed: {e}\n{traceback.format_exc()}"})
        return
    _ready()

    # 2) job loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
            engine.render(job["image"], job["audio"], job["output"])
            _emit({"status": "ok", "output": job["output"]})
        except Exception as e:
            _emit({"status": "error", "msg": f"{e}\n{traceback.format_exc()}"})


if __name__ == "__main__":
    main()
