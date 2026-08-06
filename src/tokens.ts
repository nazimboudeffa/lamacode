import type { ChatCompletionMessageParam } from "openai/resources"

const MESSAGE_OVERHEAD_TOKENS = 4

function contentText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return ""
      const value = part as Record<string, unknown>
      return typeof value.text === "string" ? value.text : ""
    })
    .join("")
}

export function estimateTextTokens(text: string): number {
  if (!text) return 0
  return Buffer.byteLength(text, "utf8")
}

export function estimateMessageTokens(message: ChatCompletionMessageParam): number {
  const name = "name" in message && typeof message.name === "string" ? message.name : ""
  return MESSAGE_OVERHEAD_TOKENS +
    estimateTextTokens(message.role) +
    estimateTextTokens(name) +
    estimateTextTokens(contentText(message.content))
}

export function estimateMessagesTokens(messages: ChatCompletionMessageParam[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 2)
}

export type TokenBudget = {
  estimatedInputTokens: number
  inputLimit: number
  contextWindow: number
  maxOutputTokens: number
  usagePercent: number
  exceedsLimit: boolean
  shouldWarn: boolean
}

export function calculateTokenBudget(
  estimatedInputTokens: number,
  contextWindow: number,
  maxOutputTokens: number,
): TokenBudget {
  const inputLimit = contextWindow - maxOutputTokens
  const usagePercent = Math.ceil(estimatedInputTokens / inputLimit * 100)
  return {
    estimatedInputTokens,
    inputLimit,
    contextWindow,
    maxOutputTokens,
    usagePercent,
    exceedsLimit: estimatedInputTokens > inputLimit,
    shouldWarn: estimatedInputTokens >= inputLimit * 0.8,
  }
}
