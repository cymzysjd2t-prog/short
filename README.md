# YouTube Shorts Autopilot

Pipeline 100% automatique, un run par jour :

```
sujet (backlog ou idéation Claude)
  -> script + titre + description + tags (Claude)
  -> vidéo montée : voix off + sous-titres + visuels (Creatomate)
  -> publication directe sur YouTube (YouTube Data API v3)
  -> historique + backlog mis à jour et commités automatiquement
```

Le tout tourne sur **GitHub Actions** (cron quotidien), sans serveur à maintenir.

## Prérequis (comptes à créer)

1. **Anthropic** — clé API sur [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. **Creatomate** — compte + template vidéo vertical. Suis **[creatomate/template-guide.md](./creatomate/template-guide.md)**
   pour le créer (étape manuelle unique, l'éditeur visuel n'a pas d'équivalent API).
3. **Google Cloud / YouTube** :
   - Crée un projet sur [console.cloud.google.com](https://console.cloud.google.com/).
   - Active l'**YouTube Data API v3** (APIs & Services → Library).
   - Crée un **OAuth client ID** de type **"Desktop app"** (APIs & Services → Credentials).
   - Ajoute le compte YouTube cible comme "Test user" si l'app OAuth est en mode "Testing"
     (sinon Google révoque l'accès après 7 jours).

## Setup local

```bash
npm install
cp .env.example .env
# remplis ANTHROPIC_API_KEY, CREATOMATE_API_KEY, CREATOMATE_TEMPLATE_ID,
# YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, CHANNEL_NICHE/TONE/LANGUAGE

# obtention du refresh token YouTube (une seule fois) :
npm run get-youtube-token
# ouvre l'URL affichée, connecte-toi avec le compte YouTube cible,
# copie le YOUTUBE_REFRESH_TOKEN affiché dans le terminal vers .env

# test d'un cycle complet en local :
npm run publish
```

Pour un premier test sans risque, mets `YOUTUBE_PRIVACY_STATUS="private"` dans `.env` le temps de
valider la qualité du montage, puis repasse en `"public"`.

## Activer l'automatisation quotidienne (GitHub Actions)

Dans **Settings → Secrets and variables → Actions** du dépôt, ajoute ces secrets (mêmes noms que
dans `.env.example`) :

`ANTHROPIC_API_KEY`, `CREATOMATE_API_KEY`, `CREATOMATE_TEMPLATE_ID`, `YOUTUBE_CLIENT_ID`,
`YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_PRIVACY_STATUS`, `YOUTUBE_CATEGORY_ID`,
`CHANNEL_NICHE`, `CHANNEL_TONE`, `CHANNEL_LANGUAGE`.

Le workflow [`.github/workflows/publish-daily-short.yml`](./.github/workflows/publish-daily-short.yml)
tourne chaque jour à 15:00 UTC (modifiable via le champ `cron`), et peut aussi être déclenché
manuellement depuis l'onglet **Actions → Publish Daily YouTube Short → Run workflow**.

Après chaque run, `data/topics.json` (backlog restant) et `data/history.json` (vidéos publiées)
sont commités automatiquement sur la branche par défaut — c'est ce qui permet à un run stateless
de GitHub Actions de se souvenir de ce qui a déjà été fait.

## Personnalisation

- **Sujets** : édite `data/topics.json` (tableau d'objets `{id, title, createdAt}`) pour imposer
  tes propres idées ; laisse-le vide pour que Claude en génère automatiquement à partir de
  `CHANNEL_NICHE`.
- **Cadence** : change le `cron` dans le workflow (ex. `0 15 * * 1,3,5` pour lundi/mercredi/vendredi).
- **Style visuel** : entièrement dans le template Creatomate, pas dans le code.
- **Validation humaine avant publication** : si tu préfères ne pas publier automatiquement,
  mets `YOUTUBE_PRIVACY_STATUS="private"` en permanence — les vidéos sont uploadées mais restent
  privées jusqu'à ce que tu les passes en public toi-même depuis YouTube Studio.

## Limitations assumées

- **Fond vidéo fixe** : le template Creatomate a un visuel de fond défini une fois pour toutes,
  pas choisi dynamiquement selon le sujet du jour (nécessiterait une recherche de stock footage
  par mots-clés, ex. API Pexels — non branché ici pour rester simple).
- **Pas de génération de miniature dédiée** : YouTube choisit automatiquement une image du
  contenu vidéo comme vignette. Une miniature personnalisée demanderait un appel supplémentaire
  (`thumbnails.set`) avec une image générée séparément.
- **Pas de revue humaine avant publication** (choix assumé : automatisation complète demandée) —
  le risque en cas de dérive de script (contenu hors-sujet, erreur factuelle) est réel puisque
  rien ne bloque la publication. Le garde-fou recommandé est de repasser périodiquement sur
  `data/history.json` et les vidéos publiées.
- **Un seul essai par étape** : pas de retry automatique en cas d'échec transitoire d'API
  (Claude/Creatomate/YouTube) — un run raté échoue proprement (le sujet reste retiré de la file,
  donc le prochain run traitera un nouveau sujet plutôt que de retenter le même). À améliorer si
  les échecs deviennent fréquents.
- **Quota YouTube** : l'upload d'une vidéo coûte ~1600 unités sur un quota par défaut de 10 000
  unités/jour — largement suffisant pour 1 Short/jour, à surveiller si la cadence augmente
  fortement (option "Plusieurs par jour" écartée dans le choix initial pour cette raison).
