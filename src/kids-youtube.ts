import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { kidsConfig } from "./kids-config.js";
import type { KidsScriptResult } from "./kids-script.js";

function getOAuthClient() {
  const client = new google.auth.OAuth2(kidsConfig.youtubeClientId, kidsConfig.youtubeClientSecret);
  client.setCredentials({ refresh_token: kidsConfig.youtubeRefreshToken });
  return client;
}

export async function uploadKidsShort(
  filePath: string,
  script: KidsScriptResult,
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
        categoryId: kidsConfig.youtubeCategoryId,
      },
      status: {
        privacyStatus: kidsConfig.youtubePrivacyStatus,
        selfDeclaredMadeForKids: true,
      },
    },
    media: {
      body: createReadStream(filePath),
    },
  });

  const videoId = res.data.id;
  if (!videoId) {
    throw new Error("L'upload YouTube (chaîne enfants) a réussi mais n'a renvoyé aucun ID de vidéo.");
  }

  return { videoId, url: `https://youtube.com/shorts/${videoId}` };
}
