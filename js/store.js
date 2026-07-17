/*
 * Couche de données partagée entre la boutique et l'admin.
 * Les données vivent dans un bin JSON hébergé (extendsclass.com), lisible et
 * modifiable par les deux sites — c'est ce qui les "relie" sans serveur à nous.
 */

const STORE_URL = 'https://extendsclass.com/api/json-storage/bin/efceded';

async function dbRead() {
  const res = await fetch(`${STORE_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Stockage indisponible (erreur ${res.status}). Réessaie dans un instant.`);
  return res.json();
}

async function dbWrite(data) {
  const res = await fetch(STORE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Échec de l'enregistrement (erreur ${res.status}). Réessaie.`);
}

/*
 * Relit les données juste avant d'écrire pour limiter les écrasements quand
 * deux personnes modifient en même temps. `mutate` reçoit les données fraîches,
 * les modifie en place (ou lève une erreur pour annuler), et on sauvegarde.
 */
async function dbUpdate(mutate) {
  const data = await dbRead();
  const result = mutate(data);
  await dbWrite(data);
  return { data, result };
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
