import * as readline from "node:readline"
import chalk from "chalk"

export function createTUI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // Permet de capturer Ctrl+C proprement
  rl.on("SIGINT", () => {
    console.log(chalk.cyan("\nAu revoir !"))
    process.exit(0)
  })

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let spinnerTimer: NodeJS.Timeout | null = null
  let spinnerFrame = 0

  return {
    ask(label: string): Promise<string> {
      return new Promise((resolve) => {
        rl.question(chalk.green(label), (input) => resolve(input.trim()))
      })
    },
    prompt(): Promise<string> {
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
    stopSpinner() {
      if (spinnerTimer) {
        clearInterval(spinnerTimer)
        spinnerTimer = null
        process.stdout.write(`\r${" ".repeat(25)}\r`)
      }
    },
    printChunk(text: string) {
      process.stdout.write(chalk.white(text))
    },
    printInfo(msg: string) {
      console.log(chalk.cyan(msg))
    },
    printError(msg: string) {
      console.error(chalk.red(msg))
    },
    close() {
      rl.close()
    },
  }
}
