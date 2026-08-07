import { compactConversation } from "../application/compaction.js"
import { generateResponse } from "../application/generation.js"
import { Runtime } from "../application/runtime.js"
import { createChatClient } from "../chat.js"
import { resolveConfig, resolveProvider } from "../config.js"
import { extractFileReferences } from "../context.js"
import { defaultWorkspace } from "../workspace.js"
import { createCommandRegistry, formatCommandHelp, parseCommand } from "./command-registry.js"
import { handleConversationCommand } from "./commands/conversation.js"
import { handleContextCommand } from "./commands/context.js"
import { handleSessionCommand } from "./commands/sessions.js"
import { selectModel, selectProvider, selectWorkspace } from "./selectors.js"
import { createTUI, type TUI } from "./tui.js"

export async function runCli(): Promise<number> {
  const tui = createTUI()
  try {
    return await runInteractiveCli(tui)
  } finally {
    tui.close()
  }
}

async function runInteractiveCli(tui: TUI): Promise<number> {
  const workspace = await selectWorkspace(tui, defaultWorkspace())
  if (!workspace.isGit) {
    tui.printInfo("Attention : ce workspace n'est pas un dépôt Git ; les règles .gitignore ne s'appliquent pas.")
  }
  const provider = await selectProvider(tui, resolveProvider())
  const config = resolveConfig(provider)
  const chat = createChatClient(config)
  const providerInstructions = config.provider === "ollama"
    ? "Vérifie qu'Ollama est lancé avec `ollama serve` et qu'un modèle est installé avec `ollama pull <modèle>`."
    : "Vérifie que LM Studio est lancé, qu'un modèle est chargé et que le serveur local est activé."

  const activeModel = await connectProvider(tui, config, chat, providerInstructions)
  if (!activeModel) return 1
  const runtime = new Runtime(workspace, activeModel, config)
  tui.printWelcome({
    provider: config.providerLabel,
    model: activeModel,
    server: config.baseURL,
    workspace: workspace.path,
    isGit: workspace.isGit,
    contextWindow: config.contextWindow,
    maxOutputTokens: config.maxOutputTokens,
  })

  const generate = () => generateResponse(runtime, chat.streamChat, {
    onBudgetExceeded(estimated, limit) {
      tui.printError(
        `Contexte trop volumineux : ~${estimated} tokens pour une limite de ` +
        `${limit}. Utilise /compact, /remove, /undo ou /clear.`,
      )
    },
    onBudgetWarning(percent, estimated, limit) {
      tui.printInfo(`Attention : contexte estimé à ${percent}% (~${estimated}/${limit} tokens).`)
    },
    onStart: tui.startSpinner,
    onFirstChunk: tui.beginAssistantResponse,
    onChunk: tui.printAssistantChunk,
    onComplete: tui.endAssistantResponse,
    onProviderError(error) {
      tui.printError(`\nErreur : ${error instanceof Error ? error.message : String(error)}`)
      tui.printError(providerInstructions)
    },
    onFinish: tui.stopSpinner,
  })
  const compact = () => compactConversation(runtime, chat.completeChat, {
    onStart: tui.startSpinner,
    onFinish: tui.stopSpinner,
  })
  const registry = createCommandRegistry(config.providerLabel)

  while (true) {
    const input = await tui.prompt()
    if (!input) continue
    const parsed = parseCommand(input, registry)
    if (parsed?.command.name === "exit") {
      tui.printInfo("Au revoir !")
      return 0
    }
    if (parsed?.command.name === "help") {
      tui.printInfo(formatCommandHelp(registry))
      continue
    }
    if (parsed) {
      const handled = await handleConversationCommand(parsed, {
        runtime,
        tui,
        listModels: chat.listModels,
        setActiveModel: chat.setActiveModel,
        generate,
        compact,
        providerInstructions,
      }) || await handleContextCommand(parsed, runtime, tui) || await handleSessionCommand(parsed, {
        runtime,
        tui,
        listModels: chat.listModels,
        setActiveModel: chat.setActiveModel,
      })
      if (handled) continue
    }

    await addInlineReferences(input, runtime, tui)
    runtime.history.push("user", input)
    runtime.markDirty()
    await generate()
  }
}

async function connectProvider(
  tui: TUI,
  config: ReturnType<typeof resolveConfig>,
  chat: ReturnType<typeof createChatClient>,
  providerInstructions: string,
): Promise<string | undefined> {
  try {
    const models = await chat.listModels()
    if (models.length === 0) {
      tui.printError(`Aucun modèle disponible dans ${config.providerLabel}.\n  → ${providerInstructions}`)
      return undefined
    }
    if (config.defaultModel && !models.includes(config.defaultModel)) {
      tui.printInfo(
        `Le modèle configuré "${config.defaultModel}" n'est pas disponible. ` +
        "Sélectionne un autre modèle.",
      )
    }
    const activeModel = await selectModel(tui, models, config.defaultModel)
    chat.setActiveModel(activeModel)
    return activeModel
  } catch (error) {
    tui.printError(
      `Impossible de joindre ${config.providerLabel} sur ${config.baseURL}\n` +
      `  → ${providerInstructions}\n` +
      `  → ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
}

async function addInlineReferences(input: string, runtime: Runtime, tui: TUI): Promise<void> {
  let referencesValid = true
  try {
    const files = await runtime.fileContext.addMany(extractFileReferences(input))
    for (const file of files) {
      runtime.markDirty()
      tui.printInfo(`Contexte ajouté : ${file.path} (${file.bytes} octets)`)
    }
  } catch (error) {
    referencesValid = false
    tui.printError(`Référence de fichier ignorée : ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!referencesValid) {
    tui.printInfo("Le message sera envoyé sans ajouter ces références au contexte.")
  }
}
