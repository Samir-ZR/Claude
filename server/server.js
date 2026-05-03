// Steal a Brainrot — clone server (Node 18+, ESM).
// Serves the static client and runs the authoritative game state over WebSocket.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { BRAINROTS, RARITIES, rollBrainrot, brainrotIndexOf } from '../shared/brainrots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

// ---------- Static file server ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const STATIC_DIRS = ['', 'css', 'js', 'shared'];

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Only serve from whitelisted directories
  const segments = urlPath.split('/').filter(Boolean);
  if (segments.length === 0) { res.writeHead(404); return res.end(); }
  const topDir = segments.length > 1 ? segments[0] : '';
  if (!STATIC_DIRS.includes(topDir)) { res.writeHead(404); return res.end('Not found'); }

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

// ---------- Game state ----------

const MAP_RADIUS = 60;
const PLOT_COUNT = 4;
const STANDS_PER_PLOT = 8;
const CONVEYOR_SPEED = 2.0;        // units / second
const CONVEYOR_LENGTH = 18;
const CONVEYOR_SPAWN_INTERVAL = 4.0; // seconds
const STEAL_DURATION = 4.0;        // seconds
const LOCK_COOLDOWN = 10;          // seconds
const KICK_COOLDOWN = 1.5;
const MAX_PLAYERS = PLOT_COUNT;

// Pre-compute plot positions: 4 quadrants
const plots = [];
for (let i = 0; i < PLOT_COUNT; i++) {
  const angle = (i / PLOT_COUNT) * Math.PI * 2;
  const cx = Math.cos(angle) * 28;
  const cz = Math.sin(angle) * 28;
  // Stand positions: 2 rows × 4
  const stands = [];
  for (let s = 0; s < STANDS_PER_PLOT; s++) {
    const row = Math.floor(s / 4);
    const col = s % 4;
    // Local offsets, then rotate by angle so stands face center
    const lx = (col - 1.5) * 3;
    const lz = -3 + row * 3;
    const wx = cx + lx * Math.cos(angle) - lz * Math.sin(angle);
    const wz = cz + lx * Math.sin(angle) + lz * Math.cos(angle);
    stands.push({ x: wx, z: wz, brainrot: null });
  }
  // Conveyor end position (at front of plot)
  plots.push({
    index: i,
    ownerId: null,
    cx, cz,
    angle,
    stands,
    conveyor: { items: [], spawnTimer: 0 },
    locked: false,
    lockTimer: 0,
    money: 0
  });
}

const players = new Map(); // id -> player
let nextPlayerId = 1;
let nextItemId = 1;
let nextStealId = 1;
const activeSteals = new Map(); // stealId -> {playerId, plotIndex, standIndex, t}

// ---------- Helpers ----------

function spawnPlot(player) {
  // Find first free plot
  for (const plot of plots) {
    if (plot.ownerId === null) {
      plot.ownerId = player.id;
      plot.money = 100;
      plot.locked = false;
      plot.stands.forEach(s => s.brainrot = null);
      plot.conveyor.items = [];
      plot.conveyor.spawnTimer = 0;
      player.plotIndex = plot.index;
      // Spawn position: behind plot
      const back = 6;
      player.x = plot.cx + Math.cos(plot.angle) * back;
      player.z = plot.cz + Math.sin(plot.angle) * back;
      player.y = 0;
      player.ry = plot.angle + Math.PI;
      return true;
    }
  }
  return false;
}

function freePlot(player) {
  if (player.plotIndex == null) return;
  const plot = plots[player.plotIndex];
  if (plot && plot.ownerId === player.id) {
    plot.ownerId = null;
    plot.locked = false;
    plot.stands.forEach(s => s.brainrot = null);
    plot.conveyor.items = [];
  }
  player.plotIndex = null;
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

function broadcast(msg, exclude = null) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p === exclude) continue;
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

function send(player, msg) {
  if (player.ws.readyState === 1) player.ws.send(JSON.stringify(msg));
}

function notify(player, text, kind = 'info') {
  send(player, { t: 'notif', text, kind });
}

// ---------- Tick loop ----------

const TICK_HZ = 10;
const TICK_DT = 1 / TICK_HZ;
let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // Conveyors
  for (const plot of plots) {
    if (plot.ownerId === null) continue;
    plot.conveyor.spawnTimer -= dt;
    if (plot.conveyor.spawnTimer <= 0) {
      plot.conveyor.spawnTimer = CONVEYOR_SPAWN_INTERVAL;
      const br = rollBrainrot();
      plot.conveyor.items.push({
        id: nextItemId++,
        brainrot: brainrotIndexOf(br.name),
        progress: 0
      });
    }
    // Advance items
    for (const item of plot.conveyor.items) {
      item.progress += (CONVEYOR_SPEED * dt) / CONVEYOR_LENGTH;
    }
    plot.conveyor.items = plot.conveyor.items.filter(it => it.progress < 1);

    // Income
    let inc = 0;
    for (const stand of plot.stands) {
      if (stand.brainrot != null) inc += BRAINROTS[stand.brainrot].income;
    }
    plot.money += inc * dt;
    if (plot.lockTimer > 0) plot.lockTimer = Math.max(0, plot.lockTimer - dt);
  }

  // Active steals
  for (const [id, st] of activeSteals) {
    const player = players.get(st.playerId);
    const targetPlot = plots[st.plotIndex];
    const stand = targetPlot?.stands[st.standIndex];
    // Cancel conditions
    if (!player || !targetPlot || !stand || stand.brainrot == null) {
      activeSteals.delete(id);
      if (player) send(player, { t: 'stealCancel', id });
      continue;
    }
    if (targetPlot.locked) {
      activeSteals.delete(id);
      send(player, { t: 'stealCancel', id });
      notify(player, 'La base est verrouillée !', 'bad');
      continue;
    }
    // Distance check
    if (dist2(player.x, player.z, stand.x, stand.z) > 9) {
      activeSteals.delete(id);
      send(player, { t: 'stealCancel', id });
      continue;
    }
    st.t += dt;
    send(player, { t: 'stealProgress', id, p: Math.min(1, st.t / STEAL_DURATION) });
    if (st.t >= STEAL_DURATION) {
      // Complete steal
      const stolenIdx = stand.brainrot;
      stand.brainrot = null;
      activeSteals.delete(id);
      // Place on a free stand of stealer's plot
      const myPlot = plots[player.plotIndex];
      if (myPlot) {
        const free = myPlot.stands.findIndex(s => s.brainrot == null);
        if (free >= 0) {
          myPlot.stands[free].brainrot = stolenIdx;
          notify(player, `Tu as volé ${BRAINROTS[stolenIdx].name} !`, 'info');
          // Notify victim
          const victim = [...players.values()].find(p => p.id === targetPlot.ownerId);
          if (victim) notify(victim, `${player.name} t'a volé ${BRAINROTS[stolenIdx].name} !`, 'bad');
          broadcast({ t: 'event', kind: 'steal', stealer: player.name, victim: victim?.name || '?', brainrot: BRAINROTS[stolenIdx].name });
        } else {
          // No room — give cash equal to half value
          myPlot.money += BRAINROTS[stolenIdx].price / 2;
          notify(player, `Stand plein. Revente : +$${Math.floor(BRAINROTS[stolenIdx].price / 2)}`, 'warn');
        }
      }
      send(player, { t: 'stealComplete', id });
    }
  }

  // Build state snapshot for clients
  const snap = {
    t: 'state',
    players: [...players.values()].map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, ry: p.ry,
      plotIndex: p.plotIndex, anim: p.anim
    })),
    plots: plots.map(p => ({
      index: p.index, ownerId: p.ownerId, locked: p.locked,
      stands: p.stands.map(s => ({ brainrot: s.brainrot })),
      conveyor: p.conveyor.items.map(it => ({ id: it.id, brainrot: it.brainrot, progress: it.progress }))
    }))
  };

  for (const p of players.values()) {
    if (p.ws.readyState !== 1) continue;
    const myPlot = p.plotIndex != null ? plots[p.plotIndex] : null;
    p.ws.send(JSON.stringify({
      ...snap,
      money: myPlot ? Math.floor(myPlot.money) : 0,
      income: myPlot ? myPlot.stands.reduce((s, st) => s + (st.brainrot != null ? BRAINROTS[st.brainrot].income : 0), 0) : 0
    }));
  }
}, 1000 / TICK_HZ);

// ---------- WebSocket ----------

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ t: 'full', max: MAX_PLAYERS }));
    setTimeout(() => ws.close(), 100);
    return;
  }

  const player = {
    id: nextPlayerId++,
    name: 'Joueur',
    ws,
    x: 0, y: 0, z: 0, ry: 0,
    anim: 'idle',
    plotIndex: null,
    lastKick: 0
  };
  players.set(player.id, player);

  if (!spawnPlot(player)) {
    send(player, { t: 'full', max: MAX_PLAYERS });
    ws.close();
    return;
  }

  send(player, {
    t: 'init',
    you: player.id,
    plotIndex: player.plotIndex,
    spawn: { x: player.x, y: player.y, z: player.z, ry: player.ry },
    catalog: BRAINROTS,
    rarities: RARITIES,
    config: {
      MAP_RADIUS, PLOT_COUNT, STANDS_PER_PLOT,
      CONVEYOR_LENGTH, STEAL_DURATION, LOCK_COOLDOWN
    }
  });

  broadcast({ t: 'event', kind: 'join', name: player.name, id: player.id });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.t) {
      case 'name': {
        if (typeof msg.name === 'string') {
          player.name = msg.name.slice(0, 16).replace(/[^\w\s\-_.]/g, '') || 'Joueur';
        }
        break;
      }
      case 'move': {
        if (typeof msg.x === 'number' && typeof msg.z === 'number') {
          // Clamp to map radius
          const r = Math.hypot(msg.x, msg.z);
          if (r > MAP_RADIUS) {
            msg.x *= MAP_RADIUS / r;
            msg.z *= MAP_RADIUS / r;
          }
          player.x = msg.x;
          player.y = msg.y || 0;
          player.z = msg.z;
          player.ry = msg.ry || 0;
          player.anim = msg.anim || 'idle';
        }
        break;
      }
      case 'buy': {
        const myPlot = plots[player.plotIndex];
        if (!myPlot) break;
        const idx = myPlot.conveyor.items.findIndex(it => it.id === msg.itemId);
        if (idx < 0) { notify(player, "Brainrot déjà passé.", 'warn'); break; }
        const item = myPlot.conveyor.items[idx];
        const br = BRAINROTS[item.brainrot];
        if (myPlot.money < br.price) { notify(player, `Pas assez de cash (${br.price}$).`, 'bad'); break; }
        const free = myPlot.stands.findIndex(s => s.brainrot == null);
        if (free < 0) { notify(player, 'Tous tes stands sont pleins.', 'bad'); break; }
        myPlot.money -= br.price;
        myPlot.stands[free].brainrot = item.brainrot;
        myPlot.conveyor.items.splice(idx, 1);
        notify(player, `Acheté : ${br.name} (+$${br.income}/s)`, 'info');
        break;
      }
      case 'sell': {
        const myPlot = plots[player.plotIndex];
        if (!myPlot) break;
        const stand = myPlot.stands[msg.standIndex];
        if (!stand || stand.brainrot == null) break;
        const br = BRAINROTS[stand.brainrot];
        myPlot.money += br.price * 0.7;
        notify(player, `Vendu ${br.name} : +$${Math.floor(br.price * 0.7)}`, 'info');
        stand.brainrot = null;
        break;
      }
      case 'lock': {
        const myPlot = plots[player.plotIndex];
        if (!myPlot) break;
        if (myPlot.lockTimer > 0) {
          notify(player, `Cooldown : ${myPlot.lockTimer.toFixed(1)}s`, 'warn');
          break;
        }
        myPlot.locked = !myPlot.locked;
        myPlot.lockTimer = LOCK_COOLDOWN;
        notify(player, myPlot.locked ? 'Base verrouillée.' : 'Base déverrouillée.', 'info');
        break;
      }
      case 'startSteal': {
        const targetPlot = plots[msg.plotIndex];
        if (!targetPlot || targetPlot.ownerId === player.id) break;
        if (targetPlot.locked) { notify(player, 'Cette base est verrouillée.', 'bad'); break; }
        const stand = targetPlot.stands[msg.standIndex];
        if (!stand || stand.brainrot == null) break;
        if (dist2(player.x, player.z, stand.x, stand.z) > 9) { notify(player, 'Trop loin.', 'warn'); break; }
        // Cancel any existing steal by this player
        for (const [id, st] of activeSteals) {
          if (st.playerId === player.id) {
            activeSteals.delete(id);
            send(player, { t: 'stealCancel', id });
          }
        }
        const id = nextStealId++;
        activeSteals.set(id, { playerId: player.id, plotIndex: msg.plotIndex, standIndex: msg.standIndex, t: 0 });
        send(player, { t: 'stealStart', id });
        // Notify victim
        const victim = [...players.values()].find(p => p.id === targetPlot.ownerId);
        if (victim) notify(victim, `${player.name} essaie de te voler !`, 'bad');
        break;
      }
      case 'cancelSteal': {
        for (const [id, st] of activeSteals) {
          if (st.playerId === player.id) {
            activeSteals.delete(id);
            send(player, { t: 'stealCancel', id });
          }
        }
        break;
      }
      case 'kick': {
        // Owner can knock back any player on their plot.
        const myPlot = plots[player.plotIndex];
        if (!myPlot) break;
        const now = Date.now();
        if (now - player.lastKick < KICK_COOLDOWN * 1000) break;
        player.lastKick = now;
        let kicked = 0;
        for (const other of players.values()) {
          if (other.id === player.id) continue;
          if (dist2(player.x, player.z, other.x, other.z) > 9) continue;
          // Knockback away from kicker
          const dx = other.x - player.x, dz = other.z - player.z;
          const len = Math.hypot(dx, dz) || 1;
          const kx = (dx / len) * 8, kz = (dz / len) * 8;
          send(other, { t: 'knockback', x: kx, z: kz });
          // Cancel their steal if any
          for (const [id, st] of activeSteals) {
            if (st.playerId === other.id) {
              activeSteals.delete(id);
              send(other, { t: 'stealCancel', id });
            }
          }
          kicked++;
        }
        if (kicked > 0) notify(player, `Tu as repoussé ${kicked} intrus !`, 'info');
        break;
      }
    }
  });

  ws.on('close', () => {
    players.delete(player.id);
    freePlot(player);
    // Cancel any of their steals
    for (const [id, st] of activeSteals) {
      if (st.playerId === player.id) activeSteals.delete(id);
    }
    broadcast({ t: 'event', kind: 'leave', name: player.name, id: player.id });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Steal a Brainrot server listening on http://localhost:${PORT}`);
});
