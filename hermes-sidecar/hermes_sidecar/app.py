# [claude-code 2026-04-19] FastAPI app — exposes the HTTP contract from
# shared/sidecar-contract.ts. Endpoints mirror §2 of docs/sprint-briefs/S27-T2-context-sandbox.md.
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from .auth import verify_internal_jwt
from .config import load_config
from .models import (
    ChatRequest,
    ContextIngestRequest,
    ContextToolRequest,
    ContextView,
    ContextViewRequest,
    HealthzResponse,
    RoutingSelectRequest,
    RoutingSelectResponse,
    SkillInvokeRequest,
    SkillManifest,
    VoiceSTTRequest,
    VoiceSTTResponse,
    VoiceTTSRequest,
)
from .runtime import HermesRuntime

log = logging.getLogger("hermes_sidecar.app")

VERSION = "0.1.0"


def create_app() -> FastAPI:
    config = load_config()
    runtime = HermesRuntime(config)
    runtime.load_plugins()

    app = FastAPI(
        title="Fintheon Hermes Sidecar",
        version=VERSION,
        description="NousResearch Hermes Agent behind a typed HTTP contract. Internal-only.",
    )
    app.state.runtime = runtime
    app.state.config = config

    @app.get("/healthz", response_model=HealthzResponse)
    async def healthz() -> HealthzResponse:
        return HealthzResponse(
            ok=True,
            version=VERSION,
            context_engine=runtime.context_engine,
            plugins_loaded=runtime.plugins_loaded,
        )

    @app.post("/v1/chat")
    async def chat(
        body: ChatRequest,
        request: Request,
        x_context_engine: str | None = Header(default=None),
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> EventSourceResponse:
        overrides = dict(body.system_overrides or {})
        if x_context_engine:
            overrides["context_engine"] = x_context_engine

        async def event_stream():
            try:
                async for event in runtime.chat_stream(
                    agent_id=body.agent_id,
                    conversation_id=body.conversation_id,
                    user_message=body.user_message,
                    system_overrides=overrides,
                ):
                    if await request.is_disconnected():
                        log.info("client disconnected, aborting chat stream")
                        break
                    yield {"event": event.get("type", "delta"), "data": json.dumps(event)}
            except Exception as exc:  # noqa: BLE001
                log.exception("chat stream failed")
                yield {"event": "error", "data": json.dumps({"type": "error", "payload": {"message": str(exc)}})}

        return EventSourceResponse(event_stream())

    @app.post("/v1/context/ingest", status_code=status.HTTP_204_NO_CONTENT)
    async def context_ingest(
        body: ContextIngestRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> None:
        await runtime.context_ingest(body.conversation_id, body.turn.model_dump())

    @app.get("/v1/context/view", response_model=ContextView)
    async def context_view_get(
        conversation_id: str,
        budget_tokens: int = 120000,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> ContextView:
        data = await runtime.context_view(conversation_id, budget_tokens)
        return ContextView(**data)

    @app.post("/v1/context/view", response_model=ContextView)
    async def context_view_post(
        body: ContextViewRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> ContextView:
        data = await runtime.context_view(body.conversation_id, body.budget_tokens)
        return ContextView(**data)

    @app.post("/v1/context/tools/{tool_name}")
    async def context_tool(
        tool_name: str,
        body: ContextToolRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> JSONResponse:
        result = await runtime.context_tool(tool_name, body.conversation_id, body.args)
        return JSONResponse(result)

    @app.post("/v1/voice/stt", response_model=VoiceSTTResponse)
    async def voice_stt(
        body: VoiceSTTRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> VoiceSTTResponse:
        # T5 (Claude-08) implements real Whisper-equivalent call via runtime plugin.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="voice.stt lands in W2c (Claude-08) — see S27-T5-agent-voice-briefs.md",
        )

    @app.post("/v1/voice/tts")
    async def voice_tts(
        body: VoiceTTSRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> JSONResponse:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="voice.tts lands in W2c (Claude-08) — see S27-T5-agent-voice-briefs.md",
        )

    @app.get("/v1/skills", response_model=list[SkillManifest])
    async def skills_list(
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> list[SkillManifest]:
        registry = ((config.get("skills") or {}).get("registry")) or []
        return [SkillManifest(**m) for m in registry]

    @app.post("/v1/skills/invoke")
    async def skills_invoke(
        body: SkillInvokeRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> JSONResponse:
        # T10 (Claude-10) implements agentskills.io execution here.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"skills.invoke({body.skill_id}) lands in W2e (Claude-10) — see S27-T10-skills-hub.md",
        )

    @app.post("/v1/routing/select", response_model=RoutingSelectResponse)
    async def routing_select(
        body: RoutingSelectRequest,
        _claims: dict[str, Any] = Depends(verify_internal_jwt),
    ) -> RoutingSelectResponse:
        data = await runtime.routing_select(body.agent_id, body.task_type, body.input_tokens)
        return RoutingSelectResponse(**data)

    return app
