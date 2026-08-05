import OpenAI from "openai"
import type { LlmConfig } from "./config.js"
import type { History } from "./history.js"

export function createChatClient(config: LlmConfig) {
  const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })
  let activeModel = config.defaultModel ?? ""

  function setActiveModel(model: string): void {
    activeModel = model
  }

  async function streamChat(history: History, onChunk: (text: string) => void): Promise<string> {
    const stream = await client.chat.completions.create({
      model: activeModel,
      messages: history.messages,
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

  return { listModels, setActiveModel, streamChat }
}
