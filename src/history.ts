import type { ChatCompletionMessageParam } from "openai/resources"

export type ConversationMessage = {
  role: "user" | "assistant"
  content: string
}

export type History = {
  messages: ChatCompletionMessageParam[]
  push: (role: "user" | "assistant" | "system", content: string) => void
  clear: () => void
  count: () => number
  undoLastTurn: () => boolean
  prepareRetry: () => boolean
  snapshot: () => ConversationMessage[]
  restore: (messages: ConversationMessage[]) => void
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
    count() {
      return messages.filter((message) => message.role !== "system").length
    },
    undoLastTurn() {
      if (messages.at(-1)?.role === "assistant") messages.pop()
      if (messages.at(-1)?.role !== "user") return false
      messages.pop()
      return true
    },
    prepareRetry() {
      if (messages.at(-1)?.role === "assistant") messages.pop()
      return messages.at(-1)?.role === "user"
    },
    snapshot() {
      return messages
        .filter((message): message is ConversationMessage =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string")
        .map((message) => ({ ...message }))
    },
    restore(conversation) {
      messages.length = systemPrompt ? 1 : 0
      for (const message of conversation) messages.push({ ...message })
    },
  }
}
