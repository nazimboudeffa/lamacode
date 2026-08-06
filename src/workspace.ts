import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { runGit } from "./git.js"

export type Workspace = {
  path: string
  isGit: boolean
}

function cleanInput(input: string): string {
  const trimmed = input.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function defaultWorkspace(): string {
  return process.env.LAMACODE_WORKSPACE?.trim() || process.cwd()
}

export async function resolveWorkspace(
  input: string,
  base = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<Workspace> {
  const requestedPath = path.resolve(base, cleanInput(input))
  const directoryInfo = await stat(requestedPath).catch(() => null)
  if (!directoryInfo?.isDirectory()) throw new Error("Le workspace doit être un dossier existant.")

  const workspace = await realpath(requestedPath)
  const gitCheck = runGit(["rev-parse", "--is-inside-work-tree"], workspace, environment)
  if (gitCheck.status === 0 && gitCheck.stdout.trim() === "true") {
    return { path: workspace, isGit: true }
  }
  if (gitCheck.status === 128 && /not a git repository/i.test(gitCheck.stderr)) {
    return { path: workspace, isGit: false }
  }
  throw new Error("Impossible de vérifier si le workspace est un dépôt Git.")
}
