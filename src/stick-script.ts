import { z } from "zod";
import { anthropic, extractJsonObject } from "./claude.js";
import { stickConfig } from "./stick-config.js";
import { MOVE_NAMES, type MoveName } from "./stick-animate.js";
import type { StickTopic } from "./stick-topics.js";

export interface FightBeat {
  moveA: MoveName;
  moveB: MoveName;
  narration: string;
  caption: string;
}

export interface StickScriptResult {
  title: string;
  description: string;
  tags: string[];
  fighterAName: string;
  fighterBName: string;
  beats: FightBeat[];
}

const moveEnum = z.enum(MOVE_NAMES as [MoveName, ...MoveName[]]);

const beatSchema = z.object({
  moveA: moveEnum,
  moveB: moveEnum,
  narration: z.string().min(1),
  caption: z.string().min(1),
});

const stickScriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  fighterAName: z.string().min(1),
  fighterBName: z.string().min(1),
  beats: z.array(beatSchema).min(6).max(14),
});

const MOVES_DOC = `
- "idle" : posture de garde, ne bouge pas d'attaque
- "walk_in" : avance vers l'adversaire (à utiliser uniquement en tout début de duel)
- "punch" : coup de poing direct
- "kick" : coup de pied
- "block" : se protège, encaisse une attaque sans tomber
- "dodge" : esquive latérale, évite une attaque
- "hit_stagger" : recule sous le choc après avoir été touché (ne tombe pas)
- "fall" : s'effondre au sol (uniquement pour le combattant qui perd le duel, en toute fin)
- "victory" : lève les bras en signe de victoire (uniquement pour le vainqueur, en toute fin)
`.trim();

/**
 * Génère le scénario chorégraphié d'un duel stickman : une suite de "beats" simultanés pour
 * les deux combattants (moveA / moveB), avec narration et légende par beat. Les mouvements
 * sont contraints à la bibliothèque d'animations disponible (voir stick-animate.ts).
 */
export async function generateStickScript(topic: StickTopic): Promise<StickScriptResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content:
          `Tu écris la chorégraphie d'un duel entre deux combattants stickman (bonhommes allumettes) pour ` +
          `un YouTube Short, sur le thème : "${topic.title}". Chaîne : "${stickConfig.channelNiche}". ` +
          `Ton : ${stickConfig.channelTone}. Langue : ${stickConfig.channelLanguage}.\n\n` +
          `Le duel est découpé en "beats" (moments) successifs. À chaque beat, les DEUX combattants ` +
          `(A et B) font simultanément un mouvement choisi STRICTEMENT parmi cette liste :\n${MOVES_DOC}\n\n` +
          `Règles de cohérence :\n` +
          `- Beat 1 : les deux combattants font "walk_in" (ils s'approchent l'un de l'autre).\n` +
          `- Quand un combattant fait "punch" ou "kick", l'autre doit réagir avec "block", "dodge" ou ` +
          `"hit_stagger" au même beat (jamais "idle" face à une attaque).\n` +
          `- Alterne qui attaque et qui subit pour créer du suspense (l'avantage bascule plusieurs fois).\n` +
          `- Le tout dernier beat : le perdant fait "fall" et le vainqueur fait "victory".\n` +
          `- Entre 6 et 14 beats au total.\n` +
          `- "narration" : une phrase courte (5-15 mots) dite par un narrateur/speaker façon commentateur ` +
          `de combat, qui monte en tension, avec un vrai twist ou retournement de situation avant la fin.\n` +
          `- "caption" : texte court affiché à l'écran pour ce beat (peut reprendre ou résumer la narration).\n\n` +
          `Contraintes générales :\n` +
          `- "fighterAName" / "fighterBName" : noms ou titres courts des deux combattants (ex: "Le Ninja", ` +
          `"Le Colosse").\n` +
          `- "title" : titre YouTube accrocheur qui donne envie de regarder jusqu'à la fin, 100 caractères max.\n` +
          `- "description" : 1-2 phrases + 3-5 hashtags pertinents dont #Shorts.\n` +
          `- "tags" : 8 à 15 mots-clés pertinents.\n\n` +
          `Réponds UNIQUEMENT avec un objet JSON de la forme {"title": "...", "description": "...", ` +
          `"tags": ["...", "..."], "fighterAName": "...", "fighterBName": "...", "beats": ` +
          `[{"moveA": "...", "moveB": "...", "narration": "...", "caption": "..."}, ...]}. Aucun texte ` +
          `avant ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour la génération du scénario stickman.");
  }

  return stickScriptSchema.parse(extractJsonObject<StickScriptResult>(textBlock.text));
}
