import { config } from "./config.js"
import { streamChat, listModels } from "./chat.js"
import { createHistory } from "./history.js"
import { createTUI } from "./tui.js"

const COMMANDS: Record<string, string> = {
  "/exit": "quitter lamacode",
  "/clear": "effacer l'historique de conversation",
  "/models": "lister les modèles disponibles dans LM Studio",
  "/help": "afficher cette aide",
}

async function main() {
  const tui = createTUI()
  const history = createHistory("You are a helpful local AI assistant.")

  tui.printInfo(`
╦  ╔═╗╔╦╗╔═╗╔═╗╔═╗╔╦╗╔═╗
║  ╠═╣║║║╠═╣║  ║ ║ ║║╣ 
╩═╝╩ ╩╩ ╩╩ ╩╚═╝╚═╝═╩╝╚═╝
  Local AI — powered by LM Studio
  Modèle : ${config.defaultModel}
  Serveur : ${config.baseURL}
  Tape /help pour les commandes.
`)

  while (true) {
    const input = await tui.prompt()
    if (!input) continue

    if (input === "/exit") {
      tui.printInfo("Au revoir !")
      tui.close()
      break
    }

    if (input === "/clear") {
      history.clear()
      tui.printInfo("Historique effacé.")
      continue
    }

    if (input === "/models") {
      try {
        const models = await listModels()
        tui.printInfo(`Modèles disponibles :\n${models.map((m) => `  • ${m}`).join("\n")}`)
      } catch {
        tui.printError("Impossible de récupérer les modèles. LM Studio est-il lancé ?")
      }
      continue
    }

    if (input === "/help") {
      tui.printInfo(
        Object.entries(COMMANDS)
          .map(([cmd, desc]) => `  ${cmd.padEnd(12)} ${desc}`)
          .join("\n"),
      )
      continue
    }

    history.push("user", input)
    process.stdout.write("\nlamacode > ")

    try {
      const response = await streamChat(history, (chunk) => tui.printChunk(chunk))
      process.stdout.write("\n")
      history.push("assistant", response)
    } catch (err) {
      tui.printError(`\nErreur : ${err instanceof Error ? err.message : String(err)}`)
      tui.printError("Vérifie que LM Studio est lancé et qu'un modèle est chargé.")
    }
  }
}

main()
