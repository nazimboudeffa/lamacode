import * as readline from "node:readline"
import chalk from "chalk"

export type TUI = {
  ask: (label: string) => Promise<string>
  prompt: () => Promise<string>
  startSpinner: () => void
  stopSpinner: () => void
  beginAssistantResponse: () => void
  printAssistantChunk: (text: string) => void
  endAssistantResponse: () => void
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
        rl.question(chalk.green(label), (input) => resolve(input.trim()))
      })
    },
    prompt() {
      return new Promise((resolve) => {
        rl.question(chalk.green("\nyou > "), (input) => resolve(input.trim()))
      })
    },
    startSpinner() {
      spinnerFrame = 0
      process.stdout.write("\n")
      spinnerTimer = setInterval(() => {
        process.stdout.write(chalk.dim(`\r${spinnerFrames[spinnerFrame % spinnerFrames.length]} réflexion en cours…`))
        spinnerFrame++
      }, 80)
    },
    stopSpinner,
    beginAssistantResponse() {
      stopSpinner()
      process.stdout.write(chalk.bold.cyan("lamacode") + chalk.cyan(" > "))
    },
    printAssistantChunk(text) {
      process.stdout.write(chalk.white(text))
    },
    endAssistantResponse() {
      process.stdout.write("\n")
    },
    printInfo(message) {
      console.log(chalk.cyan(message))
    },
    printError(message) {
      console.error(chalk.red(message))
    },
    close() {
      rl.close()
    },
  }
}

export function reportFatalError(error: unknown): void {
  console.error(chalk.red(`Erreur fatale : ${error instanceof Error ? error.message : String(error)}`))
}
