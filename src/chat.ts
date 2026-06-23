import OpenAI from "openai"
import { config } from "./config.js"
import type { History } from "./history.js"

const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })

export async function streamChat(history: History, onChunk: (text: string) => void): Promise<string> {
  const stream = await client.chat.completions.create({
    model: config.defaultModel,
    messages: history.messages,
    stream: true,
  })

  let full = ""
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ""
    full += text
    onChunk(text)
  }
  return full
}

// Récupère la liste des modèles disponibles dans LM Studio
export async function listModels(): Promise<string[]> {
  const res = await client.models.list()
  return res.data.map((m) => m.id)
}
