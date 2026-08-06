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

At startup, choose LM Studio or Ollama. Press Enter to keep the provider configured by `LLM_PROVIDER`.

```text
Choisis le fournisseur local :
  1. LM Studio
  2. Ollama
Fournisseur [2] >
```

You can enter `1`, `lmstudio`, `2`, or `ollama`. The OpenAI-compatible client is created only after this selection.

LamaCode then retrieves the available models from the selected provider:

```text
Choisis un modèle :
  1. qwen3:8b
  2. qwen2.5-coder:7b
Modèle [1] >
```

Enter a number, an exact model ID, or press Enter to keep the suggested model. `LLM_MODEL` controls the initial suggestion when that model is available.

## Commands

| Command   | Description                                      |
|-----------|--------------------------------------------------|
| `/help`   | Show available commands                          |
| `/models` | List models exposed by the provider              |
| `/model`  | Select another model without restarting          |
| `/status` | Show provider, model, server, and message count   |
| `/retry`  | Regenerate the last response                     |
| `/undo`   | Remove the last user/assistant turn               |
| `/add <file>` | Add a workspace file to the model context     |
| `/context` | List files currently included in the context     |
| `/remove <file>` | Remove a file from the context             |
| `/save <name>` | Save the current conversation and context    |
| `/sessions` | List saved sessions                              |
| `/load <name>` | Restore a saved session                      |
| `/delete-session <name>` | Delete a saved session              |
| `/clear`  | Clear the conversation history                   |
| `/exit`   | Quit lamacode                                    |

Changing the active model keeps the current conversation history. Use `/clear` to start a fresh conversation. `/status` never displays the configured API key.

## File Context

Add files explicitly:

```text
/add src/index.ts
/context
/remove src/index.ts
```

You can also reference files directly in a prompt. References are added to the persistent context before the message is sent:

```text
Explain @src/index.ts and compare it with @"docs/example file.md"
```

The loaded file snapshots are included in every request without being copied into the conversation history. Run `/add` again to refresh a modified file. `/clear` clears the conversation but keeps the selected files; remove them with `/remove`.

File access is restricted for safety:

- paths must resolve to regular files inside the current workspace;
- symbolic links, Git-ignored files, binary files, and sensitive filenames are rejected;
- common private-key and API-token patterns are rejected heuristically;
- each file is limited to 64 KiB and the complete framed context to 256 KiB;
- file contents are sent as user-provided, untrusted reference data rather than system instructions.

These protections reduce accidental disclosure and prompt-injection risk, but cannot prove that a file is safe. Review files before adding them.

`@mentions` and email addresses are not interpreted as files. Unquoted references must include both a directory and a file extension, such as `@src/index.ts`; quote other paths or use `/add`. Invalid or ambiguous inline references are reported but do not block the message.

## Sessions

Save and restore work by name:

```text
/save authentication-refactor
/sessions
/load authentication-refactor
/delete-session authentication-refactor
```

Sessions are stored per workspace in `.lamacode/sessions/`, which is ignored by Git. A session contains:

- the selected provider and model;
- user and assistant messages;
- relative paths of files in the context;
- creation and update timestamps.

Configuration fields such as API keys, server URLs, `.env` values, system prompts, and file contents are never saved. User and assistant messages are stored verbatim, so do not paste secrets into the conversation. Loading a session re-reads and revalidates every context file, so deleted, ignored, sensitive, or otherwise invalid files make the load fail without replacing the current state.

Select the same provider used by the session when starting LamaCode. The saved model must still be available. `/status` displays the active session and marks it as `modifiée` after unsaved changes. Saving an existing name updates that session atomically.

Session names are normalized to lowercase. They accept 1 to 64 letters, numbers, dots, dashes, or underscores, but do not accept spaces, `..`, or Windows device names.

## Environment Variables

| Variable       | Default                                  | Description                              |
|----------------|------------------------------------------|------------------------------------------|
| `LLM_PROVIDER` | `lmstudio`                               | `lmstudio` or `ollama`                   |
| `LLM_BASE_URL` | Depends on the provider                  | OpenAI-compatible API base URL           |
| `LLM_MODEL`    | First available model                    | Preferred model ID                       |
| `LLM_API_KEY`  | `lm-studio` or `ollama`                  | API key; a placeholder works locally     |

Environment variables already exported by the shell take precedence over values in `.env`.

`LLM_PROVIDER` controls the default menu choice. `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` override the selected provider's defaults when they are set.

The local placeholder API keys are not secrets. If you configure a real authenticated endpoint, keep its key in `.env` or your shell environment and never commit it. The `.gitignore` excludes `.env` while allowing the safe `.env.example` template.

## Project Structure

```text
src/
|-- index.ts      # CLI entry point and main loop
|-- chat.ts       # Streaming chat and model listing
|-- config.ts     # Provider and environment configuration
|-- context.ts    # Safe workspace file context
|-- history.ts    # Conversation history management
|-- sessions.ts   # Local persistent session storage
`-- tui.ts        # Terminal UI (readline and chalk)
```

## License

MIT
