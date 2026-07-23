import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

export const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** Extrait le premier bloc JSON valide d'une réponse texte de Claude. */
export function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Réponse de Claude sans JSON exploitable : ${text.slice(0, 300)}`);
  }
  return JSON.parse(match[0]) as T;
}
