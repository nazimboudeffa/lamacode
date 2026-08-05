import "dotenv/config"

export type LlmProvider = "lmstudio" | "ollama"

export interface LlmConfig {
  provider: LlmProvider
  providerLabel: string
  baseURL: string
  apiKey: string
  defaultModel?: string
}

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

export function resolveProvider(): LlmProvider {
  const provider = readEnv("LLM_PROVIDER")?.toLowerCase() ?? "lmstudio"
  if (provider !== "lmstudio" && provider !== "ollama") {
    throw new Error(`LLM_PROVIDER doit être "lmstudio" ou "ollama" (reçu : "${provider}").`)
  }
  return provider
}

export function resolveConfig(provider = resolveProvider()): LlmConfig {
  const defaults = providerDefaults[provider]

  return {
    provider,
    providerLabel: defaults.label,
    baseURL: readEnv("LLM_BASE_URL") ?? defaults.baseURL,
    apiKey: readEnv("LLM_API_KEY") ?? defaults.apiKey,
    defaultModel: readEnv("LLM_MODEL"),
  }
}
