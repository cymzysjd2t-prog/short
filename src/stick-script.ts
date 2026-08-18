import { z } from "zod";
import { extractJsonObject, generateText } from "./claude.js";
import { stickConfig } from "./stick-config.js";
import type { StickTopic } from "./stick-topics.js";

export interface StickFactItem {
  rank: number;
  label: string;
  text: string;
  visualKeyword: string;
}

export interface StickScriptResult {
  title: string;
  description: string;
  tags: string[];
  intro: string;
  introVisualKeyword: string;
  facts: StickFactItem[];
}

const factSchema = z.object({
  rank: z.number().int().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  visualKeyword: z.string().min(1),
});

const stickScriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  intro: z.string().min(1),
  introVisualKeyword: z.string().min(1),
  facts: z.array(factSchema).min(4).max(6),
});

/**
 * Génère le script d'un Short "Top" façon Bright Side / WatchMojo : un compte à rebours de
 * faits insolites, du moins impressionnant au plus surprenant, chacun avec un texte à dire et
 * un mot-clé pour chercher une vraie vidéo de stock (Pexels) en fond.
 */
export async function generateStickScript(topic: StickTopic): Promise<StickScriptResult> {
  const text = await generateText({
    maxTokens: 4096,
    prompt:
      `Tu écris le script d'un YouTube Short "Top" de faits insolites, sur le thème : ` +
      `"${topic.title}". Chaîne : "${stickConfig.channelNiche}". Ton : ${stickConfig.channelTone}. ` +
      `Langue : ${stickConfig.channelLanguage}.\n\n` +
      `Le Short est un compte à rebours de 4 à 6 faits/éléments, classés du moins surprenant au ` +
      `plus surprenant (le meilleur/le plus fou en dernier, pour donner envie de regarder jusqu'au ` +
      `bout). Pour chaque élément, donne :\n` +
      `- "rank" : le numéro dans le classement, en ordre décroissant en partant du nombre total ` +
      `(ex: pour 5 éléments : 5, 4, 3, 2, 1).\n` +
      `- "label" : le texte court affiché en très grand à l'écran (ex: "N°5", "#5").\n` +
      `- "text" : 1 à 2 phrases percutantes racontant ce fait précis de façon vivante, dites à voix ` +
      `haute (pas juste une liste de mots).\n` +
      `- "visualKeyword" : 2 à 4 mots EN ANGLAIS décrivant une scène ou un sujet filmable et neutre ` +
      `pour illustrer ce fait en fond vidéo (ex: "deep ocean creature", "ancient egyptian ruins", ` +
      `"ancient ruins", "lightning storm") — sert à chercher une vidéo de stock réelle. Toujours une ` +
      `scène concrète et sûre, jamais rien de choquant, violent ou explicite.\n\n` +
      `- "intro" : une phrase d'accroche courte, DITE À VOIX HAUTE tout au début de la vidéo, qui ` +
      `annonce clairement le classement, par exemple "TOP 5 des endroits les plus insolites au ` +
      `monde !". Elle doit OBLIGATOIREMENT commencer par "TOP " suivi du nombre exact d'éléments ` +
      `(le même nombre que la longueur du tableau "facts"), puis une courte accroche sur le thème.\n` +
      `- "introVisualKeyword" : 2 à 4 mots EN ANGLAIS décrivant une scène générale et neutre liée au ` +
      `thème pour illustrer l'accroche en fond vidéo.\n\n` +
      `Contraintes :\n` +
      `- Entre 4 et 6 éléments au total, et le nombre annoncé dans "intro" doit être EXACTEMENT égal ` +
      `au nombre d'éléments dans "facts".\n` +
      `- Ton direct et percutant, phrases courtes, monte en intensité jusqu'à la révélation finale.\n` +
      `- "title" : titre YouTube accrocheur façon "Top 5 ...", donne envie de regarder jusqu'à la fin, ` +
      `100 caractères max.\n` +
      `- "description" : 1-2 phrases + 3-5 hashtags pertinents dont #Shorts.\n` +
      `- "tags" : 8 à 15 mots-clés pertinents.\n\n` +
      `Réponds UNIQUEMENT avec un objet JSON de la forme {"title": "...", "description": "...", ` +
      `"tags": ["...", "..."], "intro": "...", "introVisualKeyword": "...", "facts": [{"rank": ..., ` +
      `"label": "...", "text": "...", "visualKeyword": "..."}, ...]}. Aucun texte avant ou après le JSON.`,
  });

  return stickScriptSchema.parse(extractJsonObject<StickScriptResult>(text));
}
