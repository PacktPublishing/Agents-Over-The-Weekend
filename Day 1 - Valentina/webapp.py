"""
Personal Finance AI Agent — Flask Web Application
A clean chat interface for an AI-powered personal finance advisor.
"""

import os
import json
import uuid
from datetime import datetime

from flask import Flask, render_template, request, jsonify, session, Response
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain.tools import tool
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# ── Load Environment ────────────────────────────────────────────────
env_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".env"
)
load_dotenv(dotenv_path=env_path, override=True)

if not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = input("Enter your OpenAI API key: ")

# ── Flask App ───────────────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates",
)
app.secret_key = os.urandom(24)

# ── LLM ─────────────────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-5-nano")

# ── Tools ───────────────────────────────────────────────────────────
tavily_api_key = os.getenv("TAVILY_API_KEY")
tavily_tool = TavilySearchResults(max_results=5, tavily_api_key=tavily_api_key)

PORTFOLIO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_portfolio.json")


@tool
def read_sample_portfolio(json_path: str = "sample_portfolio.json") -> str:
    """
    Reads the sample_portfolio.json file and returns its content as a string.
    Each entry includes the stock symbol, sector, quantity, purchase price, and purchase date.
    """
    path = PORTFOLIO_PATH
    if not os.path.exists(path):
        return f"File not found: {path}"

    with open(path, "r") as f:
        portfolio = json.load(f)

    if not isinstance(portfolio, list):
        return "Unexpected portfolio format."

    response = "Sample Portfolio:\n"
    for stock in portfolio:
        response += (
            f"- {stock['symbol']} ({stock['sector']}): "
            f"{stock['quantity']} shares @ ${stock['purchase_price']} "
            f"(Bought on {stock['purchase_date']})\n"
        )
    return response


# ── System Prompt ───────────────────────────────────────────────────
prompt = f"""You are a personal finance AI advisor. You help users analyze their investment portfolio,
provide insights on stock performance, sector diversification, and suggest improvements.
You can search the web for current market data and news, and read the user's sample portfolio.
Always use the current date {datetime.today().strftime('%Y-%m-%d')} for any calculations or assessments.
Be concise, helpful, and data-driven in your responses. Use bullet points and clear formatting when appropriate."""

# ── Agent ───────────────────────────────────────────────────────────
tools = [tavily_tool, read_sample_portfolio]
agent = create_agent(llm, tools, system_prompt=prompt)
print("🤖 Personal Finance Agent ready!")

# ── Conversation store ──────────────────────────────────────────────
conversations: dict[str, list] = {}

# ── Routes ──────────────────────────────────────────────────────────


@app.route("/")
def index():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return render_template("index.html")


# ── Friendly tool names for status updates ─────────────────────────
TOOL_DISPLAY_NAMES = {
    "tavily_search_results_json": "Searching the web",
    "read_sample_portfolio": "Reading your portfolio",
}


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"response": "Please type a message!"}), 400

    session_id = session.get("session_id", str(uuid.uuid4()))

    if session_id not in conversations:
        conversations[session_id] = []

    messages = list(conversations[session_id]) + [
        {"role": "user", "content": user_message}
    ]

    inputs = {"messages": messages}

    def generate():
        response_text = ""
        tool_calls_used = []

        yield _sse_event({"type": "status", "text": "Thinking..."})

        try:
            for chunk in agent.stream(inputs, stream_mode="values"):
                latest_message = chunk["messages"][-1]

                if isinstance(latest_message, AIMessage):
                    if getattr(latest_message, "tool_calls", None):
                        for tc in latest_message.tool_calls:
                            name = tc["name"]
                            tool_calls_used.append(name)
                            display = TOOL_DISPLAY_NAMES.get(name, name)
                            yield _sse_event({"type": "tool", "name": name, "text": f"Using tool: {display}..."})
                    elif latest_message.content:
                        yield _sse_event({"type": "status", "text": "Composing response..."})
                        response_text = latest_message.content

                elif isinstance(latest_message, ToolMessage):
                    yield _sse_event({"type": "status", "text": "Processing tool results..."})

        except Exception as e:
            response_text = f"Sorry, something went wrong: {str(e)}"

        if not response_text:
            response_text = "I'm processing your request. Could you please try again?"

        # Save conversation
        conversations[session_id].append({"role": "user", "content": user_message})
        conversations[session_id].append({"role": "assistant", "content": response_text})
        if len(conversations[session_id]) > 20:
            conversations[session_id] = conversations[session_id][-20:]

        yield _sse_event({"type": "done", "response": response_text, "tools": tool_calls_used})

    return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/api/portfolio", methods=["GET"])
def get_portfolio():
    try:
        with open(PORTFOLIO_PATH, "r") as f:
            portfolio = json.load(f)
        return jsonify(portfolio)
    except Exception:
        return jsonify([])


@app.route("/api/reset", methods=["POST"])
def reset_chat():
    session_id = session.get("session_id")
    if session_id and session_id in conversations:
        del conversations[session_id]
    return jsonify({"status": "ok"})


# ── Run ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
