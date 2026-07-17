import express from 'express';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BRAINROTS_FILE = path.join(DATA_DIR, 'brainrots.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'brainrot123';

const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic', 'god'];

const app = express();
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public', 'client')));

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res, next) {
  if (req.get('x-admin-key') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe admin invalide.' });
  }
  next();
}

/* ---------- Admin login ---------- */

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  res.json({ ok: true });
});

/* ---------- Settings (site appearance) ---------- */

app.get('/api/settings', async (req, res) => {
  res.json(await readJson(SETTINGS_FILE));
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  const current = await readJson(SETTINGS_FILE);
  const allowed = [
    'shopName', 'tagline', 'logoEmoji', 'primaryColor', 'accentColor',
    'bannerEnabled', 'bannerText', 'heroTitle', 'heroSubtitle',
    'customCss', 'customJs', 'customHtml'
  ];
  for (const key of allowed) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
      current[key] = req.body[key];
    }
  }
  await writeJson(SETTINGS_FILE, current);
  res.json(current);
});

/* ---------- Brainrots (catalog) ---------- */

app.get('/api/brainrots', async (req, res) => {
  res.json(await readJson(BRAINROTS_FILE));
});

app.post('/api/brainrots', requireAdmin, async (req, res) => {
  const { name, emoji, rarity, price, stock, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Le nom est obligatoire.' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Le prix doit être un nombre positif.' });
  }
  if (!RARITIES.includes(rarity)) {
    return res.status(400).json({ error: 'Rareté invalide.' });
  }
  const brainrots = await readJson(BRAINROTS_FILE);
  const item = {
    id: randomUUID(),
    name: name.trim(),
    emoji: emoji || '🐸',
    rarity,
    price,
    stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  brainrots.push(item);
  await writeJson(BRAINROTS_FILE, brainrots);
  res.status(201).json(item);
});

app.put('/api/brainrots/:id', requireAdmin, async (req, res) => {
  const brainrots = await readJson(BRAINROTS_FILE);
  const idx = brainrots.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Brainrot introuvable.' });

  const { name, emoji, rarity, price, stock, description } = req.body || {};
  if (name !== undefined) brainrots[idx].name = String(name).trim();
  if (emoji !== undefined) brainrots[idx].emoji = emoji;
  if (rarity !== undefined) {
    if (!RARITIES.includes(rarity)) return res.status(400).json({ error: 'Rareté invalide.' });
    brainrots[idx].rarity = rarity;
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) return res.status(400).json({ error: 'Prix invalide.' });
    brainrots[idx].price = price;
  }
  if (stock !== undefined) brainrots[idx].stock = Math.max(0, Math.floor(stock));
  if (description !== undefined) brainrots[idx].description = description;

  await writeJson(BRAINROTS_FILE, brainrots);
  res.json(brainrots[idx]);
});

app.delete('/api/brainrots/:id', requireAdmin, async (req, res) => {
  const brainrots = await readJson(BRAINROTS_FILE);
  const next = brainrots.filter((b) => b.id !== req.params.id);
  if (next.length === brainrots.length) return res.status(404).json({ error: 'Brainrot introuvable.' });
  await writeJson(BRAINROTS_FILE, next);
  res.status(204).end();
});

/* ---------- Orders (cart checkout) ---------- */

app.get('/api/orders', requireAdmin, async (req, res) => {
  const orders = await readJson(ORDERS_FILE);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/orders', async (req, res) => {
  const { items, buyerName, buyerContact } = req.body || {};

  if (!buyerName || !String(buyerName).trim()) {
    return res.status(400).json({ error: 'Ton nom est obligatoire.' });
  }
  if (!buyerContact || !String(buyerContact).trim()) {
    return res.status(400).json({ error: 'Un moyen de te contacter (email, Discord...) est obligatoire.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Le panier est vide.' });
  }

  const brainrots = await readJson(BRAINROTS_FILE);
  const resolvedItems = [];

  for (const raw of items) {
    const qty = Number.isFinite(raw.quantity) ? Math.floor(raw.quantity) : 0;
    if (qty < 1) return res.status(400).json({ error: 'Quantité invalide dans le panier.' });
    const product = brainrots.find((b) => b.id === raw.brainrotId);
    if (!product) return res.status(404).json({ error: 'Un brainrot du panier n\'existe plus.' });
    if (product.stock < qty) {
      return res.status(409).json({ error: `Stock insuffisant pour ${product.name} (${product.stock} disponible${product.stock > 1 ? 's' : ''}).` });
    }
    resolvedItems.push({ product, qty });
  }

  for (const { product, qty } of resolvedItems) {
    product.stock -= qty;
  }
  await writeJson(BRAINROTS_FILE, brainrots);

  const orderItems = resolvedItems.map(({ product, qty }) => ({
    brainrotId: product.id,
    name: product.name,
    emoji: product.emoji,
    unitPrice: product.price,
    quantity: qty
  }));
  const total = Math.round(orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;

  const orders = await readJson(ORDERS_FILE);
  const order = {
    id: randomUUID(),
    items: orderItems,
    total,
    buyerName: String(buyerName).trim(),
    buyerContact: String(buyerContact).trim(),
    status: 'en_attente',
    seen: false,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  await writeJson(ORDERS_FILE, orders);

  broadcastToAdmins({ type: 'new_order', order });

  res.status(201).json(order);
});

app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  const orders = await readJson(ORDERS_FILE);
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Commande introuvable.' });
  const { status, seen } = req.body || {};
  if (status !== undefined) {
    if (!['en_attente', 'payee', 'livree', 'annulee'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }
    orders[idx].status = status;
  }
  if (seen !== undefined) orders[idx].seen = !!seen;
  await writeJson(ORDERS_FILE, orders);
  res.json(orders[idx]);
});

/* ---------- Messages (client -> admin) ---------- */

app.get('/api/messages', requireAdmin, async (req, res) => {
  const messages = await readJson(MESSAGES_FILE);
  res.json(messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/messages', async (req, res) => {
  const { name, contact, message, brainrotId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Ton nom est obligatoire.' });
  if (!contact || !String(contact).trim()) return res.status(400).json({ error: 'Un moyen de te contacter est obligatoire.' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Le message est vide.' });

  let brainrotName = null;
  if (brainrotId) {
    const brainrots = await readJson(BRAINROTS_FILE);
    const product = brainrots.find((b) => b.id === brainrotId);
    if (product) brainrotName = product.name;
  }

  const messages = await readJson(MESSAGES_FILE);
  const entry = {
    id: randomUUID(),
    name: String(name).trim(),
    contact: String(contact).trim(),
    message: String(message).trim(),
    brainrotId: brainrotId || null,
    brainrotName,
    read: false,
    createdAt: new Date().toISOString()
  };
  messages.push(entry);
  await writeJson(MESSAGES_FILE, messages);

  broadcastToAdmins({ type: 'new_message', message: entry });

  res.status(201).json(entry);
});

app.put('/api/messages/:id', requireAdmin, async (req, res) => {
  const messages = await readJson(MESSAGES_FILE);
  const idx = messages.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Message introuvable.' });
  const { read } = req.body || {};
  if (read !== undefined) messages[idx].read = !!read;
  await writeJson(MESSAGES_FILE, messages);
  res.json(messages[idx]);
});

/* ---------- Realtime admin notifications ---------- */

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const adminSockets = new Set();

function broadcastToAdmins(payload) {
  const data = JSON.stringify(payload);
  for (const socket of adminSockets) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
}

wss.on('connection', (socket) => {
  let authenticated = false;

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'auth') {
      if (msg.key === ADMIN_PASSWORD) {
        authenticated = true;
        adminSockets.add(socket);
        socket.send(JSON.stringify({ type: 'auth_ok' }));
      } else {
        socket.send(JSON.stringify({ type: 'auth_error' }));
        socket.close();
      }
    }
  });

  socket.on('close', () => {
    adminSockets.delete(socket);
  });

  if (!authenticated) {
    setTimeout(() => {
      if (!authenticated) socket.close();
    }, 5000);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Brainrot Shop lancée sur http://localhost:${PORT}`);
  console.log(`Espace admin : http://localhost:${PORT}/admin`);
  console.log(`Mot de passe admin : ${ADMIN_PASSWORD === 'brainrot123' ? 'brainrot123 (par défaut — change-le via ADMIN_PASSWORD)' : '(défini via ADMIN_PASSWORD)'}`);
});
