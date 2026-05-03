// Steal a Brainrot — main client entry.

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Network } from './network.js';

const STEAL_DURATION = 4.0;

const ui = {
  menu: document.getElementById('menu'),
  death: document.getElementById('death'),
  play: document.getElementById('play'),
  respawn: document.getElementById('respawn'),
  money: document.getElementById('money'),
  income: document.getElementById('income'),
  count: document.getElementById('count'),
  lockstate: document.getElementById('lockstate'),
  notifs: document.getElementById('notifications'),
  prompt: document.getElementById('prompt'),
  promptTitle: document.getElementById('prompt-title'),
  promptSub: document.getElementById('prompt-sub')
};

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Camera (first-person)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

// World, player, network
const world = new World();
const player = new Player(camera, renderer.domElement);
const net = new Network();

// State mirrored from server
let plotsState = [];        // last server plots
let playersState = [];
let myMoney = 0;
let myIncome = 0;
let myPlotIndex = null;
let lockedSelf = false;

// Steal interaction state
let stealHoldStart = 0;
let stealServerProgress = 0;
let stealServerActive = false;
let stealServerId = null;
let stealTarget = null;     // { plotIndex, standIndex } currently being stolen

// Hover target (computed each frame from proximity / look)
let hoverTarget = null;

player.onLockToggle = () => net.send({ t: 'lock' });
player.onKick = () => net.send({ t: 'kick' });

// Key handlers for E (interact)
let eDown = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat) {
    eDown = true;
    onInteractStart();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyE') {
    eDown = false;
    onInteractEnd();
  }
});

function onInteractStart() {
  if (!hoverTarget) return;
  if (hoverTarget.kind === 'buy') {
    net.send({ t: 'buy', itemId: hoverTarget.itemId });
  } else if (hoverTarget.kind === 'steal') {
    stealTarget = { plotIndex: hoverTarget.plotIndex, standIndex: hoverTarget.standIndex };
    net.send({ t: 'startSteal', plotIndex: hoverTarget.plotIndex, standIndex: hoverTarget.standIndex });
  } else if (hoverTarget.kind === 'sell') {
    net.send({ t: 'sell', standIndex: hoverTarget.standIndex });
  }
}

function onInteractEnd() {
  if (stealTarget) {
    net.send({ t: 'cancelSteal' });
    stealTarget = null;
    stealServerProgress = 0;
    stealServerActive = false;
  }
}

// ---------- Network handlers ----------

net.on('open', () => {
  const name = prompt('Ton pseudo ?', 'Joueur') || 'Joueur';
  net.send({ t: 'name', name });
});

net.on('close', () => {
  notify('Connexion perdue. Recharge la page.', 'bad');
});

net.on('full', (msg) => {
  alert(`Serveur plein (max ${msg.max} joueurs). Réessaie plus tard.`);
});

net.on('init', (msg) => {
  world.setCatalog(msg.catalog, msg.rarities);
  // Build plots using initial layout snapshot
  // We need plots' cx/cz/angle/stands — but init doesn't include them. The first 'state' will.
  // Workaround: derive plot positions client-side identical to server formula.
  const plots = [];
  for (let i = 0; i < msg.config.PLOT_COUNT; i++) {
    const angle = (i / msg.config.PLOT_COUNT) * Math.PI * 2;
    const cx = Math.cos(angle) * 28;
    const cz = Math.sin(angle) * 28;
    const stands = [];
    for (let s = 0; s < msg.config.STANDS_PER_PLOT; s++) {
      const row = Math.floor(s / 4);
      const col = s % 4;
      const lx = (col - 1.5) * 3;
      const lz = -3 + row * 3;
      const wx = cx + lx * Math.cos(angle) - lz * Math.sin(angle);
      const wz = cz + lx * Math.sin(angle) + lz * Math.cos(angle);
      stands.push({ x: wx, z: wz, brainrot: null });
    }
    plots.push({ index: i, ownerId: null, cx, cz, angle, stands });
  }
  world.buildPlots(plots);
  myPlotIndex = msg.plotIndex;
  player.setPosition(msg.spawn.x, msg.spawn.y, msg.spawn.z, msg.spawn.ry);
  ui.menu.classList.add('hidden');
  renderer.domElement.requestPointerLock();
  notify('Bienvenue ! Achète des brainrots sur ton tapis.', 'info');
});

net.on('state', (msg) => {
  plotsState = msg.plots;
  playersState = msg.players;
  myMoney = msg.money;
  myIncome = msg.income;

  // Update plot visuals
  for (let i = 0; i < plotsState.length; i++) {
    const ps = plotsState[i];
    const pm = world.plotMeshes[i];
    if (!pm) continue;
    world.updateConveyor(pm, ps.conveyor);
    world.updateStands(pm, ps.stands);
    world.updateLock(pm, ps.locked);
    if (ps.ownerId == null) world.setOwner(pm, null);
    else {
      const owner = playersState.find(p => p.id === ps.ownerId);
      world.setOwner(pm, owner ? owner.name : '?');
    }
    if (ps.ownerId === net.youId) {
      lockedSelf = ps.locked;
    }
  }

  // Update other players
  const seen = new Set();
  for (const p of playersState) {
    if (p.id === net.youId) continue;
    seen.add(p.id);
    world.upsertPlayer(p);
  }
  for (const id of [...world.playerMeshes.keys()]) {
    if (!seen.has(id)) world.removePlayer(id);
  }
});

net.on('notif', (msg) => notify(msg.text, msg.kind));

net.on('event', (msg) => {
  if (msg.kind === 'steal') {
    notify(`${msg.stealer} a volé ${msg.brainrot} à ${msg.victim} !`, 'warn');
  } else if (msg.kind === 'join') {
    notify(`${msg.name} a rejoint la partie.`, 'info');
  } else if (msg.kind === 'leave') {
    notify(`${msg.name} est parti.`, 'info');
  }
});

net.on('stealStart', (msg) => { stealServerActive = true; stealServerId = msg.id; stealServerProgress = 0; });
net.on('stealProgress', (msg) => { if (msg.id === stealServerId) stealServerProgress = msg.p; });
net.on('stealCancel', (msg) => {
  if (msg.id === stealServerId) { stealServerActive = false; stealServerProgress = 0; stealTarget = null; }
});
net.on('stealComplete', (msg) => {
  stealServerActive = false; stealServerProgress = 0; stealTarget = null;
});

net.on('knockback', (msg) => {
  player.applyKnockback(msg.x, msg.z);
  notify('Tu as été repoussé !', 'bad');
});

// ---------- Notifications ----------

function notify(text, kind = 'info') {
  const el = document.createElement('div');
  el.className = `notif ${kind}`;
  el.textContent = text;
  ui.notifs.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------- Interaction detection ----------

function updateHoverTarget() {
  hoverTarget = null;
  const px = player.position.x, pz = player.position.z;

  // Check conveyor items on my plot
  if (myPlotIndex != null) {
    const myPlot = world.plotMeshes[myPlotIndex];
    if (myPlot) {
      let bestD = 9; // max range^2 = 3^2
      for (const [id, mesh] of myPlot.conveyorItems) {
        const d = (mesh.position.x - px) ** 2 + (mesh.position.z - pz) ** 2;
        if (d < bestD) {
          bestD = d;
          const data = world.catalog[mesh.userData.brainrot];
          hoverTarget = {
            kind: 'buy',
            itemId: mesh.userData.itemId,
            title: `Acheter ${data?.name || '?'} — $${data?.price || '?'}`,
            sub: `Revenu : +$${data?.income || '?'}/s — Appuie sur E`
          };
        }
      }
    }
  }

  // Check stands on OTHER plots for steal (and on my plot for sell)
  if (!hoverTarget) {
    let bestD = 9;
    for (let pi = 0; pi < world.plotMeshes.length; pi++) {
      const pm = world.plotMeshes[pi];
      const ps = plotsState[pi];
      if (!ps) continue;
      for (let si = 0; si < pm.stands.length; si++) {
        const st = pm.stands[si];
        if (!st.brainrotMesh) continue;
        const d = (st.x - px) ** 2 + (st.z - pz) ** 2;
        if (d < bestD) {
          bestD = d;
          const data = world.catalog[st.brainrotIdx];
          if (ps.ownerId === net.youId) {
            hoverTarget = {
              kind: 'sell',
              standIndex: si,
              title: `Vendre ${data?.name || '?'}`,
              sub: `Récupère ${Math.floor((data?.price || 0) * 0.7)}$ — E`
            };
          } else if (ps.ownerId != null) {
            hoverTarget = {
              kind: 'steal',
              plotIndex: pi,
              standIndex: si,
              locked: ps.locked,
              title: ps.locked ? 'Base verrouillée' : `Voler ${data?.name || '?'}`,
              sub: ps.locked ? '—' : `Maintiens E (${STEAL_DURATION}s)`
            };
          }
        }
      }
    }
  }

  // Update prompt UI
  if (hoverTarget) {
    ui.prompt.classList.remove('hidden');
    let title = hoverTarget.title;
    let sub = hoverTarget.sub;
    if (hoverTarget.kind === 'steal' && stealServerActive) {
      const pct = Math.floor(stealServerProgress * 100);
      sub = `Vol en cours : ${pct}%`;
    }
    ui.promptTitle.textContent = title;
    ui.promptSub.innerHTML = sub.replace(/\bE\b/g, '<kbd>E</kbd>');
  } else {
    ui.prompt.classList.add('hidden');
  }
}

// ---------- Main loop ----------

let lastNetSend = 0;
let lastFrame = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  player.update(dt);
  updateHoverTarget();

  // Send position ~20Hz
  if (now - lastNetSend > 50) {
    lastNetSend = now;
    if (net.connected) net.send({ t: 'move', ...player.netState() });
  }

  // Update HUD
  ui.money.textContent = `$${formatNum(myMoney)}`;
  ui.income.textContent = `$${formatNum(myIncome)}/s`;
  if (myPlotIndex != null && plotsState[myPlotIndex]) {
    const occupied = plotsState[myPlotIndex].stands.filter(s => s.brainrot != null).length;
    ui.count.textContent = `${occupied} / ${plotsState[myPlotIndex].stands.length}`;
  }
  if (lockedSelf) {
    ui.lockstate.parentElement.classList.add('locked');
    ui.lockstate.textContent = 'Verrouillée';
  } else {
    ui.lockstate.parentElement.classList.remove('locked');
    ui.lockstate.textContent = 'Ouverte';
  }

  renderer.render(world.scene, camera);
}

function formatNum(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k';
  return String(n);
}

// ---------- Start ----------

ui.play.addEventListener('click', () => {
  net.connect();
});

requestAnimationFrame(loop);
