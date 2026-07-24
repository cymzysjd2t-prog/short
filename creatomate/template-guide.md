# Créer le template Creatomate

Le code de ce projet ne fait qu'envoyer du **texte** à Creatomate (script de voix off, titre) ;
c'est le template — que tu construis une fois dans leur éditeur visuel — qui définit à quoi
ressemble la vidéo (fond, style des sous-titres, voix, habillage). Creatomate n'a pas d'API pour
créer un template depuis du code : cette étape se fait à la main, une seule fois.

## 1. Créer le projet et le template

1. Crée un compte sur [creatomate.com](https://creatomate.com) et un projet.
2. Dans l'éditeur, crée un nouveau template au format **1080 x 1920** (vertical, ratio 9:16).
3. Note le **Project API Key** (Project → API) → `CREATOMATE_API_KEY`.

## 2. Ajouter les éléments dynamiques

Le pipeline envoie exactement ces trois clés de modification à chaque rendu — les éléments de ton
template doivent porter **ces noms exacts** :

| Nom de l'élément | Type Creatomate | Rôle |
|---|---|---|
| `Voiceover-1` | élément **Text-to-Speech** | Génère la voix off à partir du script. Choisis une voix dans l'éditeur (ElevenLabs/autre selon offre Creatomate). |
| `Caption-1` | élément **Text** avec sous-titres auto | Affiche les sous-titres, idéalement synchronisés sur `Voiceover-1` via l'option "Transcribe source" de Creatomate. |
| `Title-1` | élément **Text** | Titre accrocheur affiché en haut de l'écran pendant les premières secondes. |

Ajoute aussi un fond visuel (vidéo de stock en boucle, image animée, ou plusieurs scènes) — fixe,
non piloté par le code pour l'instant (voir limitation dans le README principal).

## 3. Régler la durée automatique

Dans les paramètres de la piste principale, mets la durée en **"Auto" / liée à `Voiceover-1`** :
la vidéo doit durer exactement le temps de la voix off générée, pas une durée fixe.

## 4. Récupérer l'ID du template

Dans l'éditeur, le template a un ID visible dans l'URL ou via Project → Templates → API →
"Template ID". Renseigne-le dans `CREATOMATE_TEMPLATE_ID`.

## 5. Tester manuellement

Avant de brancher l'automatisation complète, teste un rendu à la main :

```bash
curl -X POST https://api.creatomate.com/v2/renders \
  -H "Authorization: Bearer $CREATOMATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "'"$CREATOMATE_TEMPLATE_ID"'",
    "modifications": {
      "Voiceover-1.text": "Ceci est un test de voix off générée automatiquement.",
      "Caption-1.text": "Ceci est un test de voix off générée automatiquement.",
      "Title-1.text": "Test du pipeline"
    }
  }'
```

Si le rendu réussit et que la vidéo produite te convient (voix, style, timing), le template est prêt.
