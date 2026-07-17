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

const state = {
  adminKey: localStorage.getItem('brainrotAdminKey') || null,
  brainrots: [],
  orders: [],
  messages: [],
  settings: null,
  ws: null
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

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers['x-admin-key'] = state.adminKey || '';
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data;
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
    await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).error || 'Mot de passe incorrect.');
    });
    state.adminKey = password;
    localStorage.setItem('brainrotAdminKey', password);
    await enterApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').classList.remove('hidden');
  }
});

$('#logout-btn').addEventListener('click', () => {
  state.adminKey = null;
  localStorage.removeItem('brainrotAdminKey');
  if (state.ws) state.ws.close();
  $('#admin-app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
});

async function enterApp() {
  await Promise.all([loadBrainrots(), loadOrders(), loadMessages(), loadSettings()]);
  $('#login-error').classList.add('hidden');
  $('#login-screen').classList.add('hidden');
  $('#admin-app').classList.remove('hidden');
  updateBellCount();
  connectWebSocket();
}

/* ---------- Realtime notifications ---------- */

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  state.ws = ws;

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'auth', key: state.adminKey }));
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'new_order') {
      state.orders.unshift(msg.order);
      renderOrders();
      updateBellCount();
      showToast(`🛒 Nouvelle commande de ${msg.order.buyerName} — ${currency(msg.order.total)}`);
      flashTitle();
    }
    if (msg.type === 'new_message') {
      state.messages.unshift(msg.message);
      renderMessages();
      updateBellCount();
      showToast(`✉️ Nouveau message de ${msg.message.name}`);
      flashTitle();
    }
  });

  ws.addEventListener('close', () => {
    // Retry once after a short delay if we're still logged in.
    if (state.adminKey) setTimeout(connectWebSocket, 3000);
  });
}

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
  const count = state.orders.filter((o) => !o.seen).length + state.messages.filter((m) => !m.read).length;
  const badge = $('#bell-count');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

$('#bell-btn').addEventListener('click', () => {
  const unseenOrders = state.orders.filter((o) => !o.seen).length;
  const unreadMessages = state.messages.filter((m) => !m.read).length;
  switchTab(unseenOrders >= unreadMessages ? 'orders' : 'messages');
});

/* ---------- Tabs ---------- */

function switchTab(tab) {
  $$('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
}

$$('.tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

/* ---------- Products ---------- */

async function loadBrainrots() {
  state.brainrots = await api('/api/brainrots');
  renderBrainrots();
}

function renderBrainrots() {
  const grid = $('#brainrot-grid');
  grid.innerHTML = '';
  $('#shop-empty').classList.toggle('hidden', state.brainrots.length > 0);

  for (const item of state.brainrots) {
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
  const item = state.brainrots.find((b) => b.id === id);
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
  const payload = {
    name: $('#brainrot-name').value,
    emoji: $('#brainrot-emoji').value,
    rarity: $('#brainrot-rarity').value,
    price: parseFloat($('#brainrot-price').value),
    stock: parseInt($('#brainrot-stock').value, 10),
    description: $('#brainrot-description').value
  };
  try {
    if (id) {
      await api(`/api/brainrots/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/brainrots', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal('brainrot-modal');
    await loadBrainrots();
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
    await api(`/api/brainrots/${id}`, { method: 'DELETE' });
    closeModal('brainrot-modal');
    await loadBrainrots();
  } catch (err) {
    $('#brainrot-form-error').textContent = err.message;
    $('#brainrot-form-error').classList.remove('hidden');
  }
});

/* ---------- Orders ---------- */

async function loadOrders() {
  state.orders = await api('/api/orders');
  renderOrders();
}

function renderOrders() {
  const list = $('#orders-list');
  list.innerHTML = '';
  $('#orders-empty').classList.toggle('hidden', state.orders.length > 0);

  for (const order of state.orders) {
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
        ${order.items.map((i) => `<li><span>${i.emoji || ''} ${escapeHtml(i.name)} × ${i.quantity}</span><span>${currency(i.unitPrice * i.quantity)}</span></li>`).join('')}
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
        await api(`/api/orders/${select.dataset.status}`, {
          method: 'PUT',
          body: JSON.stringify({ status: select.value })
        });
        const order = state.orders.find((o) => o.id === select.dataset.status);
        if (order) order.status = select.value;
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function markOrderSeen(id) {
  try {
    await api(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify({ seen: true }) });
    const order = state.orders.find((o) => o.id === id);
    if (order) order.seen = true;
    renderOrders();
    updateBellCount();
  } catch { /* ignore */ }
}

/* ---------- Messages ---------- */

async function loadMessages() {
  state.messages = await api('/api/messages');
  renderMessages();
}

function renderMessages() {
  const list = $('#messages-list');
  list.innerHTML = '';
  $('#messages-empty').classList.toggle('hidden', state.messages.length > 0);

  for (const msg of state.messages) {
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
        await api(`/api/messages/${btn.dataset.markRead}`, { method: 'PUT', body: JSON.stringify({ read: true }) });
        const msg = state.messages.find((m) => m.id === btn.dataset.markRead);
        if (msg) msg.read = true;
        renderMessages();
        updateBellCount();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

/* ---------- Appearance ---------- */

async function loadSettings() {
  state.settings = await api('/api/settings');
  renderAppearanceSummary();
}

function renderAppearanceSummary() {
  const s = state.settings;
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
  const s = state.settings;
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
  const s = state.settings;
  $('#app-custom-css').value = s.customCss || '';
  $('#app-custom-js').value = s.customJs || '';
  $('#app-custom-html').value = s.customHtml || '';
  $('#appearance-code-error').classList.add('hidden');
  openModal('appearance-code-modal');
});

$('#appearance-nocode-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
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
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
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
  const payload = {
    customCss: $('#app-custom-css').value,
    customJs: $('#app-custom-js').value,
    customHtml: $('#app-custom-html').value
  };
  try {
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    renderAppearanceSummary();
    closeModal('appearance-code-modal');
    showToast('✅ Code mis à jour.');
  } catch (err) {
    $('#appearance-code-error').textContent = err.message;
    $('#appearance-code-error').classList.remove('hidden');
  }
});

/* ---------- Init ---------- */

(async function init() {
  if (state.adminKey) {
    try {
      await enterApp();
      return;
    } catch {
      state.adminKey = null;
      localStorage.removeItem('brainrotAdminKey');
    }
  }
  $('#login-screen').classList.remove('hidden');
})();
