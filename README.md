# lamacode

Local AI chat CLI for [LM Studio](https://lmstudio.ai) and [Ollama](https://ollama.com).

Inspired by [opencode](https://github.com/anomalyco/opencode), lamacode is a lightweight terminal chat client for local models exposed through an OpenAI-compatible API.

## Prerequisites

- [Node.js](https://nodejs.org) v22+
- LM Studio with its local server running, or Ollama with at least one installed model

## Installation

```bash
git clone https://github.com/nazimboudeffa/lamacode
cd lamacode
npm install
```

Create your local configuration from the template:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead.

## LM Studio

Configure `.env`:

```dotenv
LLM_PROVIDER=lmstudio
LLM_MODEL=your-model-name
```

Open LM Studio, load a model, then start the local server. The default API URL is `http://localhost:1234/v1`.

## Ollama

Start Ollama and install a model if needed:

```bash
ollama serve
ollama pull qwen3:8b
```

Configure `.env`:

```dotenv
LLM_PROVIDER=ollama
LLM_MODEL=qwen3:8b
```

The default API URL is `http://localhost:11434/v1`. Opening `/v1` directly in a browser can return `404`; this is expected. LamaCode calls the complete endpoints `/v1/models` and `/v1/chat/completions`.

## Usage

```bash
npm start
```

## Commands

| Command   | Description                         |
|-----------|-------------------------------------|
| `/help`   | Show available commands             |
| `/models` | List models exposed by the provider |
| `/clear`  | Clear the conversation history      |
| `/exit`   | Quit lamacode                       |

## Environment Variables

| Variable       | Default                                  | Description                              |
|----------------|------------------------------------------|------------------------------------------|
| `LLM_PROVIDER` | `lmstudio`                               | `lmstudio` or `ollama`                   |
| `LLM_BASE_URL` | Depends on the provider                  | OpenAI-compatible API base URL           |
| `LLM_MODEL`    | First available model                    | Preferred model ID                       |
| `LLM_API_KEY`  | `lm-studio` or `ollama`                  | API key; a placeholder works locally     |

Environment variables already exported by the shell take precedence over values in `.env`.

## Project Structure

```text
src/
|-- index.ts      # CLI entry point and main loop
|-- chat.ts       # Streaming chat and model listing
|-- config.ts     # Provider and environment configuration
|-- history.ts    # Conversation history management
`-- tui.ts        # Terminal UI (readline and chalk)
```

## License

MIT
