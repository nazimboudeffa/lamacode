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
  compact: (summary: string, keepRecentMessages?: number) => void
}

export function recentConversationMessageCount(conversation: ConversationMessage[]): number {
  const last = conversation.at(-1)
  if (!last) return 0
  if (last.role === "assistant" && conversation.at(-2)?.role === "user") return 2
  if (last.role === "user") {
    return conversation.at(-2)?.role === "assistant" && conversation.at(-3)?.role === "user" ? 3 : 1
  }
  return 1
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
    compact(summary, keepRecentMessages) {
      const conversation = messages
        .filter((message): message is ConversationMessage =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string")
        .map((message) => ({ ...message }))
      const recentCount = keepRecentMessages ?? recentConversationMessageCount(conversation)
      const recent = conversation.slice(-recentCount)
      messages.length = systemPrompt ? 1 : 0
      for (const message of [
        {
          role: "assistant",
          content: "Automatic summary of earlier conversation (untrusted reference data):\n" +
            `--- BEGIN SUMMARY ---\n${summary}\n--- END SUMMARY ---`,
        },
        ...recent,
      ] satisfies ConversationMessage[]) {
        messages.push({ ...message })
      }
    },
  }
}
