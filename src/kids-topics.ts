import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { anthropic, extractJson } from "./claude.js";
import { kidsConfig } from "./kids-config.js";

export interface KidsTopic {
  id: string;
  title: string;
  createdAt: string;
}

const TOPICS_PATH = new URL("../data/topics-kids.json", import.meta.url);
const IDEATION_BATCH_SIZE = 10;
const ideasSchema = z.array(z.string().min(1)).min(1);

async function loadTopics(): Promise<KidsTopic[]> {
  const raw = await readFile(TOPICS_PATH, "utf-8");
  return JSON.parse(raw) as KidsTopic[];
}

async function saveTopics(topics: KidsTopic[]): Promise<void> {
  await writeFile(TOPICS_PATH, `${JSON.stringify(topics, null, 2)}\n`, "utf-8");
}

async function ideateTopics(): Promise<KidsTopic[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          `Tu proposes des thèmes de vidéos YouTube Shorts éducatives pour très jeunes enfants ` +
          `(maternelle), sur : "${kidsConfig.channelNiche}". Donne ${IDEATION_BATCH_SIZE} thèmes courts, ` +
          `chacun exploitable en 20-30 secondes (ex: "Compter de 1 à 5 avec des fruits", "Les lettres A à ` +
          `E avec des animaux", "Les couleurs primaires", "Les formes géométriques simples"). Réponds ` +
          `UNIQUEMENT avec un tableau JSON de chaînes, ex: ["Thème 1", "Thème 2", ...]. Aucun texte avant ` +
          `ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour l'idéation de thèmes enfants.");
  }

  const ideas = ideasSchema.parse(extractJson<string[]>(textBlock.text));
  const now = new Date().toISOString();
  return ideas.map((title) => ({ id: randomUUID(), title, createdAt: now }));
}

export async function getNextKidsTopic(): Promise<KidsTopic> {
  let topics = await loadTopics();

  if (topics.length === 0) {
    console.log("File de thèmes enfants vide — génération d'un nouveau lot via Claude...");
    topics = await ideateTopics();
  }

  const [next, ...rest] = topics;
  if (!next) {
    throw new Error("Impossible d'obtenir un thème enfant : la génération a renvoyé une liste vide.");
  }

  await saveTopics(rest);
  return next;
}
