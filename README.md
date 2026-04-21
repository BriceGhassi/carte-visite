# StudioBrief — Questionnaire Carte de Visite

Application web de création de carte de visite propulsée par Claude AI.

## Structure
```
carte-visite/
├── public/
│   └── index.html     ← Application complète (formulaire + brief + génération IA)
├── server.js          ← Serveur Express + route API Claude (streaming SSE)
├── package.json
└── .env.example       ← Modèle de variables d'environnement
```

## Déploiement sur Render.com

1. Poussez ce dossier sur GitHub
2. Créez un "Web Service" sur render.com
3. Paramètres :
   - Build Command : `npm install`
   - Start Command : `npm start`
4. Variables d'environnement (dans Render > Environment) :
   - `ANTHROPIC_API_KEY` = votre clé depuis console.anthropic.com

## Test local

```bash
cp .env.example .env
# Renseignez votre clé dans .env

npm install
node -e "require('dotenv').config()" && node server.js
# Ouvrir http://localhost:3000
```

Ou avec dotenv installé :
```bash
npm install dotenv
node -r dotenv/config server.js
```

## Fonctionnement

1. Formulaire en 6 sections → collecte toutes les données du brief
2. Page brief → résumé + recommandations automatiques
3. Génération IA → Claude génère le HTML de la carte en streaming temps réel
   - Aperçu visuel live dans une iframe
   - Onglet code source
   - Téléchargement HTML
   - Régénération possible
