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
  cart: JSON.parse(localStorage.getItem('brainrotCart') || '[]'),
  settings: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function currency(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function saveCart() {
  localStorage.setItem('brainrotCart', JSON.stringify(state.cart));
  renderCartCount();
}

function cartQty(id) {
  const line = state.cart.find((l) => l.brainrotId === id);
  return line ? line.quantity : 0;
}

function addToCart(id, delta) {
  const product = state.brainrots.find((b) => b.id === id);
  if (!product) return;
  const line = state.cart.find((l) => l.brainrotId === id);
  const current = line ? line.quantity : 0;
  const next = Math.max(0, Math.min(product.stock, current + delta));

  if (next === 0) {
    state.cart = state.cart.filter((l) => l.brainrotId !== id);
  } else if (line) {
    line.quantity = next;
  } else {
    state.cart.push({ brainrotId: id, quantity: next });
  }
  saveCart();
  renderBrainrots();
  if (!$('#cart-modal').classList.contains('hidden')) renderCart();
}

/* ---------- Settings / theme ---------- */

async function loadSettings() {
  state.settings = await api('/api/settings');
  applySettings();
}

function applySettings() {
  const s = state.settings;
  if (!s) return;
  document.title = `${s.shopName} — Achète les meilleurs brainrot`;
  $('#shop-logo').textContent = s.logoEmoji || '🧠';
  $('#shop-name').textContent = s.shopName || 'Brainrot Shop';
  $('#shop-tagline').textContent = s.tagline || '';
  $('#hero-title').textContent = s.heroTitle || 'Catalogue';
  $('#hero-subtitle').textContent = s.heroSubtitle || '';

  document.documentElement.style.setProperty('--accent', s.primaryColor || '#7c3aed');
  document.documentElement.style.setProperty('--accent-2', s.accentColor || '#22d3ee');

  const banner = $('#banner');
  if (s.bannerEnabled && s.bannerText) {
    banner.textContent = s.bannerText;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  const customBlock = $('#custom-html-block');
  customBlock.innerHTML = s.customHtml || '';

  if (s.customCss) {
    let styleTag = document.getElementById('custom-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'custom-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = s.customCss;
  }

  if (s.customJs) {
    try {
      // eslint-disable-next-line no-new-func
      const run = new Function(s.customJs);
      run();
    } catch (err) {
      console.error('Erreur dans le code personnalisé du vendeur :', err);
    }
  }
}

/* ---------- Rendering ---------- */

function renderBrainrots() {
  const grid = $('#brainrot-grid');
  grid.innerHTML = '';
  $('#shop-empty').classList.toggle('hidden', state.brainrots.length > 0);

  const contactSelect = $('#contact-brainrot');
  contactSelect.innerHTML = '<option value="">— Aucun en particulier —</option>';
  for (const item of state.brainrots) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    contactSelect.appendChild(opt);
  }

  for (const item of state.brainrots) {
    const card = document.createElement('div');
    card.className = 'card';
    const outOfStock = item.stock <= 0;
    const qty = cartQty(item.id);

    card.innerHTML = `
      <div class="card__top">
        <span class="card__emoji">${item.emoji || '🐸'}</span>
        <span class="rarity-badge ${item.rarity}">${RARITY_LABELS[item.rarity] || item.rarity}</span>
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="card__desc">${escapeHtml(item.description || '')}</p>
      <div class="card__footer">
        <span class="card__price">${currency(item.price)}</span>
        <span class="card__stock">${outOfStock ? 'Rupture de stock' : `${item.stock} en stock`}</span>
      </div>
      ${outOfStock
        ? `<button class="btn btn--buy" disabled>Indisponible</button>`
        : qty > 0
          ? `<div class="qty-stepper" style="justify-content:center;">
               <button data-cart-minus="${item.id}">−</button>
               <span>${qty}</span>
               <button data-cart-plus="${item.id}">+</button>
             </div>`
          : `<button class="btn btn--buy" data-cart-plus="${item.id}">Ajouter au panier</button>`
      }
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll('[data-cart-plus]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.cartPlus, 1));
  });
  grid.querySelectorAll('[data-cart-minus]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.cartMinus, -1));
  });
}

function renderCartCount() {
  const count = state.cart.reduce((s, l) => s + l.quantity, 0);
  $('#cart-count').textContent = count;
}

function renderCart() {
  const container = $('#cart-items');
  container.innerHTML = '';
  const lines = state.cart
    .map((l) => ({ ...l, product: state.brainrots.find((b) => b.id === l.brainrotId) }))
    .filter((l) => l.product);

  $('#cart-empty').classList.toggle('hidden', lines.length > 0);
  $('#cart-total-row').classList.toggle('hidden', lines.length === 0);
  $('#checkout-btn').disabled = lines.length === 0;

  let total = 0;
  for (const line of lines) {
    total += line.product.price * line.quantity;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <span class="cart-item__emoji">${line.product.emoji || '🐸'}</span>
      <div class="cart-item__info">
        <strong>${escapeHtml(line.product.name)}</strong>
        <span>${currency(line.product.price)} × ${line.quantity}</span>
      </div>
      <div class="qty-stepper">
        <button data-cart-minus="${line.product.id}">−</button>
        <span>${line.quantity}</span>
        <button data-cart-plus="${line.product.id}" ${line.quantity >= line.product.stock ? 'disabled' : ''}>+</button>
      </div>
      <button class="cart-item__remove" data-cart-remove="${line.product.id}" title="Retirer">✕</button>
    `;
    container.appendChild(row);
  }

  $('#cart-total').textContent = currency(total);

  container.querySelectorAll('[data-cart-plus]').forEach((btn) => {
    btn.addEventListener('click', () => { addToCart(btn.dataset.cartPlus, 1); renderCart(); });
  });
  container.querySelectorAll('[data-cart-minus]').forEach((btn) => {
    btn.addEventListener('click', () => { addToCart(btn.dataset.cartMinus, -1); renderCart(); });
  });
  container.querySelectorAll('[data-cart-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cart = state.cart.filter((l) => l.brainrotId !== btn.dataset.cartRemove);
      saveCart();
      renderBrainrots();
      renderCart();
    });
  });
}

/* ---------- Data loading ---------- */

async function loadBrainrots() {
  state.brainrots = await api('/api/brainrots');
  renderBrainrots();
  renderCartCount();
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

/* ---------- Cart / checkout ---------- */

$('#cart-btn').addEventListener('click', () => {
  renderCart();
  openModal('cart-modal');
});

$('#checkout-btn').addEventListener('click', () => {
  if (state.cart.length === 0) return;
  closeModal('cart-modal');
  $('#checkout-name').value = '';
  $('#checkout-contact').value = '';
  $('#checkout-error').classList.add('hidden');
  openModal('checkout-modal');
});

$('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    items: state.cart.map((l) => ({ brainrotId: l.brainrotId, quantity: l.quantity })),
    buyerName: $('#checkout-name').value,
    buyerContact: $('#checkout-contact').value
  };
  try {
    await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    state.cart = [];
    saveCart();
    closeModal('checkout-modal');
    $('#confirm-title').textContent = 'Commande envoyée !';
    $('#confirm-text').textContent = 'Le vendeur va te contacter pour finaliser le paiement et la livraison.';
    openModal('confirm-modal');
    await loadBrainrots();
  } catch (err) {
    $('#checkout-error').textContent = err.message;
    $('#checkout-error').classList.remove('hidden');
  }
});

/* ---------- Contact / message ---------- */

$('#contact-btn').addEventListener('click', () => {
  $('#contact-form').reset();
  $('#contact-error').classList.add('hidden');
  openModal('contact-modal');
});

$('#contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: $('#contact-name').value,
    contact: $('#contact-contact').value,
    message: $('#contact-message').value,
    brainrotId: $('#contact-brainrot').value || null
  };
  try {
    await api('/api/messages', { method: 'POST', body: JSON.stringify(payload) });
    closeModal('contact-modal');
    $('#confirm-title').textContent = 'Message envoyé !';
    $('#confirm-text').textContent = 'Le vendeur te répondra directement via le contact que tu as donné.';
    openModal('confirm-modal');
  } catch (err) {
    $('#contact-error').textContent = err.message;
    $('#contact-error').classList.remove('hidden');
  }
});

/* ---------- Init ---------- */

(async function init() {
  await loadSettings();
  await loadBrainrots();
})();
