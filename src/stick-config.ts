import "dotenv/config";

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

export const stickConfig = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  elevenlabsApiKey: required("ELEVENLABS_API_KEY"),
  elevenlabsVoiceId: process.env.STICK_ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9",
  edgeTtsVoice: process.env.STICK_EDGE_TTS_VOICE || "fr-FR-HenriNeural",

  youtubeClientId: required("STICK_YOUTUBE_CLIENT_ID"),
  youtubeClientSecret: required("STICK_YOUTUBE_CLIENT_SECRET"),
  youtubeRefreshToken: required("STICK_YOUTUBE_REFRESH_TOKEN"),
  youtubePrivacyStatus: (process.env.STICK_YOUTUBE_PRIVACY_STATUS || "public") as
    | "public"
    | "unlisted"
    | "private",
  youtubeCategoryId: process.env.STICK_YOUTUBE_CATEGORY_ID || "24",

  channelNiche:
    process.env.STICK_CHANNEL_NICHE ||
    "Duels de combattants stickman (bonhommes allumettes) pleins de suspense, avec un twist ou un retournement final",
  channelTone:
    process.env.STICK_CHANNEL_TONE ||
    "épique, dynamique, suspense qui monte crescendo, commentaire façon speaker de combat",
  channelLanguage: process.env.STICK_CHANNEL_LANGUAGE || "français",
};
