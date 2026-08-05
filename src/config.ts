import "dotenv/config"

export type LlmProvider = "lmstudio" | "ollama"

const providerDefaults = {
  lmstudio: {
    label: "LM Studio",
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
  },
  ollama: {
    label: "Ollama",
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama",
  },
} as const

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

const providerValue = readEnv("LLM_PROVIDER")?.toLowerCase() ?? "lmstudio"
if (providerValue !== "lmstudio" && providerValue !== "ollama") {
  throw new Error(`LLM_PROVIDER doit être "lmstudio" ou "ollama" (reçu : "${providerValue}").`)
}

const provider: LlmProvider = providerValue
const defaults = providerDefaults[provider]

export const config = {
  provider,
  providerLabel: defaults.label,
  baseURL: readEnv("LLM_BASE_URL") ?? defaults.baseURL,
  apiKey: readEnv("LLM_API_KEY") ?? defaults.apiKey,
  defaultModel: readEnv("LLM_MODEL"),
}
