import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Renseigne le secret correspondant dans les ` +
        `paramètres GitHub Actions.`,
    );
  }
  return value;
}

export const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

/** Extrait le premier bloc JSON valide (objet ou tableau) d'une réponse texte de Claude. */
export function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Réponse de Claude sans JSON exploitable : ${text.slice(0, 300)}`);
  }
  return JSON.parse(match[0]) as T;
}

/** Extrait spécifiquement un objet JSON ({...}), en ignorant tout tableau présent dans le texte. */
export function extractJsonObject<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Réponse de Claude sans objet JSON exploitable : ${text.slice(0, 300)}`);
  }
  return JSON.parse(match[0]) as T;
}
