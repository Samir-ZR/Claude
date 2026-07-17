const RARITY_LABELS = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
  mythic: 'Mythique',
  god: 'Brainrot God'
};

const STATUS_LABELS = {
  en_attente: 'En attente',
  payee: 'Payée',
  livree: 'Livrée',
  annulee: 'Annulée'
};

const POLL_INTERVAL_MS = 15000;

const state = {
  authHash: localStorage.getItem('brainrotAdminHash') || null,
  db: null,
  pollTimer: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function currency(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function settings() { return (state.db && state.db.settings) || {}; }
function brainrots() { return (state.db && state.db.brainrots) || []; }
function orders() {
  return ((state.db && state.db.orders) || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function messages() {
  return ((state.db && state.db.messages) || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ---------- Modals ---------- */

function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

$$('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
});
$$('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

/* ---------- Toasts ---------- */

function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  $('#toast-stack').appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

/* ---------- Login ---------- */

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#admin-password').value;
  try {
    const db = await dbRead();
    const hash = await sha256Hex(password);
    if (hash !== db.settings.adminPasswordHash) {
      throw new Error('Mot de passe incorrect.');
    }
    state.authHash = hash;
    localStorage.setItem('brainrotAdminHash', hash);
    state.db = db;
    enterApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').classList.remove('hidden');
  }
});

$('#logout-btn').addEventListener('click', () => {
  state.authHash = null;
  localStorage.removeItem('brainrotAdminHash');
  stopPolling();
  $('#admin-app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
});

function enterApp() {
  $('#login-error').classList.add('hidden');
  $('#login-screen').classList.add('hidden');
  $('#admin-app').classList.remove('hidden');
  renderAll();
  startPolling();
}

function renderAll() {
  renderBrainrots();
  renderOrders();
  renderMessages();
  renderAppearanceSummary();
  updateBellCount();
}

/*
 * Toute écriture repasse par une vérification du mot de passe contre les
 * données fraîches : si le mot de passe a été changé depuis un autre appareil,
 * la session en cours est déconnectée au lieu d'écrire.
 */
async function guardedUpdate(mutate) {
  return dbUpdate((db) => {
    if (!state.authHash || db.settings.adminPasswordHash !== state.authHash) {
      throw new Error('Session expirée : le mot de passe admin a changé. Reconnecte-toi.');
    }
    return mutate(db);
  });
}

/* ---------- Polling (notifications) ---------- */

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}

async function pollOnce() {
  if (document.visibilityState !== 'visible') return;
  let fresh;
  try {
    fresh = await dbRead();
  } catch {
    return; // réseau momentanément indisponible : on réessaiera au prochain tick
  }

  const knownOrders = new Set(((state.db && state.db.orders) || []).map((o) => o.id));
  const knownMessages = new Set(((state.db && state.db.messages) || []).map((m) => m.id));
  const newOrders = (fresh.orders || []).filter((o) => !knownOrders.has(o.id));
  const newMessages = (fresh.messages || []).filter((m) => !knownMessages.has(m.id));

  state.db = fresh;

  if (fresh.settings.adminPasswordHash !== state.authHash) {
    $('#logout-btn').click();
    return;
  }

  for (const order of newOrders) {
    showToast(`🛒 Nouvelle commande de ${order.buyerName} — ${currency(order.total)}`);
  }
  for (const msg of newMessages) {
    showToast(`✉️ Nouveau message de ${msg.name}`);
  }
  if (newOrders.length || newMessages.length) flashTitle();

  renderAll();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.authHash && state.db) pollOnce();
});

let titleFlashInterval = null;
function flashTitle() {
  if (titleFlashInterval) return;
  const original = 'Brainrot Shop — Espace Admin';
  let toggle = false;
  titleFlashInterval = setInterval(() => {
    document.title = toggle ? original : '🔔 Nouveau !';
    toggle = !toggle;
  }, 1000);
  window.addEventListener('focus', stopFlash, { once: true });
}
function stopFlash() {
  clearInterval(titleFlashInterval);
  titleFlashInterval = null;
  document.title = 'Brainrot Shop — Espace Admin';
}

function updateBellCount() {
  const count = orders().filter((o) => !o.seen).length + messages().filter((m) => !m.read).length;
  const badge = $('#bell-count');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

$('#bell-btn').addEventListener('click', () => {
  const unseenOrders = orders().filter((o) => !o.seen).length;
  const unreadMessages = messages().filter((m) => !m.read).length;
  switchTab(unseenOrders >= unreadMessages ? 'orders' : 'messages');
});

/* ---------- Tabs ---------- */

function switchTab(tab) {
  $$('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
}

$$('.tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

/* ---------- Products ---------- */

function renderBrainrots() {
  const grid = $('#brainrot-grid');
  grid.innerHTML = '';
  $('#shop-empty').classList.toggle('hidden', brainrots().length > 0);

  for (const item of brainrots()) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__top">
        <span class="card__emoji">${item.emoji || '🐸'}</span>
        <div class="card__top-right">
          <span class="rarity-badge ${item.rarity}">${RARITY_LABELS[item.rarity] || item.rarity}</span>
          <button class="icon-btn" data-edit="${item.id}" title="Modifier">✏️</button>
        </div>
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="card__desc">${escapeHtml(item.description || '')}</p>
      <div class="card__footer">
        <span class="card__price">${currency(item.price)}</span>
        <span class="card__stock">${item.stock} en stock</span>
      </div>
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit));
  });
}

$('#add-brainrot-btn').addEventListener('click', () => {
  $('#brainrot-modal-title').textContent = 'Ajouter un brainrot';
  $('#brainrot-form').reset();
  $('#brainrot-id').value = '';
  $('#delete-brainrot-btn').classList.add('hidden');
  $('#brainrot-form-error').classList.add('hidden');
  openModal('brainrot-modal');
});

function openEditModal(id) {
  const item = brainrots().find((b) => b.id === id);
  if (!item) return;
  $('#brainrot-modal-title').textContent = 'Modifier ' + item.name;
  $('#brainrot-id').value = item.id;
  $('#brainrot-name').value = item.name;
  $('#brainrot-emoji').value = item.emoji || '';
  $('#brainrot-rarity').value = item.rarity;
  $('#brainrot-price').value = item.price;
  $('#brainrot-stock').value = item.stock;
  $('#brainrot-description').value = item.description || '';
  $('#delete-brainrot-btn').classList.remove('hidden');
  $('#brainrot-form-error').classList.add('hidden');
  openModal('brainrot-modal');
}

$('#brainrot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#brainrot-id').value;
  const fields = {
    name: $('#brainrot-name').value.trim(),
    emoji: $('#brainrot-emoji').value || '🐸',
    rarity: $('#brainrot-rarity').value,
    price: parseFloat($('#brainrot-price').value),
    stock: Math.max(0, parseInt($('#brainrot-stock').value, 10) || 0),
    description: $('#brainrot-description').value
  };
  try {
    if (!fields.name) throw new Error('Le nom est obligatoire.');
    if (!Number.isFinite(fields.price) || fields.price < 0) throw new Error('Le prix doit être un nombre positif.');
    const { data } = await guardedUpdate((db) => {
      if (id) {
        const item = db.brainrots.find((b) => b.id === id);
        if (!item) throw new Error('Brainrot introuvable (supprimé entre-temps ?).');
        Object.assign(item, fields);
      } else {
        db.brainrots.push({ id: uid(), ...fields, createdAt: new Date().toISOString() });
      }
    });
    state.db = data;
    closeModal('brainrot-modal');
    renderAll();
  } catch (err) {
    $('#brainrot-form-error').textContent = err.message;
    $('#brainrot-form-error').classList.remove('hidden');
  }
});

$('#delete-brainrot-btn').addEventListener('click', async () => {
  const id = $('#brainrot-id').value;
  if (!id) return;
  if (!confirm('Supprimer ce brainrot du catalogue ?')) return;
  try {
    const { data } = await guardedUpdate((db) => {
      db.brainrots = db.brainrots.filter((b) => b.id !== id);
    });
    state.db = data;
    closeModal('brainrot-modal');
    renderAll();
  } catch (err) {
    $('#brainrot-form-error').textContent = err.message;
    $('#brainrot-form-error').classList.remove('hidden');
  }
});

/* ---------- Orders ---------- */

function renderOrders() {
  const list = $('#orders-list');
  list.innerHTML = '';
  $('#orders-empty').classList.toggle('hidden', orders().length > 0);

  for (const order of orders()) {
    const card = document.createElement('div');
    card.className = `entity-card ${!order.seen ? 'unread' : ''}`;
    const date = new Date(order.createdAt).toLocaleString('fr-FR');
    card.innerHTML = `
      <div class="entity-card__header">
        <div>
          <strong>${escapeHtml(order.buyerName)}</strong>
          ${!order.seen ? '<span class="new-badge">Nouveau</span>' : ''}
          <div class="entity-card__meta">${date} · ${escapeHtml(order.buyerContact)}</div>
        </div>
        <select class="status-select" data-status="${order.id}">
          ${Object.entries(STATUS_LABELS).map(([val, label]) =>
            `<option value="${val}" ${order.status === val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
      <ul class="entity-card__items">
        ${(order.items || []).map((i) => `<li><span>${i.emoji || ''} ${escapeHtml(i.name)} × ${i.quantity}</span><span>${currency(i.unitPrice * i.quantity)}</span></li>`).join('')}
      </ul>
      <div class="entity-card__footer">
        <span class="entity-card__total">Total : ${currency(order.total)}</span>
      </div>
    `;
    list.appendChild(card);

    if (!order.seen) {
      card.addEventListener('click', () => markOrderSeen(order.id), { once: true });
    }
  }

  list.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('change', async () => {
      try {
        const { data } = await guardedUpdate((db) => {
          const order = (db.orders || []).find((o) => o.id === select.dataset.status);
          if (!order) throw new Error('Commande introuvable.');
          order.status = select.value;
        });
        state.db = data;
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function markOrderSeen(id) {
  try {
    const { data } = await guardedUpdate((db) => {
      const order = (db.orders || []).find((o) => o.id === id);
      if (order) order.seen = true;
    });
    state.db = data;
    renderOrders();
    updateBellCount();
  } catch { /* pas grave, sera re-tenté au prochain clic */ }
}

/* ---------- Messages ---------- */

function renderMessages() {
  const list = $('#messages-list');
  list.innerHTML = '';
  $('#messages-empty').classList.toggle('hidden', messages().length > 0);

  for (const msg of messages()) {
    const card = document.createElement('div');
    card.className = `entity-card ${!msg.read ? 'unread' : ''}`;
    const date = new Date(msg.createdAt).toLocaleString('fr-FR');
    card.innerHTML = `
      <div class="entity-card__header">
        <div>
          <strong>${escapeHtml(msg.name)}</strong>
          ${!msg.read ? '<span class="new-badge">Nouveau</span>' : ''}
          <div class="entity-card__meta">${date} · ${escapeHtml(msg.contact)}${msg.brainrotName ? ` · à propos de ${escapeHtml(msg.brainrotName)}` : ''}</div>
        </div>
        ${!msg.read ? `<button class="btn btn--ghost" data-mark-read="${msg.id}">Marquer comme lu</button>` : ''}
      </div>
      <p style="margin: 0.6rem 0 0; font-size: 0.9rem;">${escapeHtml(msg.message)}</p>
    `;
    list.appendChild(card);
  }

  list.querySelectorAll('[data-mark-read]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const { data } = await guardedUpdate((db) => {
          const msg = (db.messages || []).find((m) => m.id === btn.dataset.markRead);
          if (msg) msg.read = true;
        });
        state.db = data;
        renderMessages();
        updateBellCount();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

/* ---------- Appearance ---------- */

function renderAppearanceSummary() {
  const s = settings();
  const el = $('#appearance-summary');
  el.innerHTML = `
    <div class="appearance-summary__item"><strong>Nom</strong>${escapeHtml(s.shopName)}</div>
    <div class="appearance-summary__item"><strong>Slogan</strong>${escapeHtml(s.tagline)}</div>
    <div class="appearance-summary__item"><strong>Logo</strong>${s.logoEmoji}</div>
    <div class="appearance-summary__item"><strong>Couleur principale</strong>${s.primaryColor}</div>
    <div class="appearance-summary__item"><strong>Couleur d'accent</strong>${s.accentColor}</div>
    <div class="appearance-summary__item"><strong>Bannière</strong>${s.bannerEnabled ? 'Activée' : 'Désactivée'}</div>
    <div class="appearance-summary__item"><strong>CSS personnalisé</strong>${s.customCss ? 'Oui' : '—'}</div>
    <div class="appearance-summary__item"><strong>JS personnalisé</strong>${s.customJs ? 'Oui' : '—'}</div>
    <div class="appearance-summary__item"><strong>HTML personnalisé</strong>${s.customHtml ? 'Oui' : '—'}</div>
  `;
}

$('#edit-appearance-btn').addEventListener('click', () => openModal('appearance-choice-modal'));

$('#choice-no-code').addEventListener('click', () => {
  closeModal('appearance-choice-modal');
  const s = settings();
  $('#app-shop-name').value = s.shopName || '';
  $('#app-tagline').value = s.tagline || '';
  $('#app-logo').value = s.logoEmoji || '';
  $('#app-primary-color').value = s.primaryColor || '#7c3aed';
  $('#app-accent-color').value = s.accentColor || '#22d3ee';
  $('#app-hero-title').value = s.heroTitle || '';
  $('#app-hero-subtitle').value = s.heroSubtitle || '';
  $('#app-banner-enabled').checked = !!s.bannerEnabled;
  $('#app-banner-text').value = s.bannerText || '';
  $('#appearance-nocode-error').classList.add('hidden');
  openModal('appearance-nocode-modal');
});

$('#choice-code').addEventListener('click', () => {
  closeModal('appearance-choice-modal');
  const s = settings();
  $('#app-custom-css').value = s.customCss || '';
  $('#app-custom-js').value = s.customJs || '';
  $('#app-custom-html').value = s.customHtml || '';
  $('#appearance-code-error').classList.add('hidden');
  openModal('appearance-code-modal');
});

$('#appearance-nocode-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const patch = {
    shopName: $('#app-shop-name').value,
    tagline: $('#app-tagline').value,
    logoEmoji: $('#app-logo').value,
    primaryColor: $('#app-primary-color').value,
    accentColor: $('#app-accent-color').value,
    heroTitle: $('#app-hero-title').value,
    heroSubtitle: $('#app-hero-subtitle').value,
    bannerEnabled: $('#app-banner-enabled').checked,
    bannerText: $('#app-banner-text').value
  };
  try {
    const { data } = await guardedUpdate((db) => Object.assign(db.settings, patch));
    state.db = data;
    renderAppearanceSummary();
    closeModal('appearance-nocode-modal');
    showToast('✅ Apparence mise à jour.');
  } catch (err) {
    $('#appearance-nocode-error').textContent = err.message;
    $('#appearance-nocode-error').classList.remove('hidden');
  }
});

$('#appearance-code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const patch = {
    customCss: $('#app-custom-css').value,
    customJs: $('#app-custom-js').value,
    customHtml: $('#app-custom-html').value
  };
  try {
    const { data } = await guardedUpdate((db) => Object.assign(db.settings, patch));
    state.db = data;
    renderAppearanceSummary();
    closeModal('appearance-code-modal');
    showToast('✅ Code mis à jour.');
  } catch (err) {
    $('#appearance-code-error').textContent = err.message;
    $('#appearance-code-error').classList.remove('hidden');
  }
});

/* ---------- Change password ---------- */

$('#password-btn').addEventListener('click', () => {
  $('#password-form').reset();
  $('#password-error').classList.add('hidden');
  openModal('password-modal');
});

$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('#new-password').value;
  const confirmPw = $('#new-password-confirm').value;
  const errorEl = $('#password-error');
  errorEl.classList.add('hidden');
  try {
    if (pw.length < 4) throw new Error('Au moins 4 caractères.');
    if (pw !== confirmPw) throw new Error('Les deux mots de passe ne correspondent pas.');
    const newHash = await sha256Hex(pw);
    const { data } = await guardedUpdate((db) => {
      db.settings.adminPasswordHash = newHash;
    });
    state.authHash = newHash;
    localStorage.setItem('brainrotAdminHash', newHash);
    state.db = data;
    closeModal('password-modal');
    showToast('🔑 Mot de passe changé.');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

/* ---------- Init ---------- */

(async function init() {
  if (state.authHash) {
    try {
      const db = await dbRead();
      if (db.settings.adminPasswordHash === state.authHash) {
        state.db = db;
        enterApp();
        return;
      }
    } catch { /* stockage injoignable : retour au login */ }
    state.authHash = null;
    localStorage.removeItem('brainrotAdminHash');
  }
  $('#login-screen').classList.remove('hidden');
})();
