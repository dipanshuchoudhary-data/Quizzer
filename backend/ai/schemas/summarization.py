from pydantic import BaseModel, Field
from typing import List


class DocumentSummary(BaseModel):
    """
    Structured output schema for document summarization agent.
    """

    summary: str = Field(
        ...,
        description="Concise academic summary of the document content.",
        min_length=10,
    )

    key_topics: List[str] = Field(
        ...,
        description="List of major key topics covered in the document.",
        min_items=1,
    )

    difficulty_level: str = Field(
        ...,
        description="Overall academic difficulty level: easy | medium | hard.",
        pattern="^(easy|medium|hard)$",
    )
