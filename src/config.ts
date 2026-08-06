import "dotenv/config"

export type LlmProvider = "lmstudio" | "ollama"

export interface LlmConfig {
  provider: LlmProvider
  providerLabel: string
  baseURL: string
  apiKey: string
  defaultModel?: string
  contextWindow: number
  maxOutputTokens: number
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

function readInteger(name: string, fallback: number, minimum: number): number {
  const raw = readEnv(name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} doit être un entier supérieur ou égal à ${minimum}.`)
  }
  return value
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
  const contextWindow = readInteger("LLM_CONTEXT_SIZE", 8_192, 512)
  const maxOutputTokens = readInteger("LLM_MAX_OUTPUT_TOKENS", 1_024, 1)
  if (maxOutputTokens >= contextWindow) {
    throw new Error("LLM_MAX_OUTPUT_TOKENS doit être inférieur à LLM_CONTEXT_SIZE.")
  }

  return {
    provider,
    providerLabel: defaults.label,
    baseURL: readEnv("LLM_BASE_URL") ?? defaults.baseURL,
    apiKey: readEnv("LLM_API_KEY") ?? defaults.apiKey,
    defaultModel: readEnv("LLM_MODEL"),
    contextWindow,
    maxOutputTokens,
  }
}
