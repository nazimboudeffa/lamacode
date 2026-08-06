import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { lstat, mkdir, open, readdir, realpath, rename, rm } from "node:fs/promises"
import path from "node:path"
import type { LlmProvider } from "./config.js"
import type { ConversationMessage } from "./history.js"

const SESSION_VERSION = 1
const MAX_SESSION_BYTES = 2 * 1024 * 1024
const MAX_MESSAGES = 2_000
const MAX_CONTEXT_FILES = 100

export type SessionData = {
  provider: LlmProvider
  model: string
  messages: ConversationMessage[]
  contextPaths: string[]
}

export type Session = SessionData & {
  version: typeof SESSION_VERSION
  name: string
  createdAt: string
  updatedAt: string
}

function validateName(name: string): string {
  const trimmed = name.trim().toLowerCase()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed) || trimmed.includes("..")) {
    throw new Error("Nom invalide. Utilise 1 à 64 lettres, chiffres, points, tirets ou underscores.")
  }
  const basename = trimmed.split(".")[0].toUpperCase()
  if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(basename)) {
    throw new Error("Ce nom de session est réservé par Windows.")
  }
  return trimmed
}

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  return (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
}

function validateSession(value: unknown, expectedName: string): Session {
  if (!value || typeof value !== "object") throw new Error("Format de session invalide.")
  const session = value as Record<string, unknown>
  if (session.version !== SESSION_VERSION || session.name !== expectedName) {
    throw new Error("Version ou nom de session invalide.")
  }
  if (session.provider !== "lmstudio" && session.provider !== "ollama") {
    throw new Error("Fournisseur de session invalide.")
  }
  if (typeof session.model !== "string" || !session.model || session.model.length > 256) {
    throw new Error("Modèle de session invalide.")
  }
  if (!Array.isArray(session.messages) ||
      session.messages.length > MAX_MESSAGES ||
      !session.messages.every(isConversationMessage)) {
    throw new Error("Historique de session invalide.")
  }
  if (!Array.isArray(session.contextPaths) ||
      session.contextPaths.length > MAX_CONTEXT_FILES ||
      !session.contextPaths.every((item) => typeof item === "string" && item.length <= 1_024)) {
    throw new Error("Contexte de session invalide.")
  }
  if (typeof session.createdAt !== "string" || Number.isNaN(Date.parse(session.createdAt)) ||
      typeof session.updatedAt !== "string" || Number.isNaN(Date.parse(session.updatedAt))) {
    throw new Error("Dates de session invalides.")
  }
  return {
    version: SESSION_VERSION,
    name: expectedName,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    provider: session.provider,
    model: session.model,
    messages: (session.messages as ConversationMessage[])
      .map(({ role, content }) => ({ role, content })),
    contextPaths: [...new Set(session.contextPaths as string[])],
  }
}

export function createSessionStore(workspace = process.cwd()) {
  const storageDir = path.join(path.resolve(workspace), ".lamacode")
  const sessionsDir = path.join(storageDir, "sessions")

  async function ensureStorage(): Promise<void> {
    for (const directory of [storageDir, sessionsDir]) {
      const info = await lstat(directory).catch(() => null)
      if (info?.isSymbolicLink()) throw new Error("Le dossier de sessions ne peut pas être un lien symbolique.")
      if (info && !info.isDirectory()) throw new Error("Le chemin de stockage des sessions est invalide.")
      if (!info) await mkdir(directory, { mode: 0o700 })
      const actualPath = await realpath(directory)
      const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value
      if (normalize(actualPath) !== normalize(path.resolve(directory))) {
        throw new Error("Le dossier de sessions ne peut pas rediriger hors du workspace.")
      }
    }
  }

  function sessionPath(name: string): string {
    return path.join(sessionsDir, `${validateName(name)}.json`)
  }

  async function load(name: string): Promise<Session> {
    const validName = validateName(name)
    await ensureStorage()
    const filename = sessionPath(validName)
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null)
    if (!handle) throw new Error(`Session introuvable : ${validName}`)

    let value: unknown
    try {
      const fileInfo = await handle.stat()
      if (!fileInfo.isFile()) throw new Error(`Session introuvable : ${validName}`)
      if (fileInfo.size > MAX_SESSION_BYTES) throw new Error("Fichier de session trop volumineux.")
      value = JSON.parse(await handle.readFile("utf8"))
    } catch {
      throw new Error(`Session illisible : ${validName}`)
    } finally {
      await handle.close()
    }
    return validateSession(value, validName)
  }

  async function save(name: string, data: SessionData): Promise<Session> {
    const validName = validateName(name)
    await ensureStorage()

    const existingInfo = await lstat(sessionPath(validName)).catch(() => null)
    const existing = existingInfo ? await load(validName) : null
    const now = new Date().toISOString()
    const session = validateSession({
      version: SESSION_VERSION,
      name: validName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      provider: data.provider,
      model: data.model,
      messages: data.messages.map((message) => ({ ...message })),
      contextPaths: [...new Set(data.contextPaths)],
    }, validName)

    const serialized = JSON.stringify(session, null, 2) + "\n"
    if (Buffer.byteLength(serialized, "utf8") > MAX_SESSION_BYTES) {
      throw new Error("Session trop volumineuse.")
    }

    const destination = sessionPath(validName)
    const temporary = path.join(sessionsDir, `.${validName}.${process.pid}.${randomUUID()}.tmp`)
    let handle
    try {
      handle = await open(temporary, "wx", 0o600)
      await handle.writeFile(serialized, "utf8")
      await handle.sync()
      await handle.close()
      handle = undefined
      await rename(temporary, destination)
    } finally {
      await handle?.close()
      await rm(temporary, { force: true })
    }
    return session
  }

  async function list(): Promise<Session[]> {
    await ensureStorage()
    const entries = await readdir(sessionsDir, { withFileTypes: true })
    const sessions = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const name = entry.name.slice(0, -".json".length)
        return load(name)
      }))
    return sessions
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async function remove(name: string): Promise<boolean> {
    await ensureStorage()
    const filename = sessionPath(name)
    try {
      await rm(filename)
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false
      throw err
    }
  }

  return { save, load, list, remove }
}
