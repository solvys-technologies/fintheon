# [claude-code 2026-04-19] Runtime adapter — wires the upstream NousResearch Hermes Agent
# (+ hermes-lcm, icarus) behind a stable boot surface that entrypoint.py imports.
#
# The upstream package name may shift between releases. We try the canonical import
# paths in order; if none are importable (e.g. during scaffold / CI smoke before the
# wheel is in place), we fall back to a stub adapter that still satisfies the HTTP
# contract so boot is never blocked. Claude-07 (W2b) swaps the stub for real Hermes
# calls once pyproject dependencies are resolved in the prod image.
from __future__ import annotations

import asyncio
import importlib
import logging
from typing import Any, AsyncIterator

log = logging.getLogger("hermes_sidecar.runtime")


class HermesRuntime:
    """Thin façade over the upstream Hermes Agent runtime.

    Method surface is intentionally small — it matches what the HTTP handlers call.
    Plugin preload, context engine selection, and routing live on the config dict.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self._plugins_loaded: list[str] = []
        self._context_engine: str = (config.get("context") or {}).get("engine", "lcm")
        self._upstream = _try_load_upstream(config)

    @property
    def plugins_loaded(self) -> list[str]:
        return list(self._plugins_loaded)

    @property
    def context_engine(self) -> str:
        return self._context_engine

    def load_plugins(self) -> None:
        preload = ((self.config.get("plugins") or {}).get("preload")) or []
        for name in preload:
            try:
                if self._upstream is not None and hasattr(self._upstream, "register_plugin"):
                    self._upstream.register_plugin(name)  # type: ignore[attr-defined]
                self._plugins_loaded.append(name)
            except Exception as exc:  # noqa: BLE001 — non-fatal on stub path
                log.warning("plugin load skipped: %s (%s)", name, exc)

    async def chat_stream(
        self,
        *,
        agent_id: str,
        conversation_id: str,
        user_message: str,
        system_overrides: dict[str, Any] | None,
    ) -> AsyncIterator[dict[str, Any]]:
        if self._upstream is not None and hasattr(self._upstream, "chat_stream"):
            async for event in self._upstream.chat_stream(  # type: ignore[attr-defined]
                agent_id=agent_id,
                conversation_id=conversation_id,
                user_message=user_message,
                system_overrides=system_overrides,
            ):
                yield event
            return
        async for event in _stub_chat_stream(agent_id, user_message):
            yield event

    async def context_ingest(self, conversation_id: str, turn: dict[str, Any]) -> None:
        if self._upstream is not None and hasattr(self._upstream, "context_ingest"):
            await self._upstream.context_ingest(conversation_id, turn)  # type: ignore[attr-defined]

    async def context_view(self, conversation_id: str, budget_tokens: int) -> dict[str, Any]:
        if self._upstream is not None and hasattr(self._upstream, "context_view"):
            return await self._upstream.context_view(conversation_id, budget_tokens)  # type: ignore[attr-defined]
        return {"turns": [], "summaries": []}

    async def context_tool(self, tool_name: str, conversation_id: str, args: dict[str, Any]) -> dict[str, Any]:
        if self._upstream is not None and hasattr(self._upstream, "context_tool"):
            return await self._upstream.context_tool(tool_name, conversation_id, args)  # type: ignore[attr-defined]
        return {"tool": tool_name, "result": None, "note": "stub — upstream hermes-lcm not loaded"}

    async def routing_select(self, agent_id: str, task_type: str | None, input_tokens: int | None) -> dict[str, Any]:
        per_agent = ((self.config.get("routing") or {}).get("per_agent")) or {}
        default_model = (self.config.get("routing") or {}).get("default_model", "claude-sonnet-4-6")
        model = per_agent.get(agent_id, default_model)
        return {
            "model": model,
            "provider": "anthropic" if model.startswith("claude-") else "openrouter",
            "reasoning": f"config.yaml routing.per_agent[{agent_id}] → {model}",
        }


def _try_load_upstream(config: dict[str, Any]) -> Any | None:
    candidates = ("hermes_agent", "hermes.agent", "hermes")
    for mod_name in candidates:
        try:
            mod = importlib.import_module(mod_name)
            if hasattr(mod, "Runtime"):
                return mod.Runtime(config=config)  # type: ignore[call-arg]
            if hasattr(mod, "build_runtime"):
                return mod.build_runtime(config)
            return mod
        except ImportError:
            continue
    log.info("hermes-agent upstream not importable — running stub runtime. See runtime.py.")
    return None


async def _stub_chat_stream(agent_id: str, user_message: str) -> AsyncIterator[dict[str, Any]]:
    """Stub so scaffolding boots green without the upstream wheel installed.

    Returns one delta + one done event. Claude-07 (W2b) replaces with real calls.
    """
    preview = user_message[:80]
    yield {
        "type": "delta",
        "payload": {
            "text": f"[sidecar-stub:{agent_id}] received '{preview}' — upstream hermes-agent not loaded.",
        },
    }
    await asyncio.sleep(0)
    yield {"type": "done", "payload": {"stop_reason": "stub"}}
