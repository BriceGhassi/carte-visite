// ═══════════════════════════════════════════════════════════════
// server.js — Express + API Anthropic (Claude) avec streaming SSE
// Déploiement : Render.com
// Variable d'env requise : ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Route principale ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ════════════════════════════════════════════════════════════
// POST /api/generate-card
// Corps : { brief: { ...données formulaire... } }
// Réponse : Server-Sent Events (streaming HTML de la carte)
// ════════════════════════════════════════════════════════════
app.post('/api/generate-card', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY manquante. Ajoutez-la dans les variables d\'environnement Render.'
    });
  }

  const brief = req.body.brief;
  if (!brief) {
    return res.status(400).json({ error: 'Brief manquant dans le corps de la requête.' });
  }

  // ── En-têtes SSE ─────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering Nginx/Render

  // ── Corps de la requête Anthropic ────────────────────────
  const requestBody = JSON.stringify({
    model:      'claude-opus-4-5',
    max_tokens: 4096,
    stream:     true,
    system: `Tu es un designer graphique expert en identité visuelle et cartes de visite professionnelles.
Ta mission : générer du code HTML/CSS complet et autonome représentant visuellement une carte de visite.

RÈGLES STRICTES :
- Retourne UNIQUEMENT du code HTML valide, sans texte avant ou après le DOCTYPE
- Le HTML doit être autonome (Google Fonts autorisé, pas d'autres dépendances)
- Génère TOUJOURS recto ET verso : deux faces visibles côte à côte (desktop) / empilées (mobile)
- Style cohérent avec le brief : impression, couleurs, typographie, secteur
- N'invente aucune information absente du brief
- Ajoute un bouton "Imprimer cette carte" hors de la carte
- Code bien commenté, prêt à copier-coller dans un fichier .html`,
    messages: [{
      role:    'user',
      content: buildPrompt(brief)
    }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(requestBody)
    }
  };

  // ── Appel API avec streaming ──────────────────────────────
  const apiReq = https.request(options, (apiRes) => {
    let buffer = '';

    apiRes.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Garder la ligne incomplète pour le prochain chunk

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { res.write('event: done\ndata: {}\n\n'); res.end(); return; }

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
          if (parsed.type === 'message_stop') {
            res.write('event: done\ndata: {}\n\n');
            res.end();
          }
        } catch (_) { /* Ignorer les lignes non-JSON */ }
      }
    });

    apiRes.on('end', () => {
      if (!res.writableEnded) { res.write('event: done\ndata: {}\n\n'); res.end(); }
    });

    apiRes.on('error', (err) => {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
    });
  });

  apiReq.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`); res.end(); }
  });

  apiReq.write(requestBody);
  apiReq.end();

  req.on('close', () => apiReq.destroy()); // Nettoyage si client se déconnecte
});

// ════════════════════════════════════════════════════════════
// buildPrompt — Construit le prompt détaillé pour Claude
// ════════════════════════════════════════════════════════════
function buildPrompt(b) {
  const colors   = (b.colors  || []).join(', ') || 'à choisir selon le secteur';
  const styles   = (b.styles  || []).join(', ') || '';
  const finitions = (b.finitions || []).join(', ') || 'aucune';

  return `Génère le code HTML complet d'une carte de visite professionnelle basée sur ce brief :

━━━ IDENTITÉ ━━━
Nom          : ${b.prenom || ''} ${b.nom || ''}
Titre        : ${b.titre || ''}
Entreprise   : ${b.entreprise || ''}
Secteur      : ${b.secteur || ''}
Cible        : ${b.cible || ''}
Slogan       : ${b.slogan || ''}

━━━ CONTACT ━━━
Téléphone    : ${b.tel || ''}${b.tel2 ? ' / ' + b.tel2 : ''}
E-mail       : ${b.email || ''}
Adresse      : ${b.adresse || ''}
Site web     : ${b.web || ''}
LinkedIn     : ${b.linkedin || ''}
Réseaux      : ${b.insta || ''} ${b.autresRs || ''}
QR code      : ${b.qr === 'Oui' ? 'Oui → ' + (b.qrUrl || 'URL à définir') : 'Non'}

━━━ DIRECTION CRÉATIVE ━━━
Impression   : ${b.feel || 'Professionnel'}
Styles       : ${styles}
Palette      : ${colors}${b.couleurAutre ? ' + ' + b.couleurAutre : ''}
Typographie  : ${b.typo || 'adaptée au style'}
Logo         : ${b.logo || 'Non fourni'}
Inspirations : ${b.inspi || ''}
À éviter     : ${b.eviter || ''}

━━━ FORMAT ━━━
Dimensions   : ${b.format || 'Standard 85×55mm'}
Orientation  : ${b.orient || 'Paysage'}
Faces        : ${b.rv || 'Recto-verso'}
Papier       : ${b.papier || ''}
Finitions    : ${finitions}

━━━ INSTRUCTIONS PRÉCISES ━━━

Génère un fichier HTML complet et autonome avec :

**PRÉSENTATION GÉNÉRALE**
- Fond de page neutre (gris clair)
- Titre "Aperçu de votre carte de visite" en haut
- Bouton "Imprimer cette carte" (déclenche window.print())
- Note explicative sur les dimensions réelles

**RECTO DE LA CARTE**
- Dimensions : respecte le ratio 85:55mm (ex : 510px × 330px)
- Intègre : nom complet, titre, entreprise, téléphone, email, site web, slogan
- Si logo absent : crée un monogramme SVG élégant avec les initiales
- Si QR code demandé : dessine un QR code décoratif en SVG (pattern géométrique)
- Design fidèle à l'impression "${b.feel || 'professionnel'}" et aux couleurs ${colors}

**VERSO DE LA CARTE**
- Fond coloré ou motif décoratif cohérent avec le recto
- Peut inclure : liste de services, tagline, pattern géométrique, logo centré
- Doit compléter le recto sans le répéter

**TYPOGRAPHIE**
- Importe une Google Font adaptée au style (pas Arial, pas Inter)
- Pour secteur créatif : fonte expressive ou serif distinctif
- Pour secteur juridique/finance : serif classique (Playfair, Cormorant…)
- Pour tech/startup : geometric sans-serif (Outfit, DM Sans, Syne…)

**CSS**
- Variables CSS pour couleurs et fontes
- Media query @media print : masque tout sauf les cartes, ajuste dimensions
- Responsive : cartes côte à côte sur desktop, empilées sur mobile

Commence directement par <!DOCTYPE html> sans aucun texte avant.`;
}

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));

// ── Démarrage ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Serveur démarré — port ${PORT}`);
  console.log(`  API Claude : ${process.env.ANTHROPIC_API_KEY ? '✓ configurée' : '✗ ANTHROPIC_API_KEY manquante'}`);
});
