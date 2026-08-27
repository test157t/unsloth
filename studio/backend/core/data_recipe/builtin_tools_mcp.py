# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Stdio MCP bridge for Studio's safe built-in recipe tools.

Data Designer speaks MCP for tool-enabled columns, while Studio's chat runtime
owns the canonical web-search and sandboxed Python implementations.  This
small server exposes those same implementations without duplicating their
network policy, code checks, resource limits, or output formatting.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

# Executing this file directly puts core/data_recipe on sys.path.  Add the
# backend root so packaged and source checkouts resolve core.inference alike.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from fastmcp import FastMCP

from core.inference.tools import execute_tool, remove_session_sandbox


def create_builtin_recipe_tools_mcp() -> FastMCP:
    """Create the fixed, non-configurable built-in recipe-tool server."""

    mcp = FastMCP(
        "Unsloth Recipe Built-ins",
        instructions = (
            "Use web_search only when current or source-grounded information is required. "
            "Use python for calculations, data checks, and deterministic verification. "
            "Never claim a tool ran unless a tool result is present."
        ),
    )

    @mcp.tool
    def web_search(query: str = "", url: str | None = None) -> str:
        """Search the web, or fetch full readable text from a specific URL.

        Search first with query.  To inspect a result in depth, call this tool
        again with its URL.  Cite the returned sources and distinguish their
        publication dates from the date an event or standard took effect.
        """

        return execute_tool(
            "web_search",
            {"query": query, "url": url},
            timeout = 60,
        )

    @mcp.tool
    def python(code: str) -> str:
        """Execute stateless Python in Studio's sandbox and return stdout/stderr.

        Use this for calculations, parsing, simulations, and verification.  The
        sandbox blocks dangerous operations and is removed after each call, so
        communicate results through stdout rather than relying on saved files.
        """

        session_id = f"recipe-python-{uuid.uuid4().hex}"
        try:
            return execute_tool(
                "python",
                {"code": code},
                timeout = 60,
                session_id = session_id,
            )
        finally:
            remove_session_sandbox(session_id, delete_files = True)

    return mcp


if __name__ == "__main__":
    create_builtin_recipe_tools_mcp().run(transport = "stdio", show_banner = False)
