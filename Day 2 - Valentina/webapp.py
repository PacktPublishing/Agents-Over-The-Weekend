"""
MammaChePiada! — Flask Web Application
A beautiful restaurant website with an AI-powered chatbot assistant.
"""

import os
import json
import sqlite3
import uuid
import random

from pathlib import Path
from flask import Flask, render_template, request, jsonify, session, send_from_directory
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.utilities.sql_database import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain.tools import tool
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_core.tools.retriever import create_retriever_tool
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage
import faiss

# ── Load Environment ────────────────────────────────────────────────
import getpass

env_path = r"C:\Users\vaalt\OneDrive\Desktop\Projects\Eventi speaker\Packt Bootcamp\code\.env"
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

# ── Serve images from the existing images/ directory ────────────────
@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory("images", filename)


# ── Database Initialization ────────────────────────────────────────
DB_PATH = "piadineria.db"
DB_JSON_PATH = "db.json"



# ── Initialize db.json if missing ──────────────────────────────────
if not Path(DB_JSON_PATH).exists():
    with open(DB_JSON_PATH, "w") as f:
        json.dump({"cart": []}, f, indent=2)

# ── LLM & Embeddings ───────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-5.2")
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

# ── SQL Toolkit ─────────────────────────────────────────────────────
db = SQLDatabase.from_uri(f"sqlite:///{DB_PATH}")
sql_toolkit = SQLDatabaseToolkit(db=db, llm=llm)

# ── Cart Tool (writes directly to db.json) ──────────────────────────
@tool
def add_to_cart(item_name: str, item_price: float) -> str:
    """Add an item to the cart. Use this when the customer confirms they want to order an item."""
    try:
        with open(DB_JSON_PATH, "r") as f:
            data = json.load(f)
    except Exception:
        data = {"cart": []}

    cart_item = {
        "id": uuid.uuid4().hex[:4],
        "name": item_name,
        "price": item_price,
    }
    data["cart"].append(cart_item)

    with open(DB_JSON_PATH, "w") as f:
        json.dump(data, f, indent=2)

    return f"Item '{item_name}' (€{item_price:.2f}) added to cart successfully."


# ── RAG Tool ────────────────────────────────────────────────────────
print("📄 Loading documents for RAG...")
loader = PyPDFDirectoryLoader("documents")
raw_documents = loader.load()
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
chunked_documents = text_splitter.split_documents(raw_documents)

index = faiss.IndexFlatL2(len(embeddings.embed_query("hello world")))
vector_store = FAISS(
    embedding_function=embeddings,
    index=index,
    docstore=InMemoryDocstore(),
    index_to_docstore_id={},
)
vector_store.add_documents(chunked_documents)
retriever = vector_store.as_retriever()

rag_tool = create_retriever_tool(
    retriever,
    "document_search",
    "Search and return information about the restaurant's health certificates, food safety compliance, and owner's history and achievements.",
)

# ── System Prompt ───────────────────────────────────────────────────
prompt = ("""You are an AI assistant for a Piadineria Restaurant. 
            You help customers explore the menu and choose the best piadine or Italian specialties through friendly, interactive questions.
            When the user asks for product details (ingredients, allergens, vegetarian options, price, etc.), you can query the product database.

            Once the user is ready to order, ask if they'd like to add the selected item to their cart.
            If they confirm, add the item to the cart using your tools.

            When using a tool, respond only with the final result. For example:
            Human: Add Classic Piadina to the cart with price 5.50
            AI: Item 'Classic Piadina' added to cart successfully.
        """
)

# ── Agent ───────────────────────────────────────────────────────────
toolkit = [rag_tool, add_to_cart, *sql_toolkit.get_tools()[:4]]
agent = create_agent(llm, toolkit, system_prompt=prompt)
print("🤖 Agent ready!")

# ── Conversation store ──────────────────────────────────────────────
conversations: dict[str, list] = {}


# ── API Routes ──────────────────────────────────────────────────────

@app.route("/")
def index():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"response": "Please type a message!"}), 400

    session_id = session.get("session_id", str(uuid.uuid4()))

    if session_id not in conversations:
        conversations[session_id] = []

    # Build message list with history
    messages = list(conversations[session_id]) + [
        {"role": "user", "content": user_message}
    ]

    inputs = {"messages": messages}

    response_text = ""
    tool_calls_used = []
    try:
        for chunk in agent.stream(inputs, stream_mode="values"):
            latest_message = chunk["messages"][-1]
            if isinstance(latest_message, AIMessage) and latest_message.content:
                response_text = latest_message.content
            elif getattr(latest_message, "tool_calls", None):
                for tc in latest_message.tool_calls:
                    tool_calls_used.append(tc["name"])
    except Exception as e:
        response_text = f"Mi dispiace, something went wrong: {str(e)}"

    if not response_text:
        response_text = "I'm processing your request. Could you please try again?"

    # Save conversation
    conversations[session_id].append({"role": "user", "content": user_message})
    conversations[session_id].append({"role": "assistant", "content": response_text})

    # Keep only last 20 messages to avoid token limits
    if len(conversations[session_id]) > 20:
        conversations[session_id] = conversations[session_id][-20:]

    return jsonify({"response": response_text, "tools": tool_calls_used})


@app.route("/api/cart", methods=["GET"])
def get_cart():
    try:
        with open(DB_JSON_PATH, "r") as f:
            data = json.load(f)
        return jsonify(data.get("cart", []))
    except Exception:
        return jsonify([])


@app.route("/api/cart/<item_id>", methods=["DELETE"])
def delete_cart_item(item_id):
    try:
        with open(DB_JSON_PATH, "r") as f:
            data = json.load(f)

        data["cart"] = [item for item in data["cart"] if item.get("id") != item_id]

        with open(DB_JSON_PATH, "w") as f:
            json.dump(data, f, indent=2)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/cart/clear", methods=["POST"])
def clear_cart():
    try:
        with open(DB_JSON_PATH, "w") as f:
            json.dump({"cart": []}, f, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/menu", methods=["GET"])
def get_menu():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products ORDER BY Category, [Product Name]")
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(products)


# ── Run ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🍕 MammaChePiada! is running at http://localhost:5000\n")
    app.run(debug=True, port=5000, use_reloader=True)
