# services/ai-builder/aibuilder/llm_client.py
# Stub LLM client for FloMatrix AI Builder.
# Later we can wire this to the real OpenAI / ChatGPT API.

from __future__ import annotations

from textwrap import shorten


class LLMClient:
    @staticmethod
    def generate(prompt: str) -> str:
        """
        TEMP IMPLEMENTATION:
        For now, just return a placeholder file so the microservice runs.

        Later we'll replace this with a real call to the LLM.
        """
        header = "// [AIB] AUTO-GENERATED FILE (stub)\n"
        meta = "// NOTE: LLM not connected yet. This is placeholder code.\n"
        prompt_snippet = shorten(prompt.replace("\n", " "), width=200, placeholder="...")
        meta_prompt = f"// PROMPT SNIPPET: {prompt_snippet}\n\n"

        body = "export function placeholder() {\n"
        body += "  console.log('FloMatrix AI Builder stub output');\n"
        body += "}\n"

        return header + meta + meta_prompt + body
