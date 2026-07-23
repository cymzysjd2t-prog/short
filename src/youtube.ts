import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { config } from "./config.js";
import type { ScriptResult } from "./types.js";

function getOAuthClient() {
  const client = new google.auth.OAuth2(config.youtubeClientId, config.youtubeClientSecret);
  client.setCredentials({ refresh_token: config.youtubeRefreshToken });
  return client;
}

/**
 * Upload une vidéo sur YouTube et la publie directement (statut selon YOUTUBE_PRIVACY_STATUS).
 * Ajoute #Shorts à la description pour garantir le classement dans l'onglet Shorts.
 */
export async function uploadShort(
  filePath: string,
  script: ScriptResult,
): Promise<{ videoId: string; url: string }> {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const description = script.description.includes("#Shorts")
    ? script.description
    : `${script.description}\n\n#Shorts`;

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: script.title,
        description,
        tags: script.tags,
        categoryId: config.youtubeCategoryId,
      },
      status: {
        privacyStatus: config.youtubePrivacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(filePath),
    },
  });

  const videoId = res.data.id;
  if (!videoId) {
    throw new Error("L'upload YouTube a réussi mais n'a renvoyé aucun ID de vidéo.");
  }

  return { videoId, url: `https://youtube.com/shorts/${videoId}` };
}
