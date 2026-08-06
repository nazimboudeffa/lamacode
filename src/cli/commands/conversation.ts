import type { CompactionResult } from "../../application/compaction.js"
import type { GenerationResult } from "../../application/generation.js"
import type { Runtime } from "../../application/runtime.js"
import type { ParsedCommand } from "../command-registry.js"
import { selectModel } from "../selectors.js"
import type { TUI } from "../tui.js"

type ConversationDependencies = {
  runtime: Runtime
  tui: TUI
  listModels: () => Promise<string[]>
  setActiveModel: (model: string) => void
  generate: () => Promise<GenerationResult>
  compact: () => Promise<CompactionResult>
  providerInstructions: string
}

export async function handleConversationCommand(
  parsed: ParsedCommand,
  dependencies: ConversationDependencies,
): Promise<boolean> {
  const { runtime, tui, listModels, setActiveModel } = dependencies
  switch (parsed.command.name) {
    case "clear":
      runtime.history.clear()
      runtime.markDirty()
      tui.printInfo("Historique effacé.")
      return true
    case "models":
      try {
        const models = await listModels()
        tui.printInfo(`Modèles disponibles :\n${models.map((model) => `  • ${model}`).join("\n")}`)
      } catch {
        tui.printError(`Impossible de récupérer les modèles. ${dependencies.providerInstructions}`)
      }
      return true
    case "model":
      try {
        const models = await listModels()
        if (models.length === 0) {
          tui.printError(`Aucun modèle disponible dans ${runtime.config.providerLabel}.`)
          return true
        }
        runtime.activeModel = await selectModel(tui, models, runtime.activeModel)
        setActiveModel(runtime.activeModel)
        runtime.markDirty()
        tui.printInfo(`Modèle actif : ${runtime.activeModel}`)
      } catch (error) {
        tui.printError(`Impossible de changer de modèle : ${error instanceof Error ? error.message : String(error)}`)
      }
      return true
    case "status": {
      const budget = runtime.currentTokenBudget()
      tui.printInfo(
        `Fournisseur : ${runtime.config.providerLabel}\n` +
        `Modèle      : ${runtime.activeModel}\n` +
        `Serveur     : ${runtime.config.baseURL}\n` +
        `Workspace   : ${runtime.workspace.path}${runtime.workspace.isGit ? "" : " (non Git)"}\n` +
        `Messages    : ${runtime.history.count()}\n` +
        `Contexte    : ${runtime.fileContext.list().length} fichier(s), ${runtime.fileContext.totalBytes()} octets\n` +
        `Tokens      : ~${budget.estimatedInputTokens}/${budget.inputLimit} entrée ` +
        `(${budget.usagePercent}%, fenêtre ${budget.contextWindow})\n` +
        `Session     : ${runtime.sessionLabel()}`,
      )
      return true
    }
    case "compact":
      printCompactionResult(tui, await dependencies.compact())
      return true
    case "undo": {
      const removed = runtime.history.undoLastTurn()
      if (removed) runtime.markDirty()
      tui.printInfo(removed ? "Dernier tour supprimé." : "Aucun tour de conversation à supprimer.")
      return true
    }
    case "retry": {
      const conversationBeforeRetry = runtime.history.snapshot()
      const dirtyBeforeRetry = runtime.sessionDirty
      if (!runtime.history.prepareRetry()) {
        tui.printInfo("Aucun message utilisateur à régénérer.")
        return true
      }
      const result = await dependencies.generate()
      if (result.status !== "blocked-by-budget") runtime.markDirty()
      else {
        runtime.history.restore(conversationBeforeRetry)
        runtime.sessionDirty = dirtyBeforeRetry
      }
      return true
    }
    default:
      return false
  }
}

function printCompactionResult(tui: TUI, result: CompactionResult): void {
  switch (result.status) {
    case "not-enough-messages":
      tui.printInfo("Pas assez de messages à compacter.")
      break
    case "no-older-messages":
      tui.printInfo("Aucun ancien message à compacter.")
      break
    case "blocked-by-budget":
      tui.printError(
        `Les anciens messages sont trop volumineux pour être résumés en une requête ` +
        `(~${result.estimated}/${result.limit} tokens).`,
      )
      break
    case "not-reduced":
      tui.printInfo(
        `Compaction non appliquée : le résumé ne réduit pas le contexte ` +
        `(~${result.before} → ~${result.after} tokens).`,
      )
      break
    case "completed":
      tui.printInfo(`Conversation compactée : ~${result.before} → ~${result.after} tokens.`)
      break
    case "provider-error":
      tui.printError(
        `Impossible de compacter la conversation : ` +
        `${result.error instanceof Error ? result.error.message : String(result.error)}`,
      )
      break
  }
}
