export type CommandName =
  | "exit" | "clear" | "models" | "model" | "status" | "retry" | "undo"
  | "add" | "context" | "remove" | "save" | "sessions" | "load"
  | "delete-session" | "workspace" | "compact" | "help"

export type Command = {
  name: CommandName
  usage: string
  description: string
  acceptsArgument: boolean
}

export type ParsedCommand = { command: Command, argument: string }

export function createCommandRegistry(providerLabel: string): Command[] {
  return [
    { name: "exit", usage: "/exit", description: "quitter lamacode", acceptsArgument: false },
    { name: "clear", usage: "/clear", description: "effacer l'historique de conversation", acceptsArgument: false },
    { name: "models", usage: "/models", description: `lister les modèles disponibles dans ${providerLabel}`, acceptsArgument: false },
    { name: "model", usage: "/model", description: "changer de modèle actif", acceptsArgument: false },
    { name: "status", usage: "/status", description: "afficher la configuration et l'état de la conversation", acceptsArgument: false },
    { name: "retry", usage: "/retry", description: "régénérer la dernière réponse", acceptsArgument: false },
    { name: "undo", usage: "/undo", description: "supprimer le dernier tour de conversation", acceptsArgument: false },
    { name: "add", usage: "/add <fichier>", description: "ajouter un fichier au contexte", acceptsArgument: true },
    { name: "context", usage: "/context", description: "afficher les fichiers du contexte", acceptsArgument: false },
    { name: "remove", usage: "/remove <fichier>", description: "retirer un fichier du contexte", acceptsArgument: true },
    { name: "save", usage: "/save <nom>", description: "sauvegarder la session courante", acceptsArgument: true },
    { name: "sessions", usage: "/sessions", description: "lister les sessions sauvegardées", acceptsArgument: false },
    { name: "load", usage: "/load <nom>", description: "charger une session sauvegardée", acceptsArgument: true },
    { name: "delete-session", usage: "/delete-session <nom>", description: "supprimer une session sauvegardée", acceptsArgument: true },
    { name: "workspace", usage: "/workspace <dossier>", description: "afficher ou changer le workspace", acceptsArgument: true },
    { name: "compact", usage: "/compact", description: "résumer les anciens messages pour libérer du contexte", acceptsArgument: false },
    { name: "help", usage: "/help", description: "afficher cette aide", acceptsArgument: false },
  ]
}

export function parseCommand(input: string, registry: Command[]): ParsedCommand | null {
  for (const command of registry) {
    const prefix = `/${command.name}`
    if (input === prefix) return { command, argument: "" }
    if (command.acceptsArgument && input.startsWith(prefix + " ")) {
      return { command, argument: input.slice(prefix.length).trim() }
    }
  }
  return null
}

export function formatCommandHelp(registry: Command[]): string {
  return registry.map(({ usage, description }) => `  ${usage.padEnd(12)} ${description}`).join("\n")
}
