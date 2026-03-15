"""
SESSION_ID=$(curl -s -D - -X POST http://localhost:8000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}' \
    | grep -i "mcp-session-id" | awk '{print $2}' | tr -d '\r')

echo "Session: $SESSION_ID"

curl -s -X POST http://localhost:8000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
"""

import httpx

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("fx")

BASE_URL = "https://api.frankfurter.dev/v1"


@mcp.tool()
async def get_latest_rates(
    base: str = "EUR",
    symbols: str = "",
) -> dict:
    """Get the latest currency exchange rates.

    Args:
        base: The base currency (default: EUR). Example: USD
        symbols: Comma-separated list of target currencies. Example: GBP,JPY,CHF
    """
    params: dict = {"base": base}
    if symbols:
        params["symbols"] = symbols

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}/latest", params=params)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def get_rates_for_date(
    date: str,
    base: str = "EUR",
    symbols: str = "",
) -> dict:
    """Get currency exchange rates for a specific historical date.

    Args:
        date: Date in YYYY-MM-DD format. Example: 2024-01-15
        base: The base currency (default: EUR). Example: USD
        symbols: Comma-separated list of target currencies. Example: GBP,JPY,CHF
    """
    params: dict = {"base": base}
    if symbols:
        params["symbols"] = symbols

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}/{date}", params=params)
        resp.raise_for_status()
        return resp.json()


def parse_args():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--transport",
        default="stdio",
        choices=["stdio", "sse", "streamable-http"],
        help="Transport to use (default: stdio)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    mcp.run(transport=args.transport)
