# [claude-code 2026-04-19] Pydantic mirrors of shared/sidecar-contract.ts.
# Keep field-for-field aligned — backend-hono and sidecar both parse the same wire format.
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    id: str
    role: Literal["user", "assistant", "tool", "system"]
    content: str | dict[str, Any]
    tokens_estimated: int
    created_at: float
    metadata: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    agent_id: str
    conversation_id: str
    user_message: str
    system_overrides: dict[str, Any] | None = None
    stream: bool = True


class ChatEvent(BaseModel):
    type: Literal["delta", "tool_call", "tool_result", "done", "error", "memory_writes", "context_view"]
    payload: Any


class ContextIngestRequest(BaseModel):
    conversation_id: str
    turn: ConversationTurn


class ContextViewRequest(BaseModel):
    conversation_id: str
    budget_tokens: int = Field(default=120000, ge=1024)


class SummaryNode(BaseModel):
    id: str
    kind: Literal["summary", "raw_turn", "tool_result"]
    text: str
    tokens_estimated: int
    children: list[str] = Field(default_factory=list)


class ContextView(BaseModel):
    turns: list[ConversationTurn]
    summaries: list[SummaryNode]


class ContextToolRequest(BaseModel):
    conversation_id: str
    args: dict[str, Any]


class VoiceSTTRequest(BaseModel):
    audio_bytes: str  # base64
    lang: str | None = None


class STTWord(BaseModel):
    word: str
    start: float
    end: float


class VoiceSTTResponse(BaseModel):
    transcript: str
    words: list[STTWord] = Field(default_factory=list)


class VoiceTTSRequest(BaseModel):
    text: str
    voice_id: str
    stream: bool = False


class SkillInvokeRequest(BaseModel):
    skill_id: str
    args: dict[str, Any]
    context: dict[str, Any] | None = None


class SkillManifest(BaseModel):
    id: str
    name: str
    description: str
    version: str
    inputs_schema: dict[str, Any] | None = None


class RoutingSelectRequest(BaseModel):
    agent_id: str
    task_type: str | None = None
    input_tokens: int | None = None


class RoutingSelectResponse(BaseModel):
    model: str
    provider: str
    reasoning: str | None = None


class HealthzResponse(BaseModel):
    ok: bool
    version: str
    context_engine: str
    plugins_loaded: list[str]
