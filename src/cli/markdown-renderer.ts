import chalk from "chalk"
import hljs from "highlight.js"
import { stripVTControlCharacters } from "node:util"

type Write = (text: string) => void

export class MarkdownRenderer {
  private pending = ""
  private codeLanguage: string | undefined
  private codeLines: string[] = []

  constructor(private readonly write: Write) {}

  push(chunk: string): void {
    this.pending += chunk
    let newline = this.pending.indexOf("\n")
    while (newline !== -1) {
      const line = sanitizeTerminalText(this.pending.slice(0, newline).replace(/\r$/, ""))
      this.pending = this.pending.slice(newline + 1)
      this.renderLine(line)
      newline = this.pending.indexOf("\n")
    }
  }

  finish(): void {
    if (this.pending) {
      this.renderLine(sanitizeTerminalText(this.pending.replace(/\r$/, "")))
      this.pending = ""
    }
    if (this.codeLanguage !== undefined) this.renderCodeBlock()
  }

  private renderLine(line: string): void {
    const fence = line.match(/^\s*```\s*([^\s`]*)?.*$/)
    if (fence) {
      if (this.codeLanguage !== undefined) {
        this.renderCodeBlock()
      } else {
        this.codeLanguage = fence[1]?.toLowerCase() || "code"
      }
      return
    }

    if (this.codeLanguage !== undefined) {
      this.codeLines.push(line)
      return
    }

    this.write(`${renderMarkdownLine(line)}\n`)
  }

  private renderCodeBlock(): void {
    const language = this.codeLanguage ?? "code"
    const code = this.codeLines.join("\n")
    if (!code) {
      this.codeLanguage = undefined
      this.codeLines = []
      return
    }
    const rendered = highlightCode(code, language)

    this.write(chalk.dim(`  ┌─ ${language}\n`))
    for (const line of rendered.split("\n")) {
      this.write(`${chalk.dim("  │")} ${line}\n`)
    }
    this.write(chalk.dim("  └─\n"))
    this.codeLanguage = undefined
    this.codeLines = []
  }
}

export function renderMarkdownLine(line: string): string {
  if (!line) return ""

  const heading = line.match(/^(#{1,6})\s+(.+)$/)
  if (heading) return `  ${chalk.bold.cyan(renderInline(heading[2]))}`

  const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
  if (unordered) return `  ${chalk.cyan("•")} ${renderInline(unordered[1])}`

  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
  if (ordered) return `  ${chalk.cyan(`${ordered[1]}.`)} ${renderInline(ordered[2])}`

  const quote = line.match(/^\s*>\s?(.*)$/)
  if (quote) return `  ${chalk.dim("│")} ${chalk.italic(renderInline(quote[1]))}`

  if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
    return chalk.dim("  ────────────────────────────────────────")
  }

  return `  ${renderInline(line)}`
}

function renderInline(text: string): string {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^\s)]+\))/g
  return text.split(tokens).filter((part) => part !== undefined).map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return chalk.bgBlackBright.cyan(` ${part.slice(1, -1)} `)
    }
    if ((part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))) {
      return chalk.bold(part.slice(2, -2))
    }
    if ((part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))) {
      return chalk.italic(part.slice(1, -1))
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return `${chalk.underline(link[1])} ${chalk.dim(`(${link[2]})`)}`
    return part
  }).join("")
}

function sanitizeTerminalText(text: string): string {
  return stripVTControlCharacters(text)
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
}

function highlightCode(code: string, language: string): string {
  try {
    const html = hljs.getLanguage(language)
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value
    return highlightedHtmlToAnsi(html)
  } catch {
    return code
  }
}

function highlightedHtmlToAnsi(html: string): string {
  const stack: Array<(text: string) => string> = []
  return html.split(/(<span class="[^"]+">|<\/span>)/).map((part) => {
    const opening = part.match(/^<span class="([^"]+)">$/)
    if (opening) {
      stack.push(highlightStyle(opening[1]))
      return ""
    }
    if (part === "</span>") {
      stack.pop()
      return ""
    }
    const decoded = decodeHighlightEntities(part)
    return stack.reduceRight((text, style) => style(text), decoded)
  }).join("")
}

function highlightStyle(classes: string): (text: string) => string {
  if (/\bhljs-(comment|quote)\b/.test(classes)) return chalk.dim
  if (/\bhljs-(keyword|selector-tag|template-tag|type)\b/.test(classes)) return chalk.blue.bold
  if (/\bhljs-(string|regexp|addition)\b/.test(classes)) return chalk.green
  if (/\bhljs-(number|literal)\b/.test(classes)) return chalk.cyan
  if (/\bhljs-(title|section|function)\b/.test(classes)) return chalk.yellow
  if (/\bhljs-(built_in|meta|symbol|bullet|link)\b/.test(classes)) return chalk.magenta
  if (/\bhljs-(deletion|error)\b/.test(classes)) return chalk.red
  return (text) => text
}

function decodeHighlightEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
}
