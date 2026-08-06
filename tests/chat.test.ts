import assert from "node:assert/strict"
import test from "node:test"
import { buildMessages } from "../src/chat.js"
import { createHistory } from "../src/history.js"

test("adds file context to the last user message without adding a system role", () => {
  const history = createHistory("trusted system prompt")
  history.push("user", "question")

  const messages = buildMessages(history, "untrusted file context")

  assert.deepEqual(messages, [
    { role: "system", content: "trusted system prompt" },
    { role: "user", content: "question\n\nuntrusted file context" },
  ])
  assert.deepEqual(history.messages, [
    { role: "system", content: "trusted system prompt" },
    { role: "user", content: "question" },
  ])
})
