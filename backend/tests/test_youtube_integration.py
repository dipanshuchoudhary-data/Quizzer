import sys
import types

from backend.integrations.youtube import (
    _caption_url_as_json3,
    _json3_to_segments,
    _select_caption_track,
    fetch_transcript,
)


def test_select_caption_track_falls_back_to_any_language():
    track = _select_caption_track(
        [
            {
                "languageCode": "hi",
                "name": {"simpleText": "Hindi (auto-generated)"},
                "kind": "asr",
                "baseUrl": "https://example.test/captions",
            }
        ]
    )

    assert track is not None
    assert track["languageCode"] == "hi"


def test_caption_url_as_json3_replaces_existing_format():
    url = _caption_url_as_json3("https://example.test/api?lang=hi&fmt=srv3")

    assert "lang=hi" in url
    assert "fmt=json3" in url
    assert "fmt=srv3" not in url


def test_json3_to_segments_skips_empty_events():
    segments = _json3_to_segments(
        {
            "events": [
                {"tStartMs": 1200, "dDurationMs": 800, "segs": [{"utf8": "Hello "}, {"utf8": "there"}]},
                {"tStartMs": 2000, "segs": [{"utf8": "\n"}]},
            ]
        }
    )

    assert segments == [{"text": "Hello there", "start": 1.2, "duration": 0.8}]


def test_fetch_transcript_uses_any_available_transcript(monkeypatch):
    class NoTranscriptFound(Exception):
        pass

    class TranscriptsDisabled(Exception):
        pass

    class FakeFetchedTranscript:
        def to_raw_data(self):
            return [{"text": "Namaste", "start": 0.0, "duration": 1.0}]

    class FakeTranscript:
        language_code = "hi"
        is_translatable = False

        def fetch(self):
            return FakeFetchedTranscript()

    class FakeApi:
        def fetch(self, video_id, languages):
            raise NoTranscriptFound(video_id, languages, None)

        def list(self, video_id):
            return [FakeTranscript()]

    fake_module = types.SimpleNamespace(
        YouTubeTranscriptApi=lambda: FakeApi(),
        NoTranscriptFound=NoTranscriptFound,
        TranscriptsDisabled=TranscriptsDisabled,
    )
    monkeypatch.setitem(sys.modules, "youtube_transcript_api", fake_module)

    assert fetch_transcript("abc123xyz00") == [{"text": "Namaste", "start": 0.0, "duration": 1.0}]
