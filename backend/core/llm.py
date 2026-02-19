from typing import Type, TypeVar
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from backend.core.config import settings


T = TypeVar("T", bound=BaseModel)


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.7,
        timeout=60,
        max_retries=2,
    )


async def structured_llm_call(prompt: str, output_schema: Type[T]) -> T:
    """
    Always return a validated Pydantic model instance.
    Never return raw dict.
    """

    llm = get_llm()
    parser = JsonOutputParser(pydantic_object=output_schema)

    format_instructions = parser.get_format_instructions()

    full_prompt = f"""
    {prompt}

    {format_instructions}
    """

    chain = llm | parser

    raw = await chain.ainvoke(full_prompt)

    return output_schema.model_validate(raw)
