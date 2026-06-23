# lamacode

Local AI chat CLI powered by [LM Studio](https://lmstudio.ai).

Inspired by [opencode](https://github.com/anomalyco/opencode), lamacode is a lightweight terminal chat client that works exclusively with local models served by LM Studio.

## Prerequisites

- [Node.js](https://nodejs.org) v22+
- [LM Studio](https://lmstudio.ai) with a model loaded and the local server running

## Installation

```bash
git clone https://github.com/nazimboudeffa/lamacode
cd lamacode
npm install
```

## Usage

1. Open LM Studio and load a model
2. Start the local server in LM Studio: **Local Server → Start Server** (default port: `1234`)
3. Run lamacode:

```bash
npm start
```

Or specify a model and/or a custom server URL:

```bash
LMSTUDIO_MODEL="mistral-7b-instruct" npm start
LMSTUDIO_URL="http://localhost:1234/v1" LMSTUDIO_MODEL="mistral-7b-instruct" npm start
```

### Build & run compiled JS

```bash
npm run build
npm run start:js
```

## Commands

| Command    | Description                                      |
|------------|--------------------------------------------------|
| `/help`    | Show available commands                          |
| `/models`  | List models available in LM Studio               |
| `/clear`   | Clear the conversation history                   |
| `/exit`    | Quit lamacode                                    |

## Environment Variables

| Variable          | Default                        | Description                        |
|-------------------|--------------------------------|------------------------------------|
| `LMSTUDIO_URL`    | `http://localhost:1234/v1`     | LM Studio local server URL         |
| `LMSTUDIO_MODEL`  | `local-model`                  | Model name as shown in LM Studio   |

## Project Structure

```
src/
├── index.ts      # CLI entry point & main loop
├── chat.ts       # Streaming chat + model listing
├── config.ts     # LM Studio configuration
├── history.ts    # Conversation history management
└── tui.ts        # Terminal UI (readline + chalk)
```

## License

MIT
