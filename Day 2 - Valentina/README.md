# AI Agent for Piadineria Restaurant

This notebook demonstrates the implementation of an AI-powered assistant for a Piadineria restaurant using LangChain and Azure OpenAI services. The agent helps customers explore the menu, get product information, and place orders.

## Features


- **SQL Database Integration**: Product and supplier database management
- **Document Retrieval**: RAG (Retrieval Augmented Generation) implementation for accessing restaurant documentation
- **Shopping Cart Integration**: Ability to add items to a cart through an API
- **Interactive Chat Interface**: Natural language interaction with customers

## Components

### 1. Azure OpenAI Integration
- Uses Azure OpenAI for chat completion and embeddings
- Requires proper environment variables setup (API key, endpoint, etc.)

### 2. Database Management
- SQLite database (`piadineria.db`) containing:
  - Products table (30 Italian food items)
  - Suppliers table (10 suppliers)
- Includes comprehensive product information:
  - Product details (name, price, stock)
  - Allergen information
  - Nutritional data
  - Supplier relationships

### 3. Tools and Capabilities
- SQL Database Tools: Query and manage product/supplier data
- Cart Management: Add items to shopping cart
- Document Retrieval: Search through restaurant documentation
  - Health certificates
  - Owner's history
  - Other relevant documents

### 4. Agent Evaluation
- Integration with LangSmith for agent evaluation.
- Custom evaluation metrics:
  - Correctness scoring
  - Tool usage evaluation
  - Response quality assessment

To get started with LangSmith:
- Sign up for free here: https://smith.langchain.com/
- Create your API keys on the LangSmith Settings page.
- Save your APIs in your `.env` file:

```
LANGSMITH_API_KEY = "xxx"
LANGSMITH_ENDPOINT = "xxx"
LANGSMITH_PROJECT = "xxx"
```


## Setup Requirements

1. Environment Variables (in a `.env` file in the parent `code/` directory):
   - OPENAI_API_KEY
   - LANGSMITH_API_KEY
   - LANGSMITH_ENDPOINT
   - LANGSMITH_PROJECT

2. Required Python Packages:

```bash
pip install -r requirements.txt
```

3. Additional Files:
   - `piadineria.db`: SQLite database (auto-created by running the data cell in the notebook)
   - `documents/`: Folder containing PDF documentation for RAG
   - `db.json`: Local cart storage file (auto-created by `webapp.py` on first run)

## Running the Web App

The Flask web app (`webapp.py`) provides a full restaurant website with an AI chatbot, menu browsing, and cart functionality. To run it:

```bash
cd "Day 2 - Valentina"
python webapp.py
```

The app will start on **http://localhost:5000**. Open that URL in your browser.

> **Note:** Make sure you have already run the database creation cell in the notebook (or run `webapp.py` which initializes `db.json` automatically). The `piadineria.db` SQLite database must exist — you can create it by running the data setup cell in the notebook first.

## Using the Notebook

The notebook (`AIAgent.ipynb`) provides an interactive environment to:
- Query product information
- Check prices and availability
- Add items to cart
- Get information about allergens and ingredients
- Access restaurant documentation
- Learn about the restaurant's history and certifications

## Agent Evaluation

The notebook includes comprehensive evaluation capabilities:
- Dataset creation for testing
- Correctness evaluation
- Tool usage assessment
- Response quality measurement
- Integration with LangSmith for detailed analytics

## Notes

- All sensitive information should be stored in a `.env` file
- The web app manages cart state locally via `db.json` — no external server (e.g., json-server) is needed
- Regular evaluation of agent performance is recommended through LangSmith

## Additional Resources
- [LangChain ReAct Agent](https://python.langchain.com/docs/tutorials/agents/)
- [LangSmith](https://docs.smith.langchain.com/)
- [Observability](https://docs.smith.langchain.com/observability)
- [Evaluation](https://docs.smith.langchain.com/evaluation)
