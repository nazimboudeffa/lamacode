import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import type { LlmConfig } from "./config.js"
import type { History } from "./history.js"

export function buildMessages(history: History, context?: string): ChatCompletionMessageParam[] {
  const messages = [...history.messages]
  if (!context) return messages

  let userIndex = -1
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") {
      userIndex = index
      break
    }
  }
  if (userIndex === -1) return messages
  const userMessage = messages[userIndex]
  if (userMessage.role === "user" && typeof userMessage.content === "string") {
    messages[userIndex] = {
      ...userMessage,
      content: `${userMessage.content}\n\n${context}`,
    }
  } else {
    messages.splice(userIndex + 1, 0, { role: "user", content: context })
  }
  return messages
}

export function createChatClient(config: LlmConfig) {
  const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })
  let activeModel = config.defaultModel ?? ""

  function setActiveModel(model: string): void {
    activeModel = model
  }

  async function streamChat(
    history: History,
    onChunk: (text: string) => void,
    context?: string,
  ): Promise<string> {
    const stream = await client.chat.completions.create({
      model: activeModel,
      messages: buildMessages(history, context),
      max_tokens: config.maxOutputTokens,
      stream: true,
    })

    let full = ""
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ""
      if (text) {
        full += text
        onChunk(text)
      }
    }
    return full
  }

  async function listModels(): Promise<string[]> {
    const res = await client.models.list()
    return res.data.map((model) => model.id)
  }

  async function completeChat(messages: ChatCompletionMessageParam[]) {
    const response = await client.chat.completions.create({
      model: activeModel,
      messages,
      max_tokens: config.maxOutputTokens,
      stream: false,
    })
    return {
      content: response.choices[0]?.message?.content ?? "",
      finishReason: response.choices[0]?.finish_reason ?? null,
    }
  }

  return { completeChat, listModels, setActiveModel, streamChat }
}
