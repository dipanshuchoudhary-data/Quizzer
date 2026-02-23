from pydantic import BaseModel
from typing import List

class ShortAnswerScore(BaseModel):
    question_id:str
    awarded_marks:int
    max_marks:int
    confidence:str

class ShortAnswerEvaluationOutput(BaseModel):
    results:List[ShortAnswerScore]