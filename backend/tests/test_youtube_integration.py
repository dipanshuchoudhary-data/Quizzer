from backend.integrations.youtube import (
    classify_transcript,
    extract_video_id,
    filter_by_time_range,
)
from backend.lib import getCaptions


def test_extract_video_id_supports_common_youtube_urls():
    assert extract_video_id("https://www.youtube.com/watch?v=abc123XYZ_0") == "abc123XYZ_0"
    assert extract_video_id("https://youtu.be/abc123XYZ_0") == "abc123XYZ_0"
    assert extract_video_id("https://www.youtube.com/shorts/abc123XYZ_0") == "abc123XYZ_0"


def test_classify_transcript_uses_joined_segment_text():
    text, size_class = classify_transcript(
        [
            {"text": "First idea", "start": 0.0, "duration": 1.0},
            {"text": "second idea", "start": 1.0, "duration": 1.0},
        ]
    )

    assert text == "First idea second idea"
    assert size_class == "DIRECT"


def test_filter_by_time_range_keeps_matching_segments():
    text = filter_by_time_range(
        [
            {"text": "too early", "start": 5.0, "duration": 1.0},
            {"text": "keep this", "start": 12.0, "duration": 1.0},
            {"text": "too late", "start": 30.0, "duration": 1.0},
        ],
        10.0,
        20.0,
    )

    assert text == "keep this"


def test_get_captions_returns_supadata_transcript(monkeypatch):
    class FakeTranscript:
        content = "Hello from captions"

    class FakeYouTube:
        def transcript(self, video_id, lang, text):
            assert video_id == "abc123XYZ_0"
            assert lang == "en"
            assert text is True
            return FakeTranscript()

    class FakeSupadata:
        def __init__(self, api_key):
            assert api_key == "test-key"
            self.youtube = FakeYouTube()

    monkeypatch.setenv("SUPADATA_API_KEY", "test-key")
    monkeypatch.setattr(getCaptions, "Supadata", FakeSupadata)
    monkeypatch.setattr(getCaptions, "SupadataError", Exception)
    assert getCaptions.get_captions("abc123XYZ_0") == "Hello from captions"


def test_get_captions_raises_supadata_error(monkeypatch):
    class FakeSupadataError(Exception):
        pass

    class FakeYouTube:
        def transcript(self, video_id, lang, text):
            raise FakeSupadataError("No captions available")

    class FakeSupadata:
        def __init__(self, api_key):
            self.youtube = FakeYouTube()

    monkeypatch.setenv("SUPADATA_API_KEY", "test-key")
    monkeypatch.setattr(getCaptions, "Supadata", FakeSupadata)
    monkeypatch.setattr(getCaptions, "SupadataError", FakeSupadataError)
    try:
        getCaptions.get_captions("abc123XYZ_0")
    except ValueError as exc:
        assert "Could not fetch transcript: No captions available" in str(exc)
    else:
        raise AssertionError("Expected ValueError")
