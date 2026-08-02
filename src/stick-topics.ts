import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { anthropic, extractJson } from "./claude.js";
import { stickConfig } from "./stick-config.js";

export interface StickTopic {
  id: string;
  title: string;
  createdAt: string;
}

const TOPICS_PATH = new URL("../data/topics-stick.json", import.meta.url);
const IDEATION_BATCH_SIZE = 10;
const ideasSchema = z.array(z.string().min(1)).min(1);

async function loadTopics(): Promise<StickTopic[]> {
  const raw = await readFile(TOPICS_PATH, "utf-8");
  return JSON.parse(raw) as StickTopic[];
}

async function saveTopics(topics: StickTopic[]): Promise<void> {
  await writeFile(TOPICS_PATH, `${JSON.stringify(topics, null, 2)}\n`, "utf-8");
}

/** Demande à Claude un lot de nouveaux thèmes de "Top". Appelé quand la file est vide. */
async function ideateTopics(): Promise<StickTopic[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          `Tu proposes des thèmes de vidéos YouTube Shorts "Top" de faits insolites, sur : ` +
          `"${stickConfig.channelNiche}". Donne ${IDEATION_BATCH_SIZE} thèmes courts et concrets, ` +
          `chacun exploitable en un compte à rebours de 4-6 éléments (ex: "Les endroits les plus ` +
          `mystérieux jamais découverts", "Les records les plus fous de la nature", "Les coïncidences ` +
          `les plus troublantes de l'histoire", "Les créatures les plus étranges des océans"). Réponds ` +
          `UNIQUEMENT avec un tableau JSON de chaînes, ex: ["Thème 1", "Thème 2", ...]. Aucun texte avant ` +
          `ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour l'idéation de thèmes Top.");
  }

  const ideas = ideasSchema.parse(extractJson<string[]>(textBlock.text));
  const now = new Date().toISOString();
  return ideas.map((title) => ({ id: randomUUID(), title, createdAt: now }));
}

export async function getNextStickTopic(): Promise<StickTopic> {
  let topics = await loadTopics();

  if (topics.length === 0) {
    console.log("File de thèmes Top vide — génération d'un nouveau lot via Claude...");
    topics = await ideateTopics();
  }

  const [next, ...rest] = topics;
  if (!next) {
    throw new Error("Impossible d'obtenir un thème Top : la génération a renvoyé une liste vide.");
  }

  await saveTopics(rest);
  return next;
}
