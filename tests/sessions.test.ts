import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test, { type TestContext } from "node:test"
import { createSessionStore, type SessionData } from "../src/sessions.js"

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "lamacode-sessions-"))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  return workspace
}

const sessionData: SessionData = {
  provider: "ollama",
  model: "qwen3:8b",
  messages: [
    { role: "user", content: "question" },
    { role: "assistant", content: "answer" },
  ],
  contextPaths: ["src/index.ts"],
}

test("saves, loads, and lists a session without extra secrets", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)

  const saved = await store.save("feature-test", {
    ...sessionData,
    apiKey: "must-not-be-saved",
  } as SessionData & { apiKey: string })
  const loaded = await store.load("feature-test")
  const sessions = await store.list()
  const serialized = await readFile(
    path.join(workspace, ".lamacode", "sessions", "feature-test.json"),
    "utf8",
  )

  assert.equal(saved.version, 1)
  assert.deepEqual(loaded, saved)
  assert.deepEqual(sessions, [saved])
  assert.doesNotMatch(serialized, /must-not-be-saved|apiKey/)
})

test("overwrites a session while preserving its creation date", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)
  const first = await store.save("work", sessionData)

  const updated = await store.save("work", {
    ...sessionData,
    model: "qwen3:14b",
    messages: [{ role: "user", content: "updated" }],
  })

  assert.equal(updated.createdAt, first.createdAt)
  assert.equal(updated.model, "qwen3:14b")
  assert.deepEqual((await store.load("work")).messages, [{ role: "user", content: "updated" }])
})

test("rejects unsafe session names", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)

  await assert.rejects(() => store.save("../outside", sessionData), /Nom invalide/)
  await assert.rejects(() => store.load("name with spaces"), /Nom invalide/)
  await assert.rejects(() => store.save("CON", sessionData), /réservé par Windows/)
})

test("rejects malformed session files when loading or listing", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)
  await store.save("valid", sessionData)
  await writeFile(
    path.join(workspace, ".lamacode", "sessions", "broken.json"),
    "{not-json",
  )

  await assert.rejects(() => store.load("broken"), /illisible/)
  await assert.rejects(() => store.list(), /illisible/)
})

test("deletes a session and reports missing sessions", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)
  await store.save("temporary", sessionData)

  assert.equal(await store.remove("temporary"), true)
  assert.equal(await store.remove("temporary"), false)
  await assert.rejects(() => store.load("temporary"), /introuvable/)
})

test("normalizes names and strips unknown JSON properties", async (t) => {
  const workspace = await createWorkspace(t)
  const store = createSessionStore(workspace)
  const saved = await store.save("My-Work", sessionData)
  const filename = path.join(workspace, ".lamacode", "sessions", "my-work.json")
  const raw = JSON.parse(await readFile(filename, "utf8"))
  raw.untrusted = "top-level"
  raw.messages[0].untrusted = "message-level"
  await writeFile(filename, JSON.stringify(raw))

  const loaded = await store.load("MY-WORK")

  assert.equal(saved.name, "my-work")
  assert.equal("untrusted" in loaded, false)
  assert.equal("untrusted" in loaded.messages[0], false)
})

test("rejects a symlinked session storage directory", async (t) => {
  const workspace = await createWorkspace(t)
  const external = await mkdtemp(path.join(tmpdir(), "lamacode-external-sessions-"))
  t.after(() => rm(external, { recursive: true, force: true }))
  await mkdir(path.join(workspace, ".lamacode"))
  await symlink(external, path.join(workspace, ".lamacode", "sessions"), "junction")
  const store = createSessionStore(workspace)

  await assert.rejects(() => store.list(), /lien symbolique|rediriger/)
})

test("stores sessions inside Git metadata for a Git workspace", async (t) => {
  const workspace = await createWorkspace(t)
  spawnSync("git", ["init", "--quiet"], { cwd: workspace })
  const store = createSessionStore(workspace)

  await store.save("git-safe", sessionData)

  const status = spawnSync(
    "git",
    ["status", "--short", "--untracked-files=all"],
    { cwd: workspace, encoding: "utf8" },
  )
  assert.equal(existsSync(path.join(workspace, ".git", "lamacode")), true)
  assert.equal(existsSync(path.join(workspace, ".lamacode")), false)
  assert.doesNotMatch(status.stdout, /\.lamacode/)
})

test("does not reuse legacy storage when the directory itself is not ignored", async (t) => {
  const workspace = await createWorkspace(t)
  spawnSync("git", ["init", "--quiet"], { cwd: workspace })
  await mkdir(path.join(workspace, ".lamacode", "sessions"), { recursive: true })
  await writeFile(
    path.join(workspace, ".gitignore"),
    ".lamacode/*\n!.lamacode/sessions/\n!.lamacode/sessions/*.json\n",
  )
  const store = createSessionStore(workspace)

  await store.save("private", sessionData)

  assert.equal(existsSync(path.join(workspace, ".lamacode", "sessions", "private.json")), false)
  assert.equal(existsSync(path.join(workspace, ".git", "lamacode")), true)
})
