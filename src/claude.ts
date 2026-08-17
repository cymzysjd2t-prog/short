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

const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

async function generateWithAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("La réponse de Claude a été tronquée (limite max_tokens atteinte).");
  }

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte.");
  }

  return textBlock.text;
}

interface GroqResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

async function generateWithGroq(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = required("GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "   model:"openai/gpt-oss-120b",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API -> ${res.status}: ${body}`);
  }

  const data = (await res.json()) as GroqResponse;
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error("La réponse de Groq a été tronquée (limite max_tokens atteinte).");
  }

  const text = choice?.message?.content ?? "";
  if (!text) {
    throw new Error("Groq n'a renvoyé aucun texte exploitable.");
  }

  return text;
}

/**
 * Génère du texte via Claude (Anthropic), avec repli automatique et gratuit sur Groq si
 * Claude échoue (ex: crédit Anthropic épuisé). Dès que le crédit Anthropic est de nouveau
 * disponible, Claude redevient utilisé automatiquement, sans aucun changement de config.
 */
export async function generateText(params: { prompt: string; maxTokens: number }): Promise<string> {
  try {
    return await generateWithAnthropic(params.prompt, params.maxTokens);
  } catch (err) {
    console.warn(
      `Claude (Anthropic) indisponible (${err instanceof Error ? err.message : err}) — repli sur Groq (gratuit).`,
    );
    return generateWithGroq(params.prompt, params.maxTokens);
  }
}

/** Extrait le premier bloc JSON valide (objet ou tableau) d'une réponse texte du modèle. */
export function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Réponse du modèle sans JSON exploitable : ${text.slice(0, 300)}`);
  }
  return JSON.parse(match[0]) as T;
}

/** Extrait spécifiquement un objet JSON ({...}), en ignorant tout tableau présent dans le texte. */
export function extractJsonObject<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Réponse du modèle sans objet JSON exploitable : ${text.slice(0, 300)}`);
  }
  return JSON.parse(match[0]) as T;
}
