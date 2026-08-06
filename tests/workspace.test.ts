import assert from "node:assert/strict"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test, { type TestContext } from "node:test"
import { resolveWorkspace } from "../src/workspace.js"

async function createDirectory(t: TestContext, prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

async function createGitWorkspace(t: TestContext): Promise<string> {
  const workspace = await createDirectory(t, "lamacode-workspace-")
  spawnSync("git", ["init", "--quiet"], { cwd: workspace })
  return workspace
}

test("resolves an absolute Git workspace", async (t) => {
  const workspace = await createGitWorkspace(t)

  assert.deepEqual(await resolveWorkspace(workspace), {
    path: await realpath(workspace),
    isGit: true,
  })
})

test("resolves quoted paths and paths relative to the current workspace", async (t) => {
  const parent = await createDirectory(t, "lamacode-workspaces-")
  const first = path.join(parent, "first repo")
  const second = path.join(parent, "second repo")
  await mkdir(first)
  await mkdir(second)
  spawnSync("git", ["init", "--quiet"], { cwd: first })
  spawnSync("git", ["init", "--quiet"], { cwd: second })

  assert.equal((await resolveWorkspace(`"${first}"`)).path, await realpath(first))
  assert.equal((await resolveWorkspace("../second repo", first)).path, await realpath(second))
})

test("accepts a subdirectory inside a Git working tree", async (t) => {
  const workspace = await createGitWorkspace(t)
  const nested = path.join(workspace, "packages", "app")
  await mkdir(nested, { recursive: true })

  assert.deepEqual(await resolveWorkspace(nested), {
    path: await realpath(nested),
    isGit: true,
  })
})

test("rejects missing paths and regular files but accepts non-Git directories", async (t) => {
  const directory = await createDirectory(t, "lamacode-not-git-")
  const filename = path.join(directory, "file.txt")
  await writeFile(filename, "content")

  await assert.rejects(() => resolveWorkspace(path.join(directory, "missing")), /dossier existant/)
  await assert.rejects(() => resolveWorkspace(filename), /dossier existant/)
  assert.deepEqual(await resolveWorkspace(directory), {
    path: await realpath(directory),
    isGit: false,
  })
})

test("ignores Git environment variables that point to another repository", async (t) => {
  const repository = await createGitWorkspace(t)
  const directory = await createDirectory(t, "lamacode-fake-git-")
  const environment = {
    ...process.env,
    GIT_DIR: path.join(repository, ".git"),
    GIT_WORK_TREE: directory,
  }

  assert.deepEqual(await resolveWorkspace(directory, process.cwd(), environment), {
    path: await realpath(directory),
    isGit: false,
  })
})
