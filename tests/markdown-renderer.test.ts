import assert from "node:assert/strict"
import { stripVTControlCharacters } from "node:util"
import test from "node:test"
import { MarkdownRenderer, renderMarkdownLine } from "../src/cli/markdown-renderer.js"

test("renders common Markdown without exposing its control markers", () => {
  const heading = stripVTControlCharacters(renderMarkdownLine("## Setup"))
  const list = stripVTControlCharacters(renderMarkdownLine("- Run **npm test** with `tsx`"))
  const link = stripVTControlCharacters(renderMarkdownLine("Read [the docs](https://example.com)."))

  assert.equal(heading, "  Setup")
  assert.equal(list, "  • Run npm test with  tsx ")
  assert.equal(link, "  Read the docs (https://example.com).")
})

test("preserves lines across arbitrary streamed chunks and highlights fenced code", () => {
  let output = ""
  const renderer = new MarkdownRenderer((text) => { output += text })

  renderer.push("# Res")
  assert.equal(output, "")
  renderer.push("ult\n1. First\n```ts\nconst answer")
  assert.match(stripVTControlCharacters(output), /Result\n  1\. First\n$/)
  assert.doesNotMatch(output, /answer/)
  renderer.push(" = 42\n```\nDone")
  renderer.finish()

  const plain = stripVTControlCharacters(output)
  assert.match(plain, /┌─ ts\n/)
  assert.match(plain, /│ const answer = 42\n/)
  assert.match(plain, /└─\n  Done\n$/)
})

test("flushes an unterminated code fence at the end of a response", () => {
  let output = ""
  const renderer = new MarkdownRenderer((text) => { output += text })

  renderer.push("```unknown-language\nraw <value>")
  renderer.finish()

  const plain = stripVTControlCharacters(output)
  assert.match(plain, /┌─ unknown-language\n/)
  assert.match(plain, /│ raw <value>\n/)
  assert.match(plain, /└─\n$/)
})

test("removes terminal control sequences from model output", () => {
  let output = ""
  const renderer = new MarkdownRenderer((text) => { output += text })

  renderer.push("safe\u001b[2J text\rrewrite\u0007\n")
  renderer.finish()

  assert.equal(stripVTControlCharacters(output), "  safe textrewrite\n")
})

test("ignores an isolated empty fence instead of drawing an empty code block", () => {
  let output = ""
  const renderer = new MarkdownRenderer((text) => { output += text })

  renderer.push("```\n")
  renderer.finish()

  assert.equal(output, "")
})
