import { config } from "./config.js"
import { streamChat, listModels, setActiveModel } from "./chat.js"
import { createHistory } from "./history.js"
import { createTUI } from "./tui.js"
import chalk from "chalk"

const COMMANDS: Record<string, string> = {
  "/exit": "quitter lamacode",
  "/clear": "effacer l'historique de conversation",
  "/models": "lister les modèles disponibles dans LM Studio",
  "/help": "afficher cette aide",
}

async function main() {
  const tui = createTUI()
  const history = createHistory("You are a helpful local AI assistant.")

  // Vérifie que LM Studio est accessible et qu'un modèle est chargé
  let activeModel: string
  try {
    const models = await listModels()
    if (models.length === 0) {
      tui.printError(
        "Aucun modèle chargé dans LM Studio.\n" +
        "  → Lance LM Studio et charge un modèle via l'onglet Developer ou avec : lms load <modèle>",
      )
      process.exit(1)
    }
    // Utilise le modèle configuré s'il est disponible, sinon prend le premier chargé
    activeModel = models.includes(config.defaultModel) ? config.defaultModel : models[0]
    setActiveModel(activeModel)
  } catch {
    tui.printError(
      `Impossible de joindre LM Studio sur ${config.baseURL}\n` +
      "  → Vérifie que LM Studio est lancé et que le serveur local est activé.",
    )
    process.exit(1)
  }

  tui.printInfo(`
╦  ╔═╗╔╦╗╔═╗╔═╗╔═╗╔╦╗╔═╗
║  ╠═╣║║║╠═╣║  ║ ║ ║║╣ 
╩═╝╩ ╩╩ ╩╩ ╩╚═╝╚═╝═╩╝╚═╝
  Local AI — powered by LM Studio
  Modèle : ${activeModel}
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

    try {
      tui.startSpinner()
      let firstChunk = true
      const response = await streamChat(history, (chunk) => {
        if (firstChunk) {
          tui.stopSpinner()
          process.stdout.write(chalk.bold.cyan("lamacode") + chalk.cyan(" > "))
          firstChunk = false
        }
        tui.printChunk(chunk)
      })
      tui.stopSpinner()
      process.stdout.write("\n")
      history.push("assistant", response)
    } catch (err) {
      tui.printError(`\nErreur : ${err instanceof Error ? err.message : String(err)}`)
      tui.printError("Vérifie que LM Studio est lancé et qu'un modèle est chargé.")
    }
  }
}

main()
