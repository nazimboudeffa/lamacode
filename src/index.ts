import { runCli } from "./cli/run.js"
import { reportFatalError } from "./cli/tui.js"

runCli().then((exitCode) => {
  process.exitCode = exitCode
}).catch((error) => {
  reportFatalError(error)
  process.exitCode = 1
})
