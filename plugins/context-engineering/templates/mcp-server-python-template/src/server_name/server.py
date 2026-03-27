"""{Server Name} MCP Server.

{Description of what this server does and what tools it provides.}

Usage:
    uvx {server-name}
    # or
    python -m {server_module}.server
"""

from __future__ import annotations

import logging
import os
import signal
import sys

from mcp.server.fastmcp import FastMCP

# Logging must go to stderr (stdout is JSON-RPC transport)
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("{server-name}")

# Server instance
mcp = FastMCP(
    "{server-name}",
    version="0.1.0",
    description="{Description of server capabilities}",
)

# Import tools (registers via @mcp.tool() decorator)
from .tools.example import *  # noqa: F401, F403, E402


def main() -> None:
    """Entry point for uvx / direct execution."""

    def handle_shutdown(signum: int, frame: object) -> None:
        logger.info("Shutting down...")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info("Starting {server-name}")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
