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

async function selectModel(
  tui: ReturnType<typeof createTUI>,
  models: string[],
  preferredModel?: string,
): Promise<string> {
  const defaultIndex = Math.max(models.indexOf(preferredModel ?? ""), 0)
  tui.printInfo(`\nChoisis un modèle :\n${models.map((model, index) => `  ${index + 1}. ${model}`).join("\n")}`)

  while (true) {
    const choice = await tui.ask(`Modèle [${defaultIndex + 1}] > `)
    if (!choice) return models[defaultIndex]

    const selectedIndex = Number(choice) - 1
    if (Number.isInteger(selectedIndex) && models[selectedIndex]) return models[selectedIndex]
    if (models.includes(choice)) return choice
    tui.printError(`Choix invalide. Saisis un nombre entre 1 et ${models.length}, ou le nom exact du modèle.`)
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
    "/model": "changer de modèle actif",
    "/status": "afficher la configuration et l'état de la conversation",
    "/retry": "régénérer la dernière réponse",
    "/undo": "supprimer le dernier tour de conversation",
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
        "Sélectionne un autre modèle.",
      )
    }

    activeModel = await selectModel(tui, models, config.defaultModel)
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

  async function generateResponse(): Promise<void> {
    let firstChunk = true
    try {
      tui.startSpinner()
      const response = await streamChat(history, (chunk) => {
        if (firstChunk) {
          tui.stopSpinner()
          process.stdout.write(chalk.bold.cyan("lamacode") + chalk.cyan(" > "))
          firstChunk = false
        }
        tui.printChunk(chunk)
      })
      history.push("assistant", response)
      process.stdout.write("\n")
    } catch (err) {
      tui.printError(`\nErreur : ${err instanceof Error ? err.message : String(err)}`)
      tui.printError(providerInstructions)
    } finally {
      tui.stopSpinner()
    }
  }

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

    if (input === "/model") {
      try {
        const models = await listModels()
        if (models.length === 0) {
          tui.printError(`Aucun modèle disponible dans ${config.providerLabel}.`)
          continue
        }
        activeModel = await selectModel(tui, models, activeModel)
        setActiveModel(activeModel)
        tui.printInfo(`Modèle actif : ${activeModel}`)
      } catch (err) {
        tui.printError(
          `Impossible de changer de modèle : ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      continue
    }

    if (input === "/status") {
      tui.printInfo(
        `Fournisseur : ${config.providerLabel}\n` +
        `Modèle      : ${activeModel}\n` +
        `Serveur     : ${config.baseURL}\n` +
        `Messages    : ${history.count()}`,
      )
      continue
    }

    if (input === "/undo") {
      tui.printInfo(history.undoLastTurn()
        ? "Dernier tour supprimé."
        : "Aucun tour de conversation à supprimer.")
      continue
    }

    if (input === "/retry") {
      if (!history.prepareRetry()) {
        tui.printInfo("Aucun message utilisateur à régénérer.")
        continue
      }
      await generateResponse()
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
    await generateResponse()
  }
}

main()
