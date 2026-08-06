import type { Runtime } from "./runtime.js"

export type GenerationResult =
  | { status: "completed" }
  | { status: "blocked-by-budget" }
  | { status: "provider-error", error: unknown }

export type GenerationCallbacks = {
  onBudgetExceeded: (estimated: number, limit: number) => void
  onBudgetWarning: (percent: number, estimated: number, limit: number) => void
  onStart: () => void
  onFirstChunk: () => void
  onChunk: (chunk: string) => void
  onComplete: () => void
  onProviderError: (error: unknown) => void
  onFinish: () => void
}

export async function generateResponse(
  runtime: Runtime,
  streamChat: (
    history: Runtime["history"],
    onChunk: (text: string) => void,
    context?: string,
  ) => Promise<string>,
  callbacks: GenerationCallbacks,
): Promise<GenerationResult> {
  const budget = runtime.currentTokenBudget()
  if (budget.exceedsLimit) {
    callbacks.onBudgetExceeded(budget.estimatedInputTokens, budget.inputLimit)
    return { status: "blocked-by-budget" }
  }
  if (budget.shouldWarn) {
    callbacks.onBudgetWarning(
      budget.usagePercent,
      budget.estimatedInputTokens,
      budget.inputLimit,
    )
  }

  let firstChunk = true
  try {
    callbacks.onStart()
    const response = await streamChat(runtime.history, (chunk) => {
      if (firstChunk) {
        callbacks.onFirstChunk()
        firstChunk = false
      }
      callbacks.onChunk(chunk)
    }, runtime.fileContext.systemMessage())
    runtime.history.push("assistant", response)
    callbacks.onComplete()
    return { status: "completed" }
  } catch (error) {
    callbacks.onProviderError(error)
    return { status: "provider-error", error }
  } finally {
    callbacks.onFinish()
  }
}
