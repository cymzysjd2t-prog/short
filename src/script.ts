import { z } from "zod";
import { anthropic, extractJson } from "./claude.js";
import { config } from "./config.js";
import type { ScriptResult, Topic } from "./types.js";

const scriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  voiceoverScript: z.string().min(1),
});

/**
 * Génère le script complet d'un Short (titre, description, tags, texte de voix off)
 * à partir d'un sujet. Le texte de voix off est ensuite envoyé tel quel à Creatomate,
 * qui se charge de la synthèse vocale et des sous-titres.
 */
export async function generateScript(topic: Topic): Promise<ScriptResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1536,
    messages: [
      {
        role: "user",
        content:
          `Tu écris le script d'un YouTube Short (vidéo verticale, 45 à 60 secondes) sur le sujet : ` +
          `"${topic.title}". Chaîne : "${config.channelNiche}". Ton : ${config.channelTone}. ` +
          `Langue : ${config.channelLanguage}.\n\n` +
          `Contraintes :\n` +
          `- "voiceoverScript" : texte de narration seul (pas de didascalies, pas de "[SCENE]"), ` +
          `entre 120 et 160 mots, qui accroche dans les 3 premières secondes et se termine sur une ` +
          `phrase de conclusion nette. Écrit pour être lu à voix haute par une synthèse vocale.\n` +
          `- "title" : titre YouTube percutant, 100 caractères max, sans clickbait mensonger.\n` +
          `- "description" : 2-3 phrases + 3-5 hashtags pertinents dont #Shorts.\n` +
          `- "tags" : 8 à 15 mots-clés YouTube pertinents (pas de hashtags, juste des mots/expressions).\n\n` +
          `Réponds UNIQUEMENT avec un objet JSON de la forme ` +
          `{"title": "...", "description": "...", "tags": ["...", "..."], "voiceoverScript": "..."}. ` +
          `Aucun texte avant ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour la génération du script.");
  }

  return scriptSchema.parse(extractJson<ScriptResult>(textBlock.text));
}
