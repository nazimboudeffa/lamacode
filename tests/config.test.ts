import assert from "node:assert/strict"
import test from "node:test"
import { resolveConfig } from "../src/config.js"

test("resolves and validates token limits from the environment", (t) => {
  const previousContext = process.env.LLM_CONTEXT_SIZE
  const previousOutput = process.env.LLM_MAX_OUTPUT_TOKENS
  t.after(() => {
    if (previousContext === undefined) delete process.env.LLM_CONTEXT_SIZE
    else process.env.LLM_CONTEXT_SIZE = previousContext
    if (previousOutput === undefined) delete process.env.LLM_MAX_OUTPUT_TOKENS
    else process.env.LLM_MAX_OUTPUT_TOKENS = previousOutput
  })

  process.env.LLM_CONTEXT_SIZE = "16384"
  process.env.LLM_MAX_OUTPUT_TOKENS = "2048"
  const config = resolveConfig("ollama")
  assert.equal(config.contextWindow, 16_384)
  assert.equal(config.maxOutputTokens, 2_048)

  process.env.LLM_CONTEXT_SIZE = "invalid"
  assert.throws(() => resolveConfig("ollama"), /LLM_CONTEXT_SIZE/)

  process.env.LLM_CONTEXT_SIZE = "1e100"
  assert.throws(() => resolveConfig("ollama"), /LLM_CONTEXT_SIZE/)

  process.env.LLM_CONTEXT_SIZE = "1024"
  process.env.LLM_MAX_OUTPUT_TOKENS = "1024"
  assert.throws(() => resolveConfig("ollama"), /doit être inférieur/)
})
