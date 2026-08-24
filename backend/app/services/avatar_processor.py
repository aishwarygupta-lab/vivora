import json
import logging
import subprocess
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


class AvatarProcessor:
    """Process and prepare avatar images for animation"""

    def __init__(self):
        self.resolution = settings.AVATAR_RESOLUTION

    async def process_image(self, image_path: str, output_path: str) -> Tuple[str, dict]:
        """
        Process uploaded avatar image

        Args:
            image_path: Path to input image
            output_path: Path to save processed image

        Returns:
            Tuple of (output_path, metadata)
        """
        try:
            logger.info(f"Processing avatar image: {image_path}")

            # Load image
            image = Image.open(image_path)

            # Convert to RGB
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Get original dimensions
            orig_width, orig_height = image.size

            # Detect face and crop
            face_box = await self._detect_face(np.array(image))

            if face_box:
                x, y, w, h = face_box
                # Add padding
                padding = int(min(w, h) * 0.3)
                x = max(0, x - padding)
                y = max(0, y - padding)
                w = min(orig_width - x, w + 2 * padding)
                h = min(orig_height - y, h + 2 * padding)

                # Crop to face
                image = image.crop((x, y, x + w, y + h))
                logger.info(f"Face detected and cropped: {face_box}")
            else:
                logger.warning("No face detected, using center crop")
                # Center crop
                size = min(orig_width, orig_height)
                left = (orig_width - size) // 2
                top = (orig_height - size) // 2
                image = image.crop((left, top, left + size, top + size))

            # Resize to target resolution
            image = image.resize((self.resolution, self.resolution), Image.Resampling.LANCZOS)

            # Enhance image
            image = await self._enhance_image(image)

            # Save processed image
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path, quality=95)

            # Create thumbnail
            thumbnail_path = output_path.replace(".", "_thumb.")
            thumbnail = image.copy()
            thumbnail.thumbnail((256, 256), Image.Resampling.LANCZOS)
            thumbnail.save(thumbnail_path, quality=85)

            metadata = {
                "original_size": (orig_width, orig_height),
                "processed_size": (self.resolution, self.resolution),
                "face_detected": face_box is not None,
                "thumbnail_path": thumbnail_path,
            }

            logger.info(f"Avatar processed successfully: {output_path}")
            return output_path, metadata

        except Exception as e:
            logger.error(f"Failed to process avatar image: {e}")
            raise

    async def _detect_face(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """Detect face in image using OpenCV"""
        try:
            # Load face cascade
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )

            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

            # Detect faces
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )

            if len(faces) > 0:
                # Return largest face
                return tuple(max(faces, key=lambda f: f[2] * f[3]))

            return None

        except Exception as e:
            logger.warning(f"Face detection error: {e}")
            return None

    async def _enhance_image(self, image: Image.Image) -> Image.Image:
        """Enhance image quality"""
        try:
            from PIL import ImageEnhance

            # Slightly enhance sharpness
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(1.1)

            # Slightly enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.05)

            return image

        except Exception as e:
            logger.warning(f"Image enhancement error: {e}")
            return image

    async def process_video(
        self, input_path: str, out_video_path: str, out_poster_path: str
    ) -> Tuple[str, str, str, dict]:
        """Process an uploaded/recorded avatar video.

        Steps:
          1. Probe duration + dimensions.
          2. Normalise → H.264 mp4: trim to AVATAR_MAX_VIDEO_SECONDS, cap fps and
             width, strip the original audio (we drive it with TTS later).
          3. Grab a representative poster frame → JPEG + thumbnail (used for the
             avatar list, previews, and as an idle-state fallback).

        Returns (out_video_path, out_poster_path, thumbnail_path, metadata).
        """
        logger.info(f"Processing avatar video: {input_path}")
        probe = self._probe(input_path)
        duration = probe.get("duration", 0.0)
        max_sec = settings.AVATAR_MAX_VIDEO_SECONDS

        Path(out_video_path).parent.mkdir(parents=True, exist_ok=True)

        # 2. Normalise / trim / cap resolution, drop audio.
        norm_cmd = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(input_path),
            "-t",
            str(max_sec),
            "-an",
            "-r",
            str(settings.AVATAR_FPS),
            "-vf",
            "scale='min(720,iw)':-2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "20",
            str(out_video_path),
        ]
        res = subprocess.run(norm_cmd, capture_output=True)
        if res.returncode != 0 or not Path(out_video_path).is_file():
            raise RuntimeError(
                f"Failed to process video: {res.stderr.decode(errors='replace')[:500]}"
            )

        # 3. Poster frame — sample ~1s in (or the midpoint of very short clips).
        ts = min(1.0, max(0.0, (duration or 2.0) / 2))
        poster_full = str(Path(out_poster_path).with_suffix(".src.png"))
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{ts:.2f}",
                "-i",
                str(out_video_path),
                "-frames:v",
                "1",
                poster_full,
            ],
            capture_output=True,
        )
        if not Path(poster_full).is_file():
            # Fall back to the very first frame.
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-i",
                    str(out_video_path),
                    "-frames:v",
                    "1",
                    poster_full,
                ],
                capture_output=True,
            )

        image = Image.open(poster_full)
        if image.mode != "RGB":
            image = image.convert("RGB")
        image = await self._enhance_image(image)
        Path(out_poster_path).parent.mkdir(parents=True, exist_ok=True)
        image.save(out_poster_path, quality=95)

        thumbnail_path = out_poster_path.replace(".", "_thumb.")
        thumb = image.copy()
        thumb.thumbnail((256, 256), Image.Resampling.LANCZOS)
        thumb.save(thumbnail_path, quality=85)
        Path(poster_full).unlink(missing_ok=True)

        metadata = {
            "media_type": "video",
            "duration": round(duration, 2),
            "original_size": (probe.get("width"), probe.get("height")),
            "fps": settings.AVATAR_FPS,
            "thumbnail_path": thumbnail_path,
        }
        logger.info(f"Avatar video processed: {out_video_path} (poster {out_poster_path})")
        return out_video_path, out_poster_path, thumbnail_path, metadata

    @staticmethod
    def _probe(path: str) -> dict:
        """Return {'duration', 'width', 'height'} via ffprobe (best-effort)."""
        try:
            out = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=width,height:format=duration",
                    "-of",
                    "json",
                    str(path),
                ],
                capture_output=True,
                check=True,
            ).stdout.decode(errors="replace")
            data = json.loads(out)
            stream = (data.get("streams") or [{}])[0]
            return {
                "duration": float(data.get("format", {}).get("duration", 0.0) or 0.0),
                "width": stream.get("width"),
                "height": stream.get("height"),
            }
        except Exception as e:
            logger.warning(f"ffprobe failed for {path}: {e}")
            return {"duration": 0.0, "width": None, "height": None}

    async def create_thumbnail(
        self, image_path: str, thumbnail_path: str, size: Tuple[int, int] = (256, 256)
    ) -> str:
        """Create thumbnail from image"""
        try:
            image = Image.open(image_path)
            image.thumbnail(size, Image.Resampling.LANCZOS)
            image.save(thumbnail_path, quality=85)
            return thumbnail_path

        except Exception as e:
            logger.error(f"Failed to create thumbnail: {e}")
            raise


# Global instance
avatar_processor = AvatarProcessor()
