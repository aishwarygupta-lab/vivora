<p align="center"><img src="frontend/app/icon.svg" width="88" alt="Vivora"/></p>

<h1 align="center">Vivora</h1>

<p align="center"><em>Bring any face to life in real time — record a clip, clone a voice, and hold a live, lip-synced conversation.</em></p>

<p align="center">
  <a href="https://github.com/sur950/vivora/stargazers"><img src="https://img.shields.io/github/stars/sur950/vivora?style=for-the-badge&color=2dd4bf&labelColor=07110f" alt="Stars"/></a>
  <a href="https://github.com/sur950/vivora/network/members"><img src="https://img.shields.io/github/forks/sur950/vivora?style=for-the-badge&color=10b981&labelColor=07110f" alt="Forks"/></a>
  <a href="https://github.com/sur950/vivora/issues"><img src="https://img.shields.io/github/issues/sur950/vivora?style=for-the-badge&color=34d399&labelColor=07110f" alt="Issues"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2dd4bf?style=for-the-badge&labelColor=07110f" alt="MIT License"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000?logo=next.js&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/React_19-149eca?logo=react&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/Tailwind_v4-38bdf8?logo=tailwindcss&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/shadcn/ui-000?style=flat-square" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/Python_3.11-3776AB?logo=python&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/MuseTalk_V1.5-8b5cf6?style=flat-square" />
  <img src="https://img.shields.io/badge/PostgreSQL_15-336791?logo=postgresql&logoColor=fff&style=flat-square" />
  <img src="https://img.shields.io/badge/Redis_7-DC382D?logo=redis&logoColor=fff&style=flat-square" />
</p>

<p align="center">
  <a href="#the-idea">Idea</a> ·
  <a href="#run-it-in-two-commands">Run it</a> ·
  <a href="#how-a-turn-flows">Pipeline</a> ·
  <a href="#whats-in-the-box">Capabilities</a> ·
  <a href="#configuration">Config</a> ·
  <a href="#running-on-a-gpu-and-on-aws">GPU / AWS</a> ·
  <a href="#the-api">API</a> ·
  <a href="#where-things-live">Layout</a>
</p>

---

## The idea

Vivora is an open, ship-it-yourself platform for **live avatar conversations**. Give it a face — a photo or a short video of yourself — optionally lend it your voice, and start talking. Every reply is spoken aloud in the chosen voice and rendered as a lip-synced clip, streamed back sentence by sentence while the model is still thinking.

Two things set it apart from the usual research demo:

- It behaves like a real conversation. The language model streams tokens, each finished sentence is immediately turned into speech and video, and you can cut it off mid-reply just by talking.
- It's built as a product, not a notebook. Cookie-based auth, saved conversation history, per-user rate limits, Postgres migrations, a pytest suite, and one-command deploys are all part of the box.

You can run the entire stack on a laptop with no cloud account and no API key (Whisper for hearing, a local model via Ollama for thinking, Chatterbox for speaking, MuseTalk for the face). Point it at a GPU when you want the video to arrive in real time.

---

## Run it in two commands

**You'll need** Docker with Compose v2 (the easy path), or — for the manual path — Python 3.11+, Node 18+, FFmpeg, PostgreSQL, and Redis.

```bash
git clone https://github.com/sur950/vivora.git
cd vivora
./start.sh                # builds and starts everything with Docker
```

`start.sh` copies `.env.example` to `.env` on first run and prompts you to drop in an API key. Prefer to run the services directly, without Docker?

```bash
./start.sh --dev          # spins up backend, Celery, and frontend as local processes
```

Either way, the pieces land here:

| Where | Address |
| :-- | :-- |
| Web app | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |
| Task monitor (Flower) | http://localhost:5555 |

Handy while you work: `./start.sh --status` (health check), `./start.sh --logs` (tail Docker logs), `./start.sh --stop` (shut it all down).

### Signing in

A demo account is seeded automatically on first boot, and the login screen shows the credentials so you never have to guess:

```
email:    demo@vivora.app
password: VivoraDemo123!
```

Storage defaults to the local filesystem (`USE_LOCAL_STORAGE=true`), so uploads land in `backend/uploads/` and nothing leaves your machine.

### Turning on real lip-sync

Out of the box the app runs, but the `musetalk` engine needs its model weights before it can animate mouths:

```bash
bash scripts/setup_musetalk.sh    # one-time download
# AVATAR_ENGINE=musetalk is already the default in .env
./start.sh --stop && ./start.sh   # restart to pick up the weights
```

Until then avatars display as a still image. The worker uses a GPU automatically when one is present and falls back to CPU otherwise — CPU works fine for local testing, just slowly.

---

## How a turn flows

A single conversation turn walks through five stages. Nothing waits for the whole reply to finish — as soon as the model produces a complete sentence, that sentence races ahead through speech and video on its own:

```
  ┌─ you speak / type ─┐
  │                    ▼
  │            [1] Whisper  →  transcript
  │                    │
  │                    ▼
  │      [2] Claude / GPT / local LLM  →  streamed tokens
  │                    │
  │            split into sentences
  │        ┌───────────┼───────────┐
  │        ▼           ▼           ▼
  │   "Hi there."  "How are"    "you?"      each sentence, independently:
  │        │           │           │
  │   [3] Chatterbox TTS  →  audio in your cloned voice
  │        │           │           │
  │   [4] MuseTalk lip-sync  →  a short video clip
  │        │           │           │
  └────────┴───────────┴───────────┘
                       ▼
     [5] clips stream over WebSocket and play back in order
```

Because the clips are pipelined, the avatar starts talking before the model has finished writing — and if you interrupt (say something, or hit stop), the in-flight turn is cancelled within milliseconds.

---

## What's in the box

### Avatars — a photo or a video

Upload a clear frontal photo and Vivora lip-syncs the mouth on a still frame. Or hand it motion: **record up to 20 seconds in the browser, or upload a video up to 100 MB**, and the avatar drives real head movement synced to the speech. Vivora keeps the source clip as the driving media and animates it with MuseTalk.

### Real lip-sync, loaded once

The `musetalk` engine runs through a **persistent MuseTalk V1.5 worker** that loads its models a single time and keeps them resident. It reaches for a GPU when available and quietly drops to CPU when not. Set it with `AVATAR_ENGINE=musetalk`; the `simple` engine (static image, no lip-sync) is there for quick debugging.

### The rest of the pipeline

| Icon | Piece | What it does |
| :--: | :-- | :-- |
| ◍ | **Speech-to-text** | Whisper via `faster-whisper` (`large-v3-turbo` by default), decodes browser WebM directly |
| ◈ | **Language models** | Claude (with prompt caching), GPT-4o, or any local model through Ollama / vLLM / LM Studio |
| ◐ | **Voice cloning** | Chatterbox Multilingual — zero-shot from a short sample, 23 languages |
| ◑ | **TTS fallback chain** | chatterbox → edge-tts (free neural voices) → gTTS, so a reply is never silent |
| ◭ | **Streaming turns** | Live LLM tokens plus per-sentence video clips over one WebSocket |
| ◮ | **Barge-in** | Talk or hit stop mid-reply and the current turn yields instantly |

### A UI that's actually nice

The web app is **Next.js (React 19)** styled with **Tailwind CSS v4** and **shadcn/ui** components, wearing a teal→emerald *Aurora* theme with a real, working light/dark mode toggle.

### Grown-up plumbing

Cookie-based JWT auth (the token lives in an httpOnly cookie, out of reach of XSS), saved conversation history you can resume, per-user rate limiting, PostgreSQL with Alembic migrations, Redis + Celery for background work, optional S3/CloudFront storage, Prometheus metrics, optional Sentry and OpenTelemetry, and a pytest suite.

---

## Configuration

Everything is driven by `.env` (start from `.env.example`). The knobs you'll touch most:

```bash
# ── Thinking ──────────────────────────────────────────────────────────
LLM_PROVIDER=anthropic          # anthropic | openai | ollama (local & free)
LLM_MODEL=claude-sonnet-4-6     # or gpt-4o · llama3.1 · qwen2.5 …
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_BASE_URL=                # e.g. http://localhost:11434/v1 for Ollama / vLLM / LM Studio

# ── The face ──────────────────────────────────────────────────────────
AVATAR_ENGINE=musetalk          # musetalk (real lip-sync) | simple (debug, no lip-sync)
AVATAR_RESOLUTION=512
AVATAR_ALLOW_VIDEO=true         # accept video avatars, not just photos
AVATAR_MAX_IMAGE_MB=10
AVATAR_MAX_VIDEO_MB=100         # upload cap for video avatars
AVATAR_MAX_VIDEO_SECONDS=20     # in-browser recording cap + frames used from a clip
MUSETALK_PATH=models/MuseTalk

# ── The voice & ears ──────────────────────────────────────────────────
TTS_PROVIDER=chatterbox         # falls back chatterbox → edge-tts → gtts automatically
WHISPER_MODEL=large-v3-turbo    # tiny | base | small | medium | large-v3 | large-v3-turbo

# ── Storage ───────────────────────────────────────────────────────────
USE_LOCAL_STORAGE=true          # false → AWS S3 (presigned URLs / CloudFront)
S3_BUCKET_NAME=...

# ── Auth (both secrets must be ≥ 32 chars — enforced at boot) ──────────
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_EXPIRATION_HOURS=24
```

---

## Running on a GPU and on AWS

MuseTalk hits roughly **30 FPS at 256×256 on a V100-class GPU** ([paper](https://arxiv.org/abs/2410.10122)); on CPU it's tens of times slower. A GPU is what turns Vivora from "works" into "real time."

### Picking an instance

| Instance | GPU | VRAM | Spot ≈ $/hr | MuseTalk |
| :-- | :-- | :-- | :-- | :-- |
| `g4dn.xlarge` | T4 | 16 GB | ~$0.16 | ~15–20 FPS |
| `g5.xlarge` | A10G | 24 GB | ~$0.30 | **~30 FPS** ✔ |
| `g6.xlarge` | L4 | 24 GB | ~$0.24 | **~30 FPS** ✔ |

A `g5.xlarge` Spot instance (~$72/mo at 8 hrs/day) is the sweet spot.

### The scripted deploy

Launch a `g5.xlarge` on Ubuntu 22.04, SSH in, then:

```bash
# 1 — bootstrap
bash <(curl -fsSL https://raw.githubusercontent.com/sur950/vivora/main/scripts/deploy-aws.sh)

# 2 — add your keys
nano /opt/vivora/.env.prod

# 3 — redeploy with them
bash /opt/vivora/scripts/deploy-aws.sh --update
```

The script installs Docker and nvidia-docker2, confirms the GPU is visible, pulls the ~9 GB of MuseTalk weights, and starts everything with GPU passthrough and float16 (about 2× faster via Tensor Cores).

### Production Compose, by hand

```bash
cp .env.prod.example .env.prod    # fill in your values
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The production overlay adds: a GPU reservation for the backend and Celery worker, automatic float16 on CUDA, a persistent `musetalk_models` volume, image-only runs (no source bind mounts), log rotation, and Flower switched off.

### Confirming the GPU

```bash
docker exec avatar-backend python -c "import torch; \
print('CUDA:', torch.cuda.is_available()); \
print('GPU :', torch.cuda.get_device_name(0))"
# g5.xlarge → CUDA: True / GPU: NVIDIA A10G

docker exec avatar-backend nvidia-smi   # live utilisation
```

### Fully managed (Terraform + ECS)

For RDS + ElastiCache + CloudFront behind ECS:

```bash
cd infrastructure
terraform init
terraform apply -var="environment=production"
bash deploy.sh production
```

---

## The API

**Auth**

```bash
POST /api/v1/users/register    { "email", "username", "password" }
POST /api/v1/users/login       form: username, password   → sets httpOnly cookie + returns token
# protected routes accept the cookie or:  Authorization: Bearer <token>
```

**Avatars** (photo *or* video)

```
POST   /api/v1/avatars/upload        multipart: file (image/video) + name
GET    /api/v1/avatars/              list your avatars
GET    /api/v1/avatars/{id}          fetch one
PUT    /api/v1/avatars/{id}/voice    attach a cloned voice
DELETE /api/v1/avatars/{id}          remove
```

**Sessions & messages**

```
POST   /api/v1/sessions/create       { "avatar_id" }
POST   /api/v1/sessions/{id}/end
GET    /api/v1/messages/session/{id}
```

**Voice cloning**

```bash
curl -X POST http://localhost:8000/api/v1/voices/clone \
  -F "audio=@my_voice.wav" -F "name=My Voice" -F "language=en"
```

**The conversation WebSocket** — `WS /ws/session/{session_id}`

You send:

```json
{ "type": "text",         "text": "Hello!" }
{ "type": "audio",        "audio": "<base64-webm>" }
{ "type": "stop" }                                  // barge-in — cancel the current reply
{ "type": "set_voice",    "voice_id": "<uuid>" }    // ownership-checked
{ "type": "set_language", "language": "es" }
{ "type": "ping" }
```

You receive:

```json
{ "type": "token",             "token": "Hel" }        // live LLM stream
{ "type": "transcription",     "text": "Hello!" }
{ "type": "message",           "content": "Hi!", "role": "assistant" }
{ "type": "video_chunk_start", "total_chunks": -1 }    // -1 → count unknown, still streaming
{ "type": "video_chunk",       "chunk_index": 0, "video_url": "…", "text": "Hi!" }
{ "type": "video_chunk_end",   "sent_chunks": 3 }
{ "type": "status",            "message": "Animating…", "stage": "animation" }
{ "type": "tts_fallback",      "engine": "edge-tts", "voice_cloned": false }
{ "type": "interrupted",       "message": "Previous response interrupted" }
{ "type": "error",             "message": "Something went wrong" }
```

---

## Tech stack

**Frontend** — Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui + Radix primitives · next-themes (light/dark) · Zustand · TanStack Query.

**Backend** — FastAPI (async REST + WebSocket) · SQLAlchemy 2 async on asyncpg · PostgreSQL 15 · Alembic · Redis 7 · Celery.

**AI / ML** — Claude · GPT-4o · local models via Ollama/vLLM/LM Studio · Whisper (`faster-whisper`) · Chatterbox Multilingual (TTS + zero-shot cloning, 23 languages) · edge-tts → gTTS fallback · MuseTalk V1.5 for lip-sync.

---

## Where things live

```
vivora/
├── backend/                       # FastAPI service
│   ├── app/
│   │   ├── api/v1/                # users · avatars · voices · sessions · messages · conversations
│   │   ├── services/              # LLM, TTS, STT, avatar processing, storage
│   │   ├── models/                # SQLAlchemy models
│   │   └── websocket.py           # real-time turn handler + sentence streaming
│   ├── alembic/                   # migrations
│   ├── models/MuseTalk/           # MuseTalk V1.5 lip-sync engine
│   │   └── scripts/musetalk_worker.py   # persistent worker (weights load once)
│   ├── seed_user.py               # seeds the demo login account
│   ├── tests/                     # pytest suite
│   └── Dockerfile                 # CUDA 11.8 base
├── frontend/                      # Next.js 16 + React 19 app
│   ├── app/                       # App Router pages + icon.svg (logo/favicon)
│   ├── components/                # shadcn-based UI (chat, avatar studio, auth, theme toggle)
│   ├── lib/api.ts                 # API client
│   └── store/                     # Zustand state
├── nginx/nginx.conf               # reverse proxy (HTTP + WebSocket)
├── infrastructure/                # Terraform: ECS, RDS, ElastiCache, S3, CloudFront
├── scripts/
│   ├── setup_musetalk.sh          # download MuseTalk weights
│   ├── deploy-aws.sh              # one-command GPU EC2 deploy
│   └── seed_demo.py               # optional demo avatars (+ voices with --with-voices)
├── start.sh                       # the launcher (Docker default · --dev · --stop · --logs · --status)
├── docker-compose.yml             # dev (CPU)
├── docker-compose.prod.yml        # production overlay (GPU)
└── .env.example / .env.prod.example
```

---

## Tests

```bash
cd backend
pytest -v                            # everything
pytest tests/test_health.py          # one module
pytest --cov=app --cov-report=html   # coverage report
```

---

## Common questions

<details>
<summary><strong>Do I need a GPU?</strong></summary>

No. Everything runs on CPU — MuseTalk just takes 30–90 s per sentence there (the `simple` engine is instant but doesn't lip-sync). For real-time video, use a `g5.xlarge` (~$0.30/hr spot) or any NVIDIA card with 16 GB+.
</details>

<details>
<summary><strong>Can I run it with no API key, fully offline?</strong></summary>

Yes. Set `LLM_PROVIDER=ollama`, run <a href="https://ollama.com">Ollama</a> (`ollama run llama3.1`), and the whole loop is local and free: Whisper hears, the local model thinks, Chatterbox speaks, MuseTalk animates.
</details>

<details>
<summary><strong>Photo or video avatar — which should I use?</strong></summary>

A photo lip-syncs a still frame; a short video drives real head motion. Record up to 20 s in the browser or upload a clip up to 100 MB. Use a clear, well-lit frontal face and skip sunglasses or heavy occlusion.
</details>

<details>
<summary><strong>Why is the very first reply slow?</strong></summary>

The persistent MuseTalk worker loads its models on the first request (~60 s on GPU, several minutes on CPU). Every request after that reuses the resident models.
</details>

<details>
<summary><strong>What if the TTS model can't load?</strong></summary>

It degrades gracefully: chatterbox → edge-tts (free neural voices) → gTTS. The UI shows a one-time notice if a cloned voice couldn't be applied.
</details>

---

## Contributing

Pull requests are welcome. Fork, branch, add tests, and open a PR:

```bash
git checkout -b feat/your-idea
# code + tests
git commit -m "feat: your idea"
git push origin feat/your-idea
```

---

## License

Released under the **MIT License** — see [LICENSE](./LICENSE).

<br/>

<p align="center">
  Built by <strong>Suresh Konakanchi</strong> · Suresh Konakanchi<br/>
  <a href="mailto:suresh@geekyants.com">konakanchisuresh950@gmail.com</a>
</p>

<p align="center"><sub>If Vivora is useful to you, a ⭐ on the repo is always appreciated.</sub></p>
