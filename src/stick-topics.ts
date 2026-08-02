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

/** Demande à Claude un lot de nouveaux scénarios de duel. Appelé quand la file est vide. */
async function ideateTopics(): Promise<StickTopic[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          `Tu proposes des scénarios de duels pour une chaîne YouTube Shorts de combats stickman ` +
          `(bonhommes allumettes animés), sur : "${stickConfig.channelNiche}". Donne ${IDEATION_BATCH_SIZE} ` +
          `scénarios courts, chacun un affrontement entre deux combattants avec un archétype ou une arme ` +
          `distincte (ex: "Le ninja silencieux contre le guerrier lourdement armé", "Le champion invaincu ` +
          `contre l'outsider inconnu", "Duel au sommet d'un gratte-ciel, un seul survivra"). Chaque scénario ` +
          `doit se prêter à un twist final surprenant. Réponds UNIQUEMENT avec un tableau JSON de chaînes, ` +
          `ex: ["Scénario 1", "Scénario 2", ...]. Aucun texte avant ou après le JSON.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a renvoyé aucun contenu texte pour l'idéation de scénarios stickman.");
  }

  const ideas = ideasSchema.parse(extractJson<string[]>(textBlock.text));
  const now = new Date().toISOString();
  return ideas.map((title) => ({ id: randomUUID(), title, createdAt: now }));
}

export async function getNextStickTopic(): Promise<StickTopic> {
  let topics = await loadTopics();

  if (topics.length === 0) {
    console.log("File de scénarios stickman vide — génération d'un nouveau lot via Claude...");
    topics = await ideateTopics();
  }

  const [next, ...rest] = topics;
  if (!next) {
    throw new Error("Impossible d'obtenir un scénario stickman : la génération a renvoyé une liste vide.");
  }

  await saveTopics(rest);
  return next;
}
