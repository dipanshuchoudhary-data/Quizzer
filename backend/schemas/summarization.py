from pydantic import BaseModel

class DocumentSummary(BaseModel):
    summary:str
    key_topics:list[str]
    difficulty_level:str
    