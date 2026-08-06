import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test, { type TestContext } from "node:test"
import { createFileContext, extractFileReferences } from "../src/context.js"

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "lamacode-context-"))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  spawnSync("git", ["init", "--quiet"], { cwd: workspace })
  return workspace
}

test("adds, lists, formats, and removes a text file", async (t) => {
  const workspace = await createWorkspace(t)
  await mkdir(path.join(workspace, "src"))
  await writeFile(path.join(workspace, "src", "index.ts"), "export const value = 1\n")
  const context = createFileContext(workspace)

  const added = await context.add("src/index.ts")

  assert.equal(added.path, "src/index.ts")
  assert.equal(context.list().length, 1)
  assert.match(context.systemMessage() ?? "", /BEGIN FILE: src\/index\.ts/)
  assert.equal(await context.remove("src/index.ts"), true)
  assert.equal(context.systemMessage(), undefined)
})

test("rejects files outside the workspace", async (t) => {
  const parent = await createWorkspace(t)
  const workspace = path.join(parent, "workspace")
  await mkdir(workspace)
  await writeFile(path.join(parent, "outside.txt"), "outside")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add("../outside.txt"), /workspace/)
})

test("rejects sensitive files and known secret values", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, ".env"), "TOKEN=secret")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add(".env"), /sensibles/)

  const secrets = [
    "lowercase_api_key=abcdefghijklmnopqrstuvwxyz123456",
    `AWS_SECRET_ACCESS_KEY=${"a".repeat(40)}`,
    `gho_${"a".repeat(24)}`,
    `glpat-${"a".repeat(24)}`,
    `xoxb-${"a".repeat(24)}`,
    `AIza${"a".repeat(35)}`,
  ]
  for (const [index, secret] of secrets.entries()) {
    const filename = `secret-${index}.txt`
    await writeFile(path.join(workspace, filename), secret)
    await assert.rejects(() => context.add(filename), /secret/)
  }
})

test("rejects files ignored by Git", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, ".gitignore"), "ignored.txt\n")
  await writeFile(path.join(workspace, "ignored.txt"), "ignored")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add("ignored.txt"), /ignoré par Git/)
})

test("rejects binary and oversized files", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, "binary.bin"), Buffer.from([1, 0, 2]))
  await writeFile(path.join(workspace, "large.txt"), "12345")
  const context = createFileContext(workspace, { maxFileBytes: 4 })

  await assert.rejects(() => context.add("binary.bin"), /binaires/)
  await assert.rejects(() => context.add("large.txt"), /volumineux/)
})

test("rejects invalid UTF-8 text", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, "invalid.txt"), Buffer.from([0xc3, 0x28]))
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add("invalid.txt"), /UTF-8/)
})

test("enforces the total context size", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, "first.txt"), "1234")
  await writeFile(path.join(workspace, "second.txt"), "5678")
  const context = createFileContext(workspace, { maxFileBytes: 10, maxTotalBytes: 160 })

  await context.add("first.txt")
  await assert.rejects(() => context.add("second.txt"), /Contexte trop volumineux/)
})

test("adds multiple references atomically", async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, "valid.txt"), "valid")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.addMany(["valid.txt", "missing.txt"]), /introuvable/)
  assert.deepEqual(context.list(), [])
})

test("fails closed when Git ignore rules cannot be checked", async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), "lamacode-no-git-"))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  await writeFile(path.join(workspace, "file.txt"), "content")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add("file.txt"), /gitignore/)
})

test("allows an explicitly selected non-Git workspace", async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), "lamacode-non-git-"))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  await writeFile(path.join(workspace, "file.txt"), "content")
  const context = createFileContext(workspace, { allowNonGit: true })

  assert.equal((await context.add("file.txt")).path, "file.txt")
})

test("ignores inherited Git environment when checking ignored files", async (t) => {
  const workspace = await createWorkspace(t)
  const otherRepository = await createWorkspace(t)
  await writeFile(path.join(workspace, ".gitignore"), "ignored.txt\n")
  await writeFile(path.join(workspace, "ignored.txt"), "ignored")
  const context = createFileContext(workspace, {
    environment: {
      ...process.env,
      GIT_DIR: path.join(otherRepository, ".git"),
      GIT_WORK_TREE: otherRepository,
    },
  })

  await assert.rejects(() => context.add("ignored.txt"), /ignoré par Git/)
})

test("rejects NTFS alternate data streams", { skip: process.platform !== "win32" }, async (t) => {
  const workspace = await createWorkspace(t)
  await writeFile(path.join(workspace, "safe.txt"), "safe")
  await writeFile(path.join(workspace, "safe.txt:secret"), "hidden")
  const context = createFileContext(workspace)

  await assert.rejects(() => context.add("safe.txt:secret"), /alternatifs Windows/)
})

test("extracts file references without treating mentions or emails as files", () => {
  assert.deepEqual(
    extractFileReferences(
      'Compare (`@src/index.ts:12`), [@docs/readme.md]. and @"file name.md", then ask @nazim.dev, @types/node or me@example.com.',
    ),
    ["src/index.ts", "docs/readme.md", "file name.md"],
  )
})
