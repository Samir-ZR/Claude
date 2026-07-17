import express from 'express';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAINROTS_FILE = path.join(__dirname, 'data', 'brainrots.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'brainrot123';

const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic', 'god'];

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  res.json({ ok: true });
});

app.get('/api/brainrots', async (req, res) => {
  const brainrots = await readJson(BRAINROTS_FILE);
  res.json(brainrots);
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

app.get('/api/orders', requireAdmin, async (req, res) => {
  const orders = await readJson(ORDERS_FILE);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/orders', async (req, res) => {
  const { brainrotId, quantity, buyerName, buyerContact } = req.body || {};
  const qty = Number.isFinite(quantity) ? Math.floor(quantity) : 1;

  if (!buyerName || !String(buyerName).trim()) {
    return res.status(400).json({ error: 'Ton nom est obligatoire.' });
  }
  if (!buyerContact || !String(buyerContact).trim()) {
    return res.status(400).json({ error: 'Un moyen de te contacter (email, Discord...) est obligatoire.' });
  }
  if (qty < 1) {
    return res.status(400).json({ error: 'Quantité invalide.' });
  }

  const brainrots = await readJson(BRAINROTS_FILE);
  const item = brainrots.find((b) => b.id === brainrotId);
  if (!item) return res.status(404).json({ error: 'Brainrot introuvable.' });
  if (item.stock < qty) return res.status(409).json({ error: 'Stock insuffisant.' });

  item.stock -= qty;
  await writeJson(BRAINROTS_FILE, brainrots);

  const orders = await readJson(ORDERS_FILE);
  const order = {
    id: randomUUID(),
    brainrotId: item.id,
    brainrotName: item.name,
    unitPrice: item.price,
    quantity: qty,
    total: Math.round(item.price * qty * 100) / 100,
    buyerName: String(buyerName).trim(),
    buyerContact: String(buyerContact).trim(),
    status: 'en_attente',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  await writeJson(ORDERS_FILE, orders);

  res.status(201).json(order);
});

app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  const orders = await readJson(ORDERS_FILE);
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Commande introuvable.' });
  const { status } = req.body || {};
  if (!['en_attente', 'payee', 'livree', 'annulee'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  orders[idx].status = status;
  await writeJson(ORDERS_FILE, orders);
  res.json(orders[idx]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Brainrot Shop lancée sur http://localhost:${PORT}`);
  console.log(`Mot de passe admin : ${ADMIN_PASSWORD === 'brainrot123' ? 'brainrot123 (par défaut — change-le via ADMIN_PASSWORD)' : '(défini via ADMIN_PASSWORD)'}`);
});
