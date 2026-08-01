import { z } from "zod";
import { anthropic, extractJsonObject } from "./claude.js";
import { kidsConfig } from "./kids-config.js";
import type { KidsTopic } from "./kids-topics.js";

export interface KidsItem {
  label: string;
  line: string;
  visualKeyword: string;
}

export interface KidsScriptResult {
  title: string;
  description: string;
  tags: string[];
  items: KidsItem[];
}

const itemSchema = z.object({
  label: z.string().min(1),
  line: z.string().min(1),
  visualKeyword: z.string().min(1),
});

const kidsScriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  items: z.array(itemSchema).min(3).max(10),
});

export async function generateKidsScript(topic: KidsTopic): Promise<KidsScriptResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content:
          `Tu écris le script d'un YouTube Short pour très jeunes enfants (maternelle), sur le thème : ` +
          `"${topic.title}". Chaîne : "${kidsConfig.channelNiche}". Ton : ${kidsConfig.channelTone}. ` +
          `Langue : ${kidsConfig.channelLanguage}.\n\n` +
          `Le Short est découpé en plusieurs "items" successifs (un chiffre, une lettre, une couleur ou ` +
          `une forme à la fois). Pour chaque item, donne :\n` +
          `- "label" : le mot ou symbole affiché en très grand à l'écran (ex: "1", "A", "Rouge", "Rond").\n` +
          `- "line" : UNE phrase très courte et simple (5 à 10 mots max), dite à voix haute, qui ` +
          `présente cet item de façon ludique (ex: "Un, comme un seul petit soleil !").\n` +
          `- "visualKeyword" : 2 à 4 mots EN ANGLAIS décrivant une scène filmable, joyeuse et 100% ` +
          `adaptée aux enfants pour illustrer cet item en fond vidéo (ex: "child counting apples", ` +
          `"colorful toy blocks", "kids playing outside", "cute farm animals") — sert à chercher une ` +
          `vidéo de stock. Toujours une scène concrète avec des enfants, des jouets, des animaux ou la ` +
          `nature — jamais rien d'inquiétant ni d'ambigu.\n\n` +
          `Contraintes :\n` +
          `- Entre 4 et 8 items, dans un ordre logique (ex: 1,2,3,4,5 ou A,B,C,D,E).\n` +
          `- Vocabulaire ultra simple, phrases courtes, ton joyeux et bienveillant. RIEN d'effrayant, ` +
          `de violent ou de complexe. Contenu 100% adapté et sûr pour de très jeunes enfants.\n` +
          `- "title" : titre YouTube simple et clair, 100 caractères max.\n` +
          `- "description" : 1-2 phrases + 3-5 hashtags pertinents dont #Shorts #Kids.\n` +
          `- "tags" : 8 à 15 mots-clés pertinents pour du contenu enfant.\n\n` +
          `Réponds UNIQUEMENT avec un objet JSON de la forme {"title": "...", "description": "...", ` +
          `"tags": ["...", "..."], "items": [{"label": "...", "line": "...", "visualKeyword": "..."}, ...]}. ` +
          `Aucun texte avant ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour la génération du script enfant.");
  }

  return kidsScriptSchema.parse(extractJsonObject<KidsScriptResult>(textBlock.text));
}
