# Local AI Setup (Offline Mode)

This guide explains how to run the MoFPED chatbot with a **local AI model** instead of OpenAI, so it works offline.

## 1. Install Ollama on Your Mac

**Option A: Download installer**
- Go to [ollama.com/download](https://ollama.com/download)
- Download the macOS app and open it to install

**Option B: Homebrew**
```bash
brew install ollama
brew services start ollama
```

## 2. Pull a Model

After Ollama is running, pull a model. Recommended for this chatbot:

```bash
# Llama 3.2 (3B) - faster, lighter
ollama pull llama3.2:3b

# Llama 3.1 (8B) - better quality
ollama pull llama3.1:8b

# Mistral - good balance
ollama pull mistral
```

Ollama runs at `http://localhost:11434` by default.

## 3. Configure the App

Add to your `.env.local`:

```env
USE_LOCAL_AI=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

- `USE_LOCAL_AI=true` — Use Ollama instead of OpenAI
- `OLLAMA_BASE_URL` — Default is `http://localhost:11434`
- `OLLAMA_MODEL` — Model name (e.g. `llama3.2:3b`, `mistral`, `llama3.1:8b`)

## 4. Run the App Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The chatbot will use your local Ollama model.

**Tip:** The app defaults to `/api/chat` (LangChain RAG chain). For the full MoFPED experience (intent routing, finance.go.ug scraping), you can switch the frontend to use `/api/ask` instead.

## Offline Behavior

| Component      | Online (OpenAI)        | Offline (Ollama)              |
|----------------|------------------------|-------------------------------|
| **LLM**        | GPT-4 Turbo (API)      | Local model (Ollama)          |
| **Document search** | Supabase pgvector + finance.go.ug | Same (needs internet) or cached docs |
| **Embeddings** | OpenAI text-embedding-3-small | Uses keyword search fallback |

**Note:** Document retrieval (Supabase, finance.go.ug) still needs internet. For full offline use, you would need pre-cached documents and local embeddings. The current setup gives you **local LLM** — no API costs and works when OpenAI is unavailable.

## Switching Back to OpenAI

Set `USE_LOCAL_AI=false` or remove it, and add `OPENAI_API_KEY` to use the cloud model again.
