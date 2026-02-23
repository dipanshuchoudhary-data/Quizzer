from pydantic import BaseModel
from typing import List,Optional

class GeneratedQuestion(BaseModel):
    question_text:str
    question_type:str
    options:Optional[list[str]] = None
    correct_answer:Optional[str] = None
    marks:int   


class QuizGenerationOutput(BaseModel):
    questions: List[GeneratedQuestion]