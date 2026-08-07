import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { Runtime } from "../src/application/runtime.js"
import type { LlmConfig } from "../src/config.js"
import { createCommandRegistry, parseCommand } from "../src/cli/command-registry.js"
import { handleConversationCommand } from "../src/cli/commands/conversation.js"
import { handleContextCommand } from "../src/cli/commands/context.js"
import { handleSessionCommand } from "../src/cli/commands/sessions.js"
import type { TUI } from "../src/cli/tui.js"

const config: LlmConfig = {
  provider: "ollama",
  providerLabel: "Ollama",
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
  contextWindow: 8_192,
  maxOutputTokens: 1_024,
}

function createRuntime(): Runtime {
  return new Runtime({ path: process.cwd(), isGit: true }, "model", config)
}

function command(input: string) {
  const parsed = parseCommand(input, createCommandRegistry("Ollama"))
  assert.ok(parsed)
  return parsed
}

function fakeTui(answer = ""): TUI {
  return {
    ask: async () => answer,
    prompt: async () => "",
    startSpinner() {},
    stopSpinner() {},
    beginAssistantResponse() {},
    printAssistantChunk() {},
    endAssistantResponse() {},
    printWelcome() {},
    printInfo() {},
    printError() {},
    close() {},
  }
}

test("retry restores history and dirty state when generation is blocked", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "question")
  runtime.history.push("assistant", "answer")
  const before = runtime.history.snapshot()

  await handleConversationCommand(command("/retry"), {
    runtime,
    tui: fakeTui(),
    listModels: async () => [],
    setActiveModel() {},
    generate: async () => ({ status: "blocked-by-budget" }),
    compact: async () => ({ status: "not-enough-messages" }),
    providerInstructions: "provider help",
  })

  assert.deepEqual(runtime.history.snapshot(), before)
  assert.equal(runtime.sessionDirty, false)
})

test("workspace cancellation keeps the complete runtime state", async (t) => {
  const runtime = createRuntime()
  runtime.history.push("user", "unsaved")
  runtime.markDirty()
  const workspace = await mkdtemp(path.join(tmpdir(), "lamacode-handler-workspace-"))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  spawnSync("git", ["init", "--quiet"], { cwd: workspace })

  await handleContextCommand(command(`/workspace ${workspace}`), runtime, fakeTui("n"))

  assert.equal(runtime.workspace.path, process.cwd())
  assert.deepEqual(runtime.history.snapshot(), [{ role: "user", content: "unsaved" }])
  assert.equal(runtime.sessionDirty, true)
})

test("failed session model validation leaves runtime state untouched", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "current")
  const before = runtime.history.snapshot()
  runtime.sessionStore = {
    ...runtime.sessionStore,
    load: async () => ({
      version: 1,
      name: "saved",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      provider: "ollama",
      model: "missing-model",
      messages: [{ role: "user", content: "saved" }],
      contextPaths: [],
    }),
  }

  await handleSessionCommand(command("/load saved"), {
    runtime,
    tui: fakeTui(),
    listModels: async () => ["model"],
    setActiveModel() {},
  })

  assert.equal(runtime.activeModel, "model")
  assert.deepEqual(runtime.history.snapshot(), before)
})
