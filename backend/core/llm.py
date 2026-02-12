from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel
from backend.core.config import settings
import os

llm = ChatOpenAI(
    model_name="meta-llama/llama-3.3-70b-instruct:free",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    temperature=0.7,
)

async def structured_llm_call(
        prompt:str,
        output_schema:type[BaseModel],
):
    parser = JsonOutputParser(pydantic_object=output_schema)
    chain = llm | parser

    response = await chain.ainvoke(prompt)
    return response