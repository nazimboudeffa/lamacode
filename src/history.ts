import type { ChatCompletionMessageParam } from "openai/resources"

export type History = {
  messages: ChatCompletionMessageParam[]
  push: (role: "user" | "assistant" | "system", content: string) => void
  clear: () => void
}

export function createHistory(systemPrompt?: string): History {
  const messages: ChatCompletionMessageParam[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }]
    : []

  return {
    messages,
    push(role, content) {
      messages.push({ role, content })
    },
    clear() {
      messages.length = systemPrompt ? 1 : 0
    },
  }
}
