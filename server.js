// ═══════════════════════════════════════════════════
// server.js — Serveur Express pour Render.com
// ═══════════════════════════════════════════════════
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques depuis le dossier courant
app.use(express.static(path.join(__dirname, 'public')));

// Route principale : servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback 404
app.use((req, res) => {
  res.status(404).send('Page non trouvée');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
