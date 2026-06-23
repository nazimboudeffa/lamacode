// Pointe vers le serveur OpenAI-compatible de LM Studio
export const config = {
  baseURL: process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1",
  // LM Studio n'a pas besoin de clé API, mais le client OpenAI en exige une (vide suffit)
  apiKey: "lm-studio",
  // Modèle chargé dans LM Studio (doit correspondre exactement au nom affiché)
  defaultModel: process.env.LMSTUDIO_MODEL ?? "local-model",
}
