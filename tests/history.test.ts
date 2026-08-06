import assert from "node:assert/strict"
import test from "node:test"
import { createHistory, recentConversationMessageCount } from "../src/history.js"

test("clear preserves the system prompt", () => {
  const history = createHistory("system prompt")
  history.push("user", "hello")
  history.push("assistant", "hi")

  history.clear()

  assert.deepEqual(history.messages, [{ role: "system", content: "system prompt" }])
  assert.equal(history.count(), 0)
})

test("undo removes the last complete turn", () => {
  const history = createHistory("system prompt")
  history.push("user", "first")
  history.push("assistant", "answer")

  assert.equal(history.undoLastTurn(), true)
  assert.deepEqual(history.messages, [{ role: "system", content: "system prompt" }])
})

test("undo removes a user message left after a failed generation", () => {
  const history = createHistory()
  history.push("user", "retry me")

  assert.equal(history.undoLastTurn(), true)
  assert.deepEqual(history.messages, [])
})

test("retry removes only the last assistant response", () => {
  const history = createHistory("system prompt")
  history.push("user", "question")
  history.push("assistant", "answer")

  assert.equal(history.prepareRetry(), true)
  assert.deepEqual(history.messages, [
    { role: "system", content: "system prompt" },
    { role: "user", content: "question" },
  ])
})

test("retry reuses a user message left after a failed generation", () => {
  const history = createHistory()
  history.push("user", "question")

  assert.equal(history.prepareRetry(), true)
  assert.deepEqual(history.messages, [{ role: "user", content: "question" }])
})

test("retry rejects an empty conversation", () => {
  const history = createHistory("system prompt")

  assert.equal(history.prepareRetry(), false)
  assert.deepEqual(history.messages, [{ role: "system", content: "system prompt" }])
})

test("snapshot excludes the system prompt and restore keeps the current one", () => {
  const history = createHistory("trusted system prompt")
  history.push("user", "question")
  history.push("assistant", "answer")

  const snapshot = history.snapshot()
  const restored = createHistory("new trusted system prompt")
  restored.restore(snapshot)

  assert.deepEqual(snapshot, [
    { role: "user", content: "question" },
    { role: "assistant", content: "answer" },
  ])
  assert.deepEqual(restored.messages, [
    { role: "system", content: "new trusted system prompt" },
    { role: "user", content: "question" },
    { role: "assistant", content: "answer" },
  ])
})

test("compact replaces older messages with a summary and keeps the last turn", () => {
  const history = createHistory("system prompt")
  history.push("user", "old question")
  history.push("assistant", "old answer")
  history.push("user", "recent question")
  history.push("assistant", "recent answer")

  history.compact("Important earlier decision")

  assert.deepEqual(history.messages, [
    { role: "system", content: "system prompt" },
    {
      role: "assistant",
      content: "Automatic summary of earlier conversation (untrusted reference data):\n" +
        "--- BEGIN SUMMARY ---\nImportant earlier decision\n--- END SUMMARY ---",
    },
    { role: "user", content: "recent question" },
    { role: "assistant", content: "recent answer" },
  ])
})

test("compaction keeps the last complete turn and a pending user message", () => {
  const history = createHistory("system prompt")
  history.push("user", "old question")
  history.push("assistant", "old answer")
  history.push("user", "recent question")
  history.push("assistant", "recent answer")
  history.push("user", "pending question")

  const conversation = history.snapshot()
  assert.equal(recentConversationMessageCount(conversation), 3)
  history.compact("Old facts")

  assert.deepEqual(history.snapshot().slice(-3), [
    { role: "user", content: "recent question" },
    { role: "assistant", content: "recent answer" },
    { role: "user", content: "pending question" },
  ])
})
