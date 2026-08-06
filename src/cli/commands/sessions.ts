import type { Runtime } from "../../application/runtime.js"
import type { ParsedCommand } from "../command-registry.js"
import type { TUI } from "../tui.js"

type SessionDependencies = {
  runtime: Runtime
  tui: TUI
  listModels: () => Promise<string[]>
  setActiveModel: (model: string) => void
}

export async function handleSessionCommand(
  parsed: ParsedCommand,
  dependencies: SessionDependencies,
): Promise<boolean> {
  const { runtime, tui } = dependencies
  switch (parsed.command.name) {
    case "save":
      if (!parsed.argument) {
        tui.printError("Usage : /save <nom>")
        return true
      }
      try {
        const session = await runtime.sessionStore.save(parsed.argument, {
          provider: runtime.config.provider,
          model: runtime.activeModel,
          messages: runtime.history.snapshot(),
          contextPaths: runtime.fileContext.list().map((file) => file.path),
        })
        runtime.activeSession = session.name
        runtime.sessionDirty = false
        tui.printInfo(`Session sauvegardée : ${session.name}`)
      } catch (error) {
        tui.printError(`Impossible de sauvegarder la session : ${error instanceof Error ? error.message : String(error)}`)
      }
      return true
    case "sessions":
      try {
        const sessions = await runtime.sessionStore.list()
        tui.printInfo(sessions.length === 0
          ? "Aucune session sauvegardée."
          : "Sessions sauvegardées :\n" + sessions.map((session) =>
            `  • ${session.name} — ${session.provider} / ${session.model} — ${session.updatedAt}`,
          ).join("\n"))
      } catch (error) {
        tui.printError(`Impossible de lister les sessions : ${error instanceof Error ? error.message : String(error)}`)
      }
      return true
    case "load":
      await loadSession(parsed.argument, dependencies)
      return true
    case "delete-session":
      if (!parsed.argument) {
        tui.printError("Usage : /delete-session <nom>")
        return true
      }
      try {
        const removed = await runtime.sessionStore.remove(parsed.argument)
        if (removed && runtime.activeSession === parsed.argument.trim().toLowerCase()) {
          runtime.activeSession = undefined
          runtime.sessionDirty = true
        }
        tui.printInfo(removed
          ? `Session supprimée : ${parsed.argument}`
          : `Session introuvable : ${parsed.argument}`)
      } catch (error) {
        tui.printError(`Impossible de supprimer la session : ${error instanceof Error ? error.message : String(error)}`)
      }
      return true
    default:
      return false
  }
}

async function loadSession(argument: string, dependencies: SessionDependencies): Promise<void> {
  const { runtime, tui, listModels, setActiveModel } = dependencies
  if (!argument) {
    tui.printError("Usage : /load <nom>")
    return
  }
  try {
    if (runtime.sessionDirty) {
      const confirmation = (await tui.ask(
        "La session courante contient des modifications non sauvegardées. Continuer ? [y/N] ",
      )).toLowerCase()
      if (!isConfirmation(confirmation)) {
        tui.printInfo("Chargement annulé.")
        return
      }
    }
    const session = await runtime.sessionStore.load(argument)
    if (session.provider !== runtime.config.provider) {
      throw new Error(`Cette session utilise ${session.provider}. Relance LamaCode avec ce fournisseur.`)
    }
    const models = await listModels()
    if (!models.includes(session.model)) {
      throw new Error(`Le modèle "${session.model}" n'est pas disponible.`)
    }

    const restoredContext = runtime.createFileContext()
    await restoredContext.addMany(session.contextPaths)

    runtime.history.restore(session.messages)
    runtime.fileContext = restoredContext
    runtime.activeModel = session.model
    setActiveModel(runtime.activeModel)
    runtime.activeSession = session.name
    runtime.sessionDirty = false
    tui.printInfo(
      `Session chargée : ${session.name} ` +
      `(${runtime.history.count()} messages, ${runtime.fileContext.list().length} fichier(s))`,
    )
  } catch (error) {
    tui.printError(`Impossible de charger la session : ${error instanceof Error ? error.message : String(error)}`)
  }
}

function isConfirmation(value: string): boolean {
  return value === "y" || value === "yes" || value === "o" || value === "oui"
}
