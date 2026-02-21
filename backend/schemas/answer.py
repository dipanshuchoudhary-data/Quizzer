from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class SaveAnswerRequest(BaseModel):
    question_id: UUID
    answer_text: str


class SaveAnswerResponse(BaseModel):
    message: str
    question_id: UUID
