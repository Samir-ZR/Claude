const RARITY_LABELS = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
  mythic: 'Mythique',
  god: 'Brainrot God'
};

const state = {
  brainrots: [],
  orders: [],
  adminKey: localStorage.getItem('brainrotAdminKey') || null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function isAdmin() {
  return !!state.adminKey;
}

function currency(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (options.admin) {
    headers['x-admin-key'] = state.adminKey || '';
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Erreur ${res.status}`);
  }
  return data;
}

/* ---------- Rendering ---------- */

function renderBrainrots() {
  const grid = $('#brainrot-grid');
  grid.innerHTML = '';
  $('#shop-empty').classList.toggle('hidden', state.brainrots.length > 0);

  for (const item of state.brainrots) {
    const card = document.createElement('div');
    card.className = 'card';

    const outOfStock = item.stock <= 0;

    card.innerHTML = `
      <div class="card__top">
        <span class="card__emoji">${item.emoji || '🐸'}</span>
        <div class="card__top-right">
          <span class="rarity-badge ${item.rarity}">${RARITY_LABELS[item.rarity] || item.rarity}</span>
          ${isAdmin() ? `<button class="icon-btn" data-edit="${item.id}" title="Modifier">✏️</button>` : ''}
        </div>
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="card__desc">${escapeHtml(item.description || '')}</p>
      <div class="card__footer">
        <span class="card__price">${currency(item.price)}</span>
        <span class="card__stock">${outOfStock ? 'Rupture de stock' : `${item.stock} en stock`}</span>
      </div>
      <button class="btn btn--buy" data-buy="${item.id}" ${outOfStock ? 'disabled' : ''}>
        ${outOfStock ? 'Indisponible' : 'Acheter'}
      </button>
    `;
    grid.appendChild(card);
  }

  $('#add-brainrot-btn').classList.toggle('hidden', !isAdmin());

  grid.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => openBuyModal(btn.dataset.buy));
  });
  grid.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit));
  });
}

function renderOrders() {
  const tbody = $('#orders-tbody');
  tbody.innerHTML = '';
  $('#orders-empty').classList.toggle('hidden', state.orders.length > 0);

  for (const order of state.orders) {
    const tr = document.createElement('tr');
    const date = new Date(order.createdAt).toLocaleString('fr-FR');
    tr.innerHTML = `
      <td>${date}</td>
      <td>${escapeHtml(order.brainrotName)}</td>
      <td>${order.quantity}</td>
      <td>${currency(order.total)}</td>
      <td>${escapeHtml(order.buyerName)}</td>
      <td>${escapeHtml(order.buyerContact)}</td>
      <td>
        <select class="status-select" data-status="${order.id}">
          <option value="en_attente" ${order.status === 'en_attente' ? 'selected' : ''}>En attente</option>
          <option value="payee" ${order.status === 'payee' ? 'selected' : ''}>Payée</option>
          <option value="livree" ${order.status === 'livree' ? 'selected' : ''}>Livrée</option>
          <option value="annulee" ${order.status === 'annulee' ? 'selected' : ''}>Annulée</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/orders/${select.dataset.status}`, {
          method: 'PUT',
          admin: true,
          body: JSON.stringify({ status: select.value })
        });
        await loadOrders();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------- Data loading ---------- */

async function loadBrainrots() {
  state.brainrots = await api('/api/brainrots');
  renderBrainrots();
}

async function loadOrders() {
  if (!isAdmin()) return;
  state.orders = await api('/api/orders', { admin: true });
  renderOrders();
}

/* ---------- Modals ---------- */

function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

$$('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').classList.add('hidden');
  });
});

$$('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

/* ---------- Admin login ---------- */

function updateAdminUI() {
  $('#admin-toggle').textContent = isAdmin() ? '🔓 Déconnexion admin' : '🔒 Mode admin';
  $('#orders-tab-btn').classList.toggle('hidden', !isAdmin());
  if (!isAdmin()) {
    switchTab('shop');
  }
}

$('#admin-toggle').addEventListener('click', () => {
  if (isAdmin()) {
    state.adminKey = null;
    localStorage.removeItem('brainrotAdminKey');
    updateAdminUI();
    renderBrainrots();
  } else {
    $('#login-error').classList.add('hidden');
    $('#admin-password').value = '';
    openModal('login-modal');
  }
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#admin-password').value;
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    state.adminKey = password;
    localStorage.setItem('brainrotAdminKey', password);
    closeModal('login-modal');
    updateAdminUI();
    renderBrainrots();
    await loadOrders();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').classList.remove('hidden');
  }
});

/* ---------- Tabs ---------- */

function switchTab(tab) {
  $$('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
}

$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
    if (btn.dataset.tab === 'orders') loadOrders();
  });
});

/* ---------- Add / edit brainrot ---------- */

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
      await api(`/api/brainrots/${id}`, { method: 'PUT', admin: true, body: JSON.stringify(payload) });
    } else {
      await api('/api/brainrots', { method: 'POST', admin: true, body: JSON.stringify(payload) });
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
    await api(`/api/brainrots/${id}`, { method: 'DELETE', admin: true });
    closeModal('brainrot-modal');
    await loadBrainrots();
  } catch (err) {
    $('#brainrot-form-error').textContent = err.message;
    $('#brainrot-form-error').classList.remove('hidden');
  }
});

/* ---------- Buy flow ---------- */

function openBuyModal(id) {
  const item = state.brainrots.find((b) => b.id === id);
  if (!item) return;
  $('#buy-brainrot-id').value = item.id;
  $('#buy-item-name').textContent = item.name;
  $('#buy-item-price').textContent = `${currency(item.price)} — ${item.stock} en stock`;
  $('#buy-quantity').max = item.stock;
  $('#buy-quantity').value = 1;
  $('#buy-name').value = '';
  $('#buy-contact').value = '';
  $('#buy-form-error').classList.add('hidden');
  openModal('buy-modal');
}

$('#buy-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    brainrotId: $('#buy-brainrot-id').value,
    quantity: parseInt($('#buy-quantity').value, 10),
    buyerName: $('#buy-name').value,
    buyerContact: $('#buy-contact').value
  };
  try {
    await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    closeModal('buy-modal');
    openModal('confirm-modal');
    await loadBrainrots();
  } catch (err) {
    $('#buy-form-error').textContent = err.message;
    $('#buy-form-error').classList.remove('hidden');
  }
});

/* ---------- Init ---------- */

(async function init() {
  updateAdminUI();
  await loadBrainrots();
  if (isAdmin()) await loadOrders();
})();
