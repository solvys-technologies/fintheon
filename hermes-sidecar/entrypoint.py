# [claude-code 2026-04-19] uvicorn entrypoint for the sidecar.
# Invoked by launchd (local) and Docker CMD (Fly). Port + host come from config.yaml.
from __future__ import annotations

import logging
import os

import uvicorn

from hermes_sidecar.app import create_app
from hermes_sidecar.config import load_config


def main() -> None:
    logging.basicConfig(
        level=os.environ.get("HERMES_LOG_LEVEL", "info").upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    config = load_config()
    runtime_cfg = config.get("runtime") or {}
    host = runtime_cfg.get("host", "0.0.0.0")
    port = int(os.environ.get("PORT", runtime_cfg.get("port", 8318)))
    app = create_app()
    uvicorn.run(app, host=host, port=port, log_level=runtime_cfg.get("log_level", "info"))


if __name__ == "__main__":
    main()
