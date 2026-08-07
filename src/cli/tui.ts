import * as readline from "node:readline"
import chalk from "chalk"
import { MarkdownRenderer } from "./markdown-renderer.js"

export type WelcomeDetails = {
  provider: string
  model: string
  server: string
  workspace: string
  isGit: boolean
  contextWindow: number
  maxOutputTokens: number
}

export type TUI = {
  ask: (label: string) => Promise<string>
  prompt: () => Promise<string>
  startSpinner: () => void
  stopSpinner: () => void
  beginAssistantResponse: () => void
  printAssistantChunk: (text: string) => void
  endAssistantResponse: () => void
  printWelcome: (details: WelcomeDetails) => void
  printInfo: (message: string) => void
  printError: (message: string) => void
  close: () => void
}

export function createTUI(): TUI {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  rl.on("SIGINT", () => {
    console.log(chalk.cyan("\nAu revoir !"))
    process.exit(0)
  })

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let spinnerTimer: NodeJS.Timeout | null = null
  let spinnerFrame = 0
  let markdown: MarkdownRenderer | undefined
  const stopSpinner = () => {
    if (spinnerTimer) {
      clearInterval(spinnerTimer)
      spinnerTimer = null
      process.stdout.write(`\r${" ".repeat(25)}\r`)
    }
  }

  return {
    ask(label) {
      return new Promise((resolve) => {
        rl.question(`${chalk.cyan("  ◇")} ${chalk.bold(label)}`, (input) => resolve(input.trim()))
      })
    },
    prompt() {
      return new Promise((resolve) => {
        rl.question(`\n${chalk.bold.green("  YOU")} ${chalk.dim("›")} `, (input) => resolve(input.trim()))
      })
    },
    startSpinner() {
      spinnerFrame = 0
      process.stdout.write("\n")
      spinnerTimer = setInterval(() => {
        process.stdout.write(chalk.dim(`\r  ${spinnerFrames[spinnerFrame % spinnerFrames.length]} génération…`))
        spinnerFrame++
      }, 80)
    },
    stopSpinner,
    beginAssistantResponse() {
      stopSpinner()
      process.stdout.write(`${chalk.bold.cyan("  LAMACODE")} ${chalk.dim("›")}\n`)
      markdown = new MarkdownRenderer((text) => process.stdout.write(text))
    },
    printAssistantChunk(text) {
      markdown?.push(text)
    },
    endAssistantResponse() {
      markdown?.finish()
      markdown = undefined
      process.stdout.write(chalk.dim("  ────────────────────────────────────────\n"))
    },
    printWelcome(details) {
      const workspace = `${details.workspace}${details.isGit ? "" : " (non Git)"}`
      console.log(`
${chalk.bold.cyan("  L A M A C O D E")}  ${chalk.dim("/ l'assistant local pour le code")}
${chalk.dim("  ────────────────────────────────────────")}
  ${chalk.dim("FOURNISSEUR".padEnd(12))}${details.provider}
  ${chalk.dim("MODÈLE".padEnd(12))}${chalk.bold(details.model)}
  ${chalk.dim("SERVEUR".padEnd(12))}${details.server}
  ${chalk.dim("WORKSPACE".padEnd(12))}${workspace}
  ${chalk.dim("CONTEXTE".padEnd(12))}${details.contextWindow} tokens (${details.maxOutputTokens} réservés à la réponse)
${chalk.dim("  ────────────────────────────────────────")}
  ${chalk.cyan("/help")} liste les commandes  ${chalk.dim("·")}  ${chalk.cyan("@fichier")} ajoute le contexte
`)
    },
    printInfo(message) {
      console.log(formatNotice(message, chalk.cyan("◆")))
    },
    printError(message) {
      console.error(formatNotice(message, chalk.red("×"), chalk.red))
    },
    close() {
      rl.close()
    },
  }
}

function formatNotice(message: string, marker: string, style = chalk.cyan): string {
  return message.split("\n").map((line, index) => {
    if (line.trim() === "") return ""
    const prefix = index === 0 ? `  ${marker} ` : "    "
    return `${prefix}${style(line)}`
  }).join("\n")
}

export function reportFatalError(error: unknown): void {
  console.error(chalk.red(`Erreur fatale : ${error instanceof Error ? error.message : String(error)}`))
}
