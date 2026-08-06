import assert from "node:assert/strict"
import test from "node:test"
import { createCommandRegistry, formatCommandHelp, parseCommand } from "../src/cli/command-registry.js"

const registry = createCommandRegistry("Ollama")

test("parses exact commands and trims accepted arguments", () => {
  assert.equal(parseCommand("/clear", registry)?.command.name, "clear")
  assert.deepEqual(parseCommand("/add   src/index.ts  ", registry), {
    command: registry.find((command) => command.name === "add"),
    argument: "src/index.ts",
  })
  assert.deepEqual(parseCommand("/workspace", registry), {
    command: registry.find((command) => command.name === "workspace"),
    argument: "",
  })
})

test("leaves unknown and malformed commands for the model", () => {
  assert.equal(parseCommand("/unknown", registry), null)
  assert.equal(parseCommand("/clear now", registry), null)
  assert.equal(parseCommand("/add-file src/index.ts", registry), null)
  assert.equal(parseCommand("hello /clear", registry), null)
})

test("generates help from the same registry", () => {
  const help = formatCommandHelp(registry)

  assert.match(help, /^  \/exit\s+quitter lamacode/m)
  assert.match(help, /^  \/models\s+lister les modèles disponibles dans Ollama/m)
  assert.match(help, /^  \/delete-session <nom> supprimer une session sauvegardée$/m)
  assert.equal(help.split("\n").length, 17)
})
