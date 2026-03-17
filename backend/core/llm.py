from typing import Type, TypeVar
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.exceptions import OutputParserException
try:
    from langchain.output_parsers import OutputFixingParser  # type: ignore
except Exception:  # pragma: no cover
    OutputFixingParser = None  # type: ignore

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

    try:
        raw = await chain.ainvoke(full_prompt)
    except OutputParserException:
        # Fallback: get raw text and repair to valid JSON
        raw_msg = await llm.ainvoke(full_prompt)
        raw_text = raw_msg.content if hasattr(raw_msg, "content") else str(raw_msg)
        if OutputFixingParser is None:
            raise
        fixer = OutputFixingParser.from_llm(llm, parser)
        raw = await fixer.aparse(raw_text)

    return output_schema.model_validate(raw)
