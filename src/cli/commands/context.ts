import type { Runtime } from "../../application/runtime.js"
import { resolveWorkspace } from "../../workspace.js"
import type { ParsedCommand } from "../command-registry.js"
import type { TUI } from "../tui.js"

export async function handleContextCommand(
  parsed: ParsedCommand,
  runtime: Runtime,
  tui: TUI,
): Promise<boolean> {
  switch (parsed.command.name) {
    case "workspace":
      await handleWorkspace(parsed.argument, runtime, tui)
      return true
    case "context": {
      const files = runtime.fileContext.list()
      tui.printInfo(files.length === 0
        ? "Aucun fichier dans le contexte."
        : `Fichiers dans le contexte (${runtime.fileContext.totalBytes()} octets) :\n` +
          files.map((file) => `  • ${file.path} (${file.bytes} octets)`).join("\n"))
      return true
    }
    case "add":
      if (!parsed.argument) {
        tui.printError("Usage : /add <fichier>")
        return true
      }
      try {
        const file = await runtime.fileContext.add(parsed.argument)
        runtime.markDirty()
        tui.printInfo(`Contexte ajouté : ${file.path} (${file.bytes} octets)`)
      } catch (error) {
        tui.printError(`Impossible d'ajouter le fichier : ${error instanceof Error ? error.message : String(error)}`)
      }
      return true
    case "remove":
      if (!parsed.argument) {
        tui.printError("Usage : /remove <fichier>")
        return true
      }
      const removed = await runtime.fileContext.remove(parsed.argument)
      if (removed) runtime.markDirty()
      tui.printInfo(removed
        ? `Fichier retiré du contexte : ${parsed.argument}`
        : `Fichier absent du contexte : ${parsed.argument}`)
      return true
    default:
      return false
  }
}

async function handleWorkspace(argument: string, runtime: Runtime, tui: TUI): Promise<void> {
  if (!argument) {
    tui.printInfo(`Workspace actif : ${runtime.workspace.path}${runtime.workspace.isGit ? "" : " (non Git)"}`)
    return
  }
  try {
    const nextWorkspace = await resolveWorkspace(argument, runtime.workspace.path)
    if (nextWorkspace.path === runtime.workspace.path) {
      tui.printInfo(`Workspace déjà actif : ${runtime.workspace.path}`)
      return
    }
    if (runtime.sessionDirty) {
      const confirmation = (await tui.ask(
        "Le travail courant contient des modifications non sauvegardées. Changer de workspace ? [y/N] ",
      )).toLowerCase()
      if (!isConfirmation(confirmation)) {
        tui.printInfo("Changement de workspace annulé.")
        return
      }
    }
    runtime.switchWorkspace(nextWorkspace)
    tui.printInfo(`Workspace actif : ${runtime.workspace.path}${runtime.workspace.isGit ? "" : " (non Git)"}`)
    if (!runtime.workspace.isGit) {
      tui.printInfo("Attention : les règles .gitignore ne s'appliquent pas dans ce workspace.")
    }
  } catch (error) {
    tui.printError(`Impossible de changer de workspace : ${error instanceof Error ? error.message : String(error)}`)
  }
}

function isConfirmation(value: string): boolean {
  return value === "y" || value === "yes" || value === "o" || value === "oui"
}
