import type { LlmProvider } from "../config.js"
import { resolveWorkspace, type Workspace } from "../workspace.js"
import type { TUI } from "./tui.js"

export async function selectWorkspace(tui: TUI, suggestedWorkspace: string): Promise<Workspace> {
  while (true) {
    const input = await tui.ask(`Workspace [${suggestedWorkspace}] > `)
    try {
      return await resolveWorkspace(input || suggestedWorkspace)
    } catch (error) {
      tui.printError(`Workspace invalide : ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export async function selectProvider(tui: TUI, defaultProvider: LlmProvider): Promise<LlmProvider> {
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

export async function selectModel(tui: TUI, models: string[], preferredModel?: string): Promise<string> {
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
