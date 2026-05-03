// Shared brainrot catalog (used by server and client).
// ESM module — both server (Node 18+) and browser can import.

export const RARITIES = {
  common:    { label: 'Commun',    color: 0x9ca3af, weight: 50 },
  rare:      { label: 'Rare',      color: 0x3b82f6, weight: 25 },
  epic:      { label: 'Épique',    color: 0xa855f7, weight: 14 },
  legendary: { label: 'Légendaire',color: 0xf59e0b, weight: 7 },
  mythic:    { label: 'Mythique',  color: 0xef4444, weight: 3 },
  god:       { label: 'Brainrot God', color: 0xfde047, weight: 1 }
};

// Each entry: name, rarity, price, income ($/sec), bodyColor (head sphere color)
export const BRAINROTS = [
  // Common
  { name: 'Trippi Troppi',        rarity: 'common',    price: 50,     income: 1,    color: 0x84cc16 },
  { name: 'Frigo Camelo',         rarity: 'common',    price: 80,     income: 2,    color: 0x06b6d4 },
  { name: 'Boneca Ambalabu',      rarity: 'common',    price: 120,    income: 3,    color: 0xec4899 },
  { name: 'Bombombini Gusini',    rarity: 'common',    price: 200,    income: 5,    color: 0xf97316 },
  // Rare
  { name: 'Brr Brr Patapim',      rarity: 'rare',      price: 500,    income: 12,   color: 0x22c55e },
  { name: 'Chimpanzini Bananini', rarity: 'rare',      price: 900,    income: 22,   color: 0xfacc15 },
  { name: 'Lirilì Larilà',        rarity: 'rare',      price: 1500,   income: 38,   color: 0x14b8a6 },
  // Epic
  { name: 'Cappuccino Assassino', rarity: 'epic',      price: 4000,   income: 110,  color: 0x78350f },
  { name: 'Tung Tung Tung Sahur', rarity: 'epic',      price: 8500,   income: 250,  color: 0x451a03 },
  // Legendary
  { name: 'Bombardiro Crocodilo', rarity: 'legendary', price: 25000,  income: 800,  color: 0x166534 },
  { name: 'Tralalero Tralala',    rarity: 'legendary', price: 60000,  income: 2000, color: 0x1e3a8a },
  // Mythic
  { name: 'Bobrito Bandito',      rarity: 'mythic',    price: 200000, income: 7500, color: 0x7c2d12 },
  { name: 'Trulimero Trulicina',  rarity: 'mythic',    price: 500000, income: 18000,color: 0x4c1d95 },
  // God
  { name: 'La Vacca Saturno Saturnita', rarity: 'god', price: 5000000, income: 200000, color: 0xfde047 }
];

const TOTAL_WEIGHT = Object.values(RARITIES).reduce((s, r) => s + r.weight, 0);

export function rollRarity() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const [key, val] of Object.entries(RARITIES)) {
    r -= val.weight;
    if (r <= 0) return key;
  }
  return 'common';
}

export function rollBrainrot() {
  const rarity = rollRarity();
  const pool = BRAINROTS.filter(b => b.rarity === rarity);
  if (!pool.length) return BRAINROTS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function brainrotIndexOf(name) {
  return BRAINROTS.findIndex(b => b.name === name);
}
