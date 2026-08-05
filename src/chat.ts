import OpenAI from "openai"
import { config } from "./config.js"
import type { History } from "./history.js"

const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })

let activeModel = config.defaultModel ?? ""

export function setActiveModel(model: string): void {
  activeModel = model
}

export async function streamChat(history: History, onChunk: (text: string) => void): Promise<string> {
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

// Récupère les modèles exposés par le serveur OpenAI-compatible.
export async function listModels(): Promise<string[]> {
  const res = await client.models.list()
  return res.data.map((m) => m.id)
}
