import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateTokenBudget,
  estimateMessagesTokens,
  estimateTextTokens,
} from "../src/tokens.js"

test("estimates text tokens conservatively from UTF-8 bytes", () => {
  assert.equal(estimateTextTokens(""), 0)
  assert.equal(estimateTextTokens("abcdef"), 6)
  assert.equal(estimateTextTokens("éé"), 4)
})

test("includes message framing and content in the estimate", () => {
  const estimate = estimateMessagesTokens([
    { role: "system", content: "system" },
    { role: "user", content: "question" },
  ])

  assert.equal(estimate > estimateTextTokens("systemquestion"), true)
})

test("calculates warning and overflow thresholds", () => {
  const normal = calculateTokenBudget(5_000, 8_192, 1_024)
  const warning = calculateTokenBudget(6_000, 8_192, 1_024)
  const overflow = calculateTokenBudget(7_169, 8_192, 1_024)

  assert.equal(normal.inputLimit, 7_168)
  assert.equal(normal.shouldWarn, false)
  assert.equal(warning.shouldWarn, true)
  assert.equal(warning.exceedsLimit, false)
  assert.equal(overflow.exceedsLimit, true)
})
