import assert from "node:assert/strict"
import test from "node:test"
import { compactConversation } from "../src/application/compaction.js"
import { generateResponse, type GenerationCallbacks } from "../src/application/generation.js"
import { Runtime } from "../src/application/runtime.js"
import type { LlmConfig } from "../src/config.js"

const config: LlmConfig = {
  provider: "ollama",
  providerLabel: "Ollama",
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
  contextWindow: 100_000,
  maxOutputTokens: 1_000,
}

function createRuntime(): Runtime {
  return new Runtime({ path: process.cwd(), isGit: true }, "test-model", config)
}

function generationCallbacks(events: string[]): GenerationCallbacks {
  return {
    onBudgetExceeded: () => events.push("blocked"),
    onBudgetWarning: () => events.push("warning"),
    onStart: () => events.push("start"),
    onFirstChunk: () => events.push("first"),
    onChunk: (chunk) => events.push(`chunk:${chunk}`),
    onComplete: () => events.push("complete"),
    onProviderError: () => events.push("error"),
    onFinish: () => events.push("finish"),
  }
}

test("generation reports completion and starts the assistant response on the first chunk", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "question")
  const events: string[] = []

  const result = await generateResponse(runtime, async (_history, onChunk) => {
    onChunk("one")
    onChunk(" two")
    return "one two"
  }, generationCallbacks(events))

  assert.deepEqual(result, { status: "completed" })
  assert.deepEqual(events, ["start", "first", "chunk:one", "chunk: two", "complete", "finish"])
  assert.deepEqual(runtime.history.snapshot().at(-1), { role: "assistant", content: "one two" })
})

test("generation reports provider errors without adding an assistant message", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "question")
  const events: string[] = []

  const result = await generateResponse(runtime, async () => {
    throw new Error("offline")
  }, generationCallbacks(events))

  assert.equal(result.status, "provider-error")
  assert.deepEqual(events, ["start", "error", "finish"])
  assert.deepEqual(runtime.history.snapshot(), [{ role: "user", content: "question" }])
})

test("generation blocks before contacting the provider when the budget is exceeded", async () => {
  const runtime = new Runtime(
    { path: process.cwd(), isGit: true },
    "test-model",
    { ...config, contextWindow: 100, maxOutputTokens: 50 },
  )
  runtime.history.push("user", "large question ".repeat(20))
  const events: string[] = []
  let providerCalled = false

  const result = await generateResponse(runtime, async () => {
    providerCalled = true
    return "response"
  }, generationCallbacks(events))

  assert.deepEqual(result, { status: "blocked-by-budget" })
  assert.equal(providerCalled, false)
  assert.deepEqual(events, ["blocked"])
})

test("compaction keeps the latest turn and pending message while reducing context", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "old question ".repeat(100))
  runtime.history.push("assistant", "old answer ".repeat(100))
  runtime.history.push("user", "recent question")
  runtime.history.push("assistant", "recent answer")
  runtime.history.push("user", "pending question")

  const events: string[] = []
  const result = await compactConversation(runtime, async () => ({
    content: "short summary",
    finishReason: "stop",
  }), {
    onStart: () => events.push("start"),
    onFinish: () => events.push("finish"),
  })

  assert.equal(result.status, "completed")
  assert.equal(runtime.sessionDirty, true)
  assert.deepEqual(events, ["start", "finish"])
  assert.deepEqual(runtime.history.snapshot().slice(-3), [
    { role: "user", content: "recent question" },
    { role: "assistant", content: "recent answer" },
    { role: "user", content: "pending question" },
  ])
})

test("compaction rolls history back when the summary does not reduce context", async () => {
  const runtime = createRuntime()
  runtime.history.push("user", "old question")
  runtime.history.push("assistant", "old answer")
  runtime.history.push("user", "recent question")
  runtime.history.push("assistant", "recent answer")
  const before = runtime.history.snapshot()

  const result = await compactConversation(runtime, async () => ({
    content: "summary that is deliberately much longer than the short original conversation ".repeat(20),
    finishReason: "stop",
  }), { onStart() {}, onFinish() {} })

  assert.equal(result.status, "not-reduced")
  assert.deepEqual(runtime.history.snapshot(), before)
  assert.equal(runtime.sessionDirty, false)
})
