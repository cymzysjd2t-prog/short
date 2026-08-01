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

export const kidsConfig = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  elevenlabsApiKey: required("ELEVENLABS_API_KEY"),
  elevenlabsVoiceId: process.env.KIDS_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
  edgeTtsVoice: process.env.KIDS_EDGE_TTS_VOICE || "fr-FR-DeniseNeural",

  pexelsApiKey: required("PEXELS_API_KEY"),

  youtubeClientId: required("KIDS_YOUTUBE_CLIENT_ID"),
  youtubeClientSecret: required("KIDS_YOUTUBE_CLIENT_SECRET"),
  youtubeRefreshToken: required("KIDS_YOUTUBE_REFRESH_TOKEN"),
  youtubePrivacyStatus: (process.env.KIDS_YOUTUBE_PRIVACY_STATUS || "public") as
    | "public"
    | "unlisted"
    | "private",
  youtubeCategoryId: process.env.KIDS_YOUTUBE_CATEGORY_ID || "27",

  channelNiche:
    process.env.KIDS_CHANNEL_NICHE || "Apprentissage pour tout-petits : chiffres, lettres, couleurs, formes",
  channelTone: process.env.KIDS_CHANNEL_TONE || "doux, joyeux, simple, répétitif, adapté aux tout-petits",
  channelLanguage: process.env.KIDS_CHANNEL_LANGUAGE || "français",
};
