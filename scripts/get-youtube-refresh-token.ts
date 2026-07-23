/**
 * Utilitaire à lancer UNE SEULE FOIS en local pour obtenir le refresh token YouTube.
 * Usage : npm run get-youtube-token
 *
 * Prérequis : YOUTUBE_CLIENT_ID et YOUTUBE_CLIENT_SECRET dans .env (créés dans Google Cloud
 * Console -> APIs & Services -> Credentials -> OAuth client ID -> type "Desktop app").
 */
import "dotenv/config";
import { createServer } from "node:http";
import { google } from "googleapis";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("YOUTUBE_CLIENT_ID et YOUTUBE_CLIENT_SECRET doivent être définis dans .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // force le renvoi d'un refresh_token même si déjà autorisé auparavant
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
});

console.log("\nOuvre cette URL dans un navigateur, connecte-toi avec le compte YouTube cible, et accepte :\n");
console.log(authUrl);
console.log(`\nEn attente de la redirection sur ${REDIRECT_URI} ...\n`);

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }

  const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Code d'autorisation manquant.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Autorisation réussie</h1><p>Tu peux fermer cet onglet et revenir au terminal.</p>");

    console.log("Refresh token obtenu — ajoute-le à .env (et aux secrets GitHub Actions) :\n");
    console.log(`YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
  } catch (err) {
    res.writeHead(500).end("Échec de l'échange du code contre un token.");
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT);
