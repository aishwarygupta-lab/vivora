from pathlib import Path

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_avatars(client: AsyncClient, auth_headers):
    """Test listing avatars endpoint."""
    response = await client.get("/api/v1/avatars/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.fixture
def stub_video_media(monkeypatch):
    """Stub video processing + object storage so no ffmpeg/GPU/S3 is needed."""
    from app.api.v1 import avatars

    async def fake_process_video(inp, out_video, out_poster):
        Path(out_video).write_bytes(b"normalized-mp4-bytes")
        Path(out_poster).write_bytes(b"poster-jpg-bytes")
        thumb = out_poster.replace(".", "_thumb.")
        Path(thumb).write_bytes(b"thumb-jpg-bytes")
        return out_video, out_poster, thumb, {"media_type": "video", "duration": 3.2}

    async def fake_upload(data, key, content_type="application/octet-stream", metadata=None):
        return f"http://test-storage/{key}"

    async def fake_serving_url(key, ttl_seconds=3600):
        return f"http://test-storage/{key}"

    monkeypatch.setattr(avatars.avatar_processor, "process_video", fake_process_video)
    monkeypatch.setattr(avatars.storage_service, "upload_file", fake_upload)
    monkeypatch.setattr(avatars.storage_service, "serving_url", fake_serving_url)


@pytest.mark.asyncio
async def test_upload_video_avatar(client: AsyncClient, stub_video_media, auth_headers):
    """A video upload creates a 'video' avatar with a playable source URL."""
    resp = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("clip.mp4", b"\x00\x00\x00\x18ftypmp42 fake", "video/mp4")},
        data={"name": "Video Me"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    avatar = resp.json()
    assert avatar["status"] == "ready"
    assert avatar["avatar_metadata"]["media_type"] == "video"
    assert avatar["avatar_metadata"]["video_url"].startswith("http")


@pytest.mark.asyncio
async def test_upload_rejects_non_media(client: AsyncClient, auth_headers):
    """Anything that isn't an image or a video is rejected with 400."""
    resp = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("notes.txt", b"just text", "text/plain")},
        data={"name": "Nope"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_avatar_not_found(client: AsyncClient, auth_headers):
    """Test getting a non-existent avatar."""
    response = await client.get("/api/v1/avatars/nonexistent-id", headers=auth_headers)
    assert response.status_code == 404
