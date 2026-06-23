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

  return {
    prompt(): Promise<string> {
      return new Promise((resolve) => {
        rl.question(chalk.green("\nyou > "), (input) => resolve(input.trim()))
      })
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
