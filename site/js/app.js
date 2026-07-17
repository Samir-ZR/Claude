const RARITY_LABELS = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
  mythic: 'Mythique',
  god: 'Brainrot God'
};

const state = {
  db: null,
  cart: JSON.parse(localStorage.getItem('brainrotCart') || '[]')
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

function brainrots() {
  return (state.db && state.db.brainrots) || [];
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
  const product = brainrots().find((b) => b.id === id);
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

function applySettings() {
  const s = state.db && state.db.settings;
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

  $('#custom-html-block').innerHTML = s.customHtml || '';

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
  $('#shop-empty').classList.toggle('hidden', brainrots().length > 0);

  const contactSelect = $('#contact-brainrot');
  contactSelect.innerHTML = '<option value="">— Aucun en particulier —</option>';
  for (const item of brainrots()) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    contactSelect.appendChild(opt);
  }

  for (const item of brainrots()) {
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
    .map((l) => ({ ...l, product: brainrots().find((b) => b.id === l.brainrotId) }))
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

async function loadAll() {
  try {
    state.db = await dbRead();
    $('#load-error').classList.add('hidden');
  } catch (err) {
    $('#load-error').textContent = err.message;
    $('#load-error').classList.remove('hidden');
    return;
  }
  applySettings();
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
  const buyerName = $('#checkout-name').value.trim();
  const buyerContact = $('#checkout-contact').value.trim();
  const errorEl = $('#checkout-error');
  errorEl.classList.add('hidden');

  if (!buyerName || !buyerContact || state.cart.length === 0) return;

  const submitBtn = $('#checkout-submit');
  submitBtn.disabled = true;
  try {
    const cartSnapshot = state.cart.map((l) => ({ ...l }));
    const { data } = await dbUpdate((db) => {
      const items = [];
      for (const line of cartSnapshot) {
        const product = (db.brainrots || []).find((b) => b.id === line.brainrotId);
        if (!product) throw new Error('Un brainrot du panier n\'existe plus. Recharge la page.');
        if (product.stock < line.quantity) {
          throw new Error(`Stock insuffisant pour ${product.name} (${product.stock} disponible${product.stock > 1 ? 's' : ''}).`);
        }
        items.push({
          brainrotId: product.id,
          name: product.name,
          emoji: product.emoji,
          unitPrice: product.price,
          quantity: line.quantity
        });
      }
      for (const item of items) {
        const product = db.brainrots.find((b) => b.id === item.brainrotId);
        product.stock -= item.quantity;
      }
      const total = Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;
      db.orders = db.orders || [];
      db.orders.push({
        id: uid(),
        items,
        total,
        buyerName,
        buyerContact,
        status: 'en_attente',
        seen: false,
        createdAt: new Date().toISOString()
      });
    });
    state.db = data;
    state.cart = [];
    saveCart();
    closeModal('checkout-modal');
    $('#confirm-title').textContent = 'Commande envoyée !';
    $('#confirm-text').textContent = 'Le vendeur va te contacter pour finaliser le paiement et la livraison.';
    openModal('confirm-modal');
    applySettings();
    renderBrainrots();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
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
  const name = $('#contact-name').value.trim();
  const contact = $('#contact-contact').value.trim();
  const message = $('#contact-message').value.trim();
  const brainrotId = $('#contact-brainrot').value || null;
  const errorEl = $('#contact-error');
  errorEl.classList.add('hidden');

  if (!name || !contact || !message) return;

  const submitBtn = $('#contact-submit');
  submitBtn.disabled = true;
  try {
    const { data } = await dbUpdate((db) => {
      const product = brainrotId ? (db.brainrots || []).find((b) => b.id === brainrotId) : null;
      db.messages = db.messages || [];
      db.messages.push({
        id: uid(),
        name,
        contact,
        message,
        brainrotId,
        brainrotName: product ? product.name : null,
        read: false,
        createdAt: new Date().toISOString()
      });
    });
    state.db = data;
    closeModal('contact-modal');
    $('#confirm-title').textContent = 'Message envoyé !';
    $('#confirm-text').textContent = 'Le vendeur te répondra directement via le contact que tu as donné.';
    openModal('confirm-modal');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Init ---------- */

loadAll();
