import asyncio
import sys

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

from mcp import ClientSession
from mcp.client.sse import sse_client

MCP_SERVER_URL = "http://localhost:8000/sse"


async def main(query: str):
    async with sse_client(MCP_SERVER_URL) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await load_mcp_tools(session)
            model = ChatGoogleGenerativeAI(
                model="gemini-3-flash-preview", project="kuligin-sandbox1"
            )
            agent = create_react_agent(model, tools)

            print(f"Query: {query}\n")
            async for event in agent.astream(
                {"messages": [("human", query)]}, stream_mode="values"
            ):
                event["messages"][-1].pretty_print()


if __name__ == "__main__":
    query = (
        " ".join(sys.argv[1:])
        if len(sys.argv) > 1
        else ("What is 1000 USD worth in GBP, JPY, and CHF at today's rates?")
    )
    asyncio.run(main(query))
