import { resolveConfig, resolveProvider, type LlmProvider } from "./config.js"
import { createChatClient } from "./chat.js"
import { createHistory } from "./history.js"
import { createTUI } from "./tui.js"
import chalk from "chalk"

async function selectProvider(
  tui: ReturnType<typeof createTUI>,
  defaultProvider: LlmProvider,
): Promise<LlmProvider> {
  tui.printInfo("\nChoisis le fournisseur local :\n  1. LM Studio\n  2. Ollama")

  while (true) {
    const defaultChoice = defaultProvider === "lmstudio" ? "1" : "2"
    const choice = (await tui.ask(`Fournisseur [${defaultChoice}] > `)).toLowerCase()
    if (!choice) return defaultProvider
    if (choice === "1" || choice === "lmstudio" || choice === "lm studio") return "lmstudio"
    if (choice === "2" || choice === "ollama") return "ollama"
    tui.printError("Choix invalide. Saisis 1 pour LM Studio ou 2 pour Ollama.")
  }
}

async function main() {
  const tui = createTUI()
  const provider = await selectProvider(tui, resolveProvider())
  const config = resolveConfig(provider)
  const { streamChat, listModels, setActiveModel } = createChatClient(config)
  const history = createHistory("You are a helpful local AI assistant.")
  const commands: Record<string, string> = {
    "/exit": "quitter lamacode",
    "/clear": "effacer l'historique de conversation",
    "/models": `lister les modèles disponibles dans ${config.providerLabel}`,
    "/help": "afficher cette aide",
  }
  const providerInstructions = config.provider === "ollama"
    ? "Vérifie qu'Ollama est lancé avec `ollama serve` et qu'un modèle est installé avec `ollama pull <modèle>`."
    : "Vérifie que LM Studio est lancé, qu'un modèle est chargé et que le serveur local est activé."

  // Vérifie que le fournisseur est accessible et expose au moins un modèle.
  let activeModel: string
  try {
    const models = await listModels()
    if (models.length === 0) {
      tui.printError(
        `Aucun modèle disponible dans ${config.providerLabel}.\n` +
        `  → ${providerInstructions}`,
      )
      process.exit(1)
    }

    if (config.defaultModel && !models.includes(config.defaultModel)) {
      tui.printInfo(
        `Le modèle configuré "${config.defaultModel}" n'est pas disponible. ` +
        `Utilisation de "${models[0]}".`,
      )
    }

    activeModel = config.defaultModel && models.includes(config.defaultModel)
      ? config.defaultModel
      : models[0]
    setActiveModel(activeModel)
  } catch (err) {
    tui.printError(
      `Impossible de joindre ${config.providerLabel} sur ${config.baseURL}\n` +
      `  → ${providerInstructions}\n` +
      `  → ${err instanceof Error ? err.message : String(err)}`,
    )
    process.exit(1)
  }

  tui.printInfo(`
╦  ╔═╗╔╦╗╔═╗╔═╗╔═╗╔╦╗╔═╗
║  ╠═╣║║║╠═╣║  ║ ║ ║║╣ 
╩═╝╩ ╩╩ ╩╩ ╩╚═╝╚═╝═╩╝╚═╝
  Local AI — powered by ${config.providerLabel}
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
        tui.printError(`Impossible de récupérer les modèles. ${providerInstructions}`)
      }
      continue
    }

    if (input === "/help") {
      tui.printInfo(
        Object.entries(commands)
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
      tui.printError(providerInstructions)
    }
  }
}

main()
