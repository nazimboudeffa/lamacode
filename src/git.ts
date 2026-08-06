import { spawnSync } from "node:child_process"

const blockedGitVariables = new Set([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
])

export function cleanGitEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = {}
  for (const [name, value] of Object.entries(environment)) {
    if (!blockedGitVariables.has(name.toUpperCase())) cleaned[name] = value
  }
  cleaned.LC_ALL = "C"
  cleaned.LANG = "C"
  return cleaned
}

export function runGit(
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: cleanGitEnvironment(environment),
  })
}
