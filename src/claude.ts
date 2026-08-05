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

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
}

async function generateWithGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = required("GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API -> ${res.status}: ${body}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("La réponse de Gemini a été tronquée (limite maxOutputTokens atteinte).");
  }

  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    throw new Error("Gemini n'a renvoyé aucun texte exploitable.");
  }

  return text;
}

/**
 * Génère du texte via Claude (Anthropic), avec repli automatique et gratuit sur Gemini si
 * Claude échoue (ex: crédit Anthropic épuisé). Dès que le crédit Anthropic est de nouveau
 * disponible, Claude redevient utilisé automatiquement, sans aucun changement de config.
 */
export async function generateText(params: { prompt: string; maxTokens: number }): Promise<string> {
  try {
    return await generateWithAnthropic(params.prompt, params.maxTokens);
  } catch (err) {
    console.warn(
      `Claude (Anthropic) indisponible (${err instanceof Error ? err.message : err}) — repli sur Gemini (gratuit).`,
    );
    return generateWithGemini(params.prompt, params.maxTokens);
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
