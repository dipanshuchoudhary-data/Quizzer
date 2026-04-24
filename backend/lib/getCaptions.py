import os

from supadata import Supadata, SupadataError


def get_captions(video_id: str) -> str:
    api_key = os.environ.get("SUPADATA_API_KEY")
    if not api_key:
        raise ValueError("SUPADATA_API_KEY environment variable not set")

    client = Supadata(api_key=api_key)

    try:
        transcript = client.youtube.transcript(
            video_id=video_id,
            lang="en",
            text=True,
        )
        if not transcript.content:
            raise ValueError("No captions available for this video")
        return transcript.content
    except SupadataError as e:
        raise ValueError(f"Could not fetch transcript: {str(e)}") from e


getCaptions = get_captions
CaptionFetchError = ValueError
