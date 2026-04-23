"""
YouTube integration service for Quizzer.

Handles:
- YouTube URL detection and video ID extraction
- Video metadata fetching (title, duration) via YouTube Data API v3
- Transcript fetching via youtube-transcript-api
- Transcript size classification (DIRECT / LONG / HUGE)
- Time-range filtering (fast mode)
- Full-video chunked summarization (slow mode)
"""

from __future__ import annotations

import asyncio
import re
import logging
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Size thresholds (characters)
# ---------------------------------------------------------------------------
DIRECT_MAX_CHARS = 25_000
LONG_MAX_CHARS = 250_000

# Chunk size for full-video mode (~10 min of typical speech)
CHUNK_SECONDS = 600

# Max chars per LLM prompt call during chunked summarisation
CHUNK_MAX_CHARS = 20_000


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class YouTubeTranscriptError(Exception):
    """Raised when no captions are available for the video."""


class YouTubeAPIError(Exception):
    """Raised when the YouTube Data API call fails."""


class TranscriptTooLargeError(Exception):
    """Raised when even the time-range selection is still over the safe limit."""


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

_YOUTUBE_PATTERNS = [
    # https://www.youtube.com/watch?v=ID
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?.*v=([A-Za-z0-9_-]{11})"),
    # https://youtu.be/ID
    re.compile(r"(?:https?://)?youtu\.be/([A-Za-z0-9_-]{11})"),
    # https://www.youtube.com/shorts/ID
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
    # https://www.youtube.com/embed/ID
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/embed/([A-Za-z0-9_-]{11})"),
]


def extract_video_id(url: str) -> Optional[str]:
    """Return the 11-char YouTube video ID from a URL, or None if not a YouTube URL."""
    for pattern in _YOUTUBE_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def is_youtube_url(url: str) -> bool:
    """Return True if the URL points to a YouTube video."""
    return extract_video_id(url) is not None


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

def _parse_iso8601_duration(iso: str) -> int:
    """Parse an ISO 8601 duration string (e.g. PT1H2M3S) to total seconds."""
    pattern = re.compile(
        r"P(?:(?P<days>\d+)D)?"
        r"(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?"
    )
    match = pattern.fullmatch(iso)
    if not match:
        return 0
    days = int(match.group("days") or 0)
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = int(match.group("seconds") or 0)
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def fetch_video_metadata(video_id: str) -> dict:
    """
    Fetch video title and duration via the YouTube Data API v3.

    Returns:
        {"title": str, "duration_seconds": int}

    Falls back gracefully if the API is not enabled or credentials are missing.
    """
    from backend.core.config import settings

    if not settings.YOUTUBE_API_ENABLED:
        logger.info("youtube_api_disabled", video_id=video_id)
        return {"title": f"YouTube video ({video_id})", "duration_seconds": 0}

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.YOUTUBE_REFRESH_TOKEN,
            client_id=settings.YOUTUBE_CLIENT_ID,
            client_secret=settings.YOUTUBE_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
        )
        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        response = (
            youtube.videos()
            .list(part="snippet,contentDetails", id=video_id)
            .execute()
        )
        items = response.get("items", [])
        if not items:
            return {"title": f"YouTube video ({video_id})", "duration_seconds": 0}

        item = items[0]
        title: str = item.get("snippet", {}).get("title", f"YouTube video ({video_id})")
        iso_duration: str = item.get("contentDetails", {}).get("duration", "PT0S")
        duration_seconds = _parse_iso8601_duration(iso_duration)
        return {"title": title, "duration_seconds": duration_seconds}

    except Exception as exc:
        logger.warning("youtube_metadata_fetch_failed", video_id=video_id, error=str(exc))
        return {"title": f"YouTube video ({video_id})", "duration_seconds": 0}


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

def fetch_transcript(video_id: str) -> list[dict]:
    """
    Fetch transcript segments for a YouTube video.

    Returns:
        List of {"text": str, "start": float, "duration": float}

    Raises:
        YouTubeTranscriptError: when no captions are available.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

        try:
            # Prefer manual English captions, fall back to auto-generated
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            try:
                transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
            except NoTranscriptFound:
                try:
                    transcript = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])
                except NoTranscriptFound:
                    # Take any available transcript as last resort
                    available = list(transcript_list)
                    if not available:
                        raise
                    transcript = available[0]

            return transcript.fetch()

        except (NoTranscriptFound, TranscriptsDisabled) as exc:
            raise YouTubeTranscriptError(
                "No captions found. Please paste the transcript manually."
            ) from exc

    except YouTubeTranscriptError:
        raise
    except Exception as exc:
        raise YouTubeTranscriptError(
            "No captions found. Please paste the transcript manually."
        ) from exc


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_transcript(segments: list[dict]) -> tuple[str, str]:
    """
    Classify a transcript by total character count.

    Returns:
        (full_text, size_class) where size_class is "DIRECT" | "LONG" | "HUGE"
    """
    full_text = " ".join(seg.get("text", "") for seg in segments).strip()
    char_count = len(full_text)

    if char_count < DIRECT_MAX_CHARS:
        size_class = "DIRECT"
    elif char_count < LONG_MAX_CHARS:
        size_class = "LONG"
    else:
        size_class = "HUGE"

    logger.info(
        "transcript_classified",
        chars=char_count,
        size_class=size_class,
    )
    return full_text, size_class


# ---------------------------------------------------------------------------
# Fast mode: time-range filtering
# ---------------------------------------------------------------------------

def filter_by_time_range(
    segments: list[dict], start_sec: float, end_sec: float
) -> str:
    """
    Keep only transcript segments within [start_sec, end_sec).

    Returns:
        Joined text of the selected range.

    Raises:
        TranscriptTooLargeError: if the filtered result still exceeds DIRECT_MAX_CHARS.
    """
    filtered = [
        seg for seg in segments
        if seg.get("start", 0) >= start_sec and seg.get("start", 0) < end_sec
    ]
    if not filtered:
        return ""

    text = " ".join(seg.get("text", "") for seg in filtered).strip()

    if len(text) > DIRECT_MAX_CHARS:
        raise TranscriptTooLargeError(
            f"The selected range contains {len(text):,} characters "
            f"which exceeds our current processing limit of {DIRECT_MAX_CHARS:,} characters. "
            "Please choose a shorter time range."
        )

    return text


# ---------------------------------------------------------------------------
# Slow mode: full-video chunked summarisation
# ---------------------------------------------------------------------------

async def summarize_chunks_full_video(segments: list[dict]) -> str:
    """
    Summarise a long transcript in ~10-minute chunks.

    Each chunk is sent to the LLM with a study-notes prompt.
    Chunk summaries are combined into a final "Video Study Guide."

    Returns:
        Combined study guide as a single string (≤ DIRECT_MAX_CHARS).
    """
    from backend.core.llm import get_llm

    llm = get_llm()

    # Split into chunks by time
    chunks: list[list[dict]] = []
    current_chunk: list[dict] = []
    chunk_start = 0.0

    for seg in segments:
        seg_start = seg.get("start", 0)
        if seg_start - chunk_start >= CHUNK_SECONDS and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            chunk_start = seg_start
        current_chunk.append(seg)
    if current_chunk:
        chunks.append(current_chunk)

    logger.info("youtube_full_video_chunks", total_chunks=len(chunks))

    async def _summarise_one(chunk_index: int, chunk_segs: list[dict]) -> str:
        chunk_text = " ".join(seg.get("text", "") for seg in chunk_segs)
        chunk_text = chunk_text[:CHUNK_MAX_CHARS]  # hard cap per call

        start_time = chunk_segs[0].get("start", 0)
        end_time = chunk_segs[-1].get("start", 0) + chunk_segs[-1].get("duration", 0)
        minutes_start = int(start_time // 60)
        minutes_end = int(end_time // 60)

        prompt = f"""You are a study assistant extracting the most important educational content from a video transcript segment.

Segment: minutes {minutes_start}–{minutes_end} of the video.

Your job is to produce compact but complete study notes covering:
- Key concepts and their definitions
- Important facts, dates, names, or figures
- Formulas, rules, or frameworks mentioned
- Worked examples or case studies (very briefly)
- Any points that would make strong quiz questions

Be concise. Avoid filler phrases. Use bullet points.

TRANSCRIPT SEGMENT:
{chunk_text}

Return only the study notes, no preamble."""

        try:
            response = await llm.ainvoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            return f"### Part {chunk_index + 1} (min {minutes_start}–{minutes_end})\n{content.strip()}"
        except Exception as exc:
            logger.warning("youtube_chunk_summary_failed", chunk=chunk_index, error=str(exc))
            return f"### Part {chunk_index + 1} (min {minutes_start}–{minutes_end})\n[Summary unavailable]"

    # Summarise all chunks (concurrently with a small semaphore to avoid rate limits)
    sem = asyncio.Semaphore(3)

    async def _safe_summarise(idx: int, segs: list[dict]) -> str:
        async with sem:
            return await _summarise_one(idx, segs)

    summaries = await asyncio.gather(*[_safe_summarise(i, c) for i, c in enumerate(chunks)])

    study_guide = "# Video Study Guide\n\n" + "\n\n".join(summaries)

    # Safety: ensure we don't exceed the limit
    if len(study_guide) > DIRECT_MAX_CHARS:
        study_guide = study_guide[:DIRECT_MAX_CHARS]

    return study_guide
