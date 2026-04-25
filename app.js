'use strict';

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://uofhyrawyjhqbdztagae.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZmh5cmF3eWpocWJkenRhZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTgwMDEsImV4cCI6MjA5MjA5NDAwMX0.ihOsMlG6LBe71Ta13T1Pomzv38zX3Vw8YIw9Pn2FfjU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'card-images';

function imgUrl(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── Load cards ────────────────────────────────────────────────────────────────
async function loadCards() {
  const { data, error } = await sb.from('cards').select(`
    *,
    minion_cards(*),
    spell_cards(*),
    structure_cards(*)
  `).order('id');
  if (error) { console.error(error); return []; }
  return data.map(c => {
    const extra = c.minion_cards || c.spell_cards || c.structure_cards || {};
    const { minion_cards, spell_cards, structure_cards, ...base } = c;
    return { ...base, ...extra };
  });
}

async function saveCard(base, extra, imageFile, imageFile2) {
  async function uploadImg(file, suffix) {
    const ext  = file.name.split('.').pop();
    const path = `${base.id}${suffix}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { showToast('Bilduppladdning misslyckades: ' + error.message); return null; }
    return path;
  }

  const paths = [];
  if (imageFile) {
    const p = await uploadImg(imageFile, imageFile2 ? '_v1' : '');
    if (!p) return false;
    paths.push(p);
  }
  if (imageFile2) {
    const p = await uploadImg(imageFile2, '_v2');
    if (!p) return false;
    paths.push(p);
  }

  if (paths.length) {
    base.artwork_path = paths.join(', ');
  }

  const { error: cardErr } = await sb.from('cards').insert(base);
  if (cardErr) { showToast('Fel: ' + cardErr.message); return false; }

  const table = base.card_type === 'minion' ? 'minion_cards'
              : base.card_type === 'spell'   ? 'spell_cards'
              : 'structure_cards';

  const { error: typeErr } = await sb.from(table).insert({ card_id: base.id, ...extra });
  if (typeErr) {
    await sb.from('cards').delete().eq('id', base.id);
    showToast('Fel: ' + typeErr.message);
    return false;
  }
  return true;
}

async function deleteCard(id) {
  const { error } = await sb.from('cards').delete().eq('id', id);
  if (error) { showToast('Fel: ' + error.message); return false; }
  return true;
}

async function updateCard(id, base, extra, imageFile, imageFile2) {
  // Ladda upp nya bilder om de valts
  async function uploadImg(file, suffix) {
    const ext  = file.name.split('.').pop();
    const path = `${id}${suffix}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { showToast('Bilduppladdning misslyckades: ' + error.message); return null; }
    return path;
  }

  const paths = [];
  if (imageFile)  { const p = await uploadImg(imageFile,  imageFile2 ? '_v1' : ''); if (!p) return false; paths.push(p); }
  if (imageFile2) { const p = await uploadImg(imageFile2, '_v2'); if (!p) return false; paths.push(p); }
  base.artwork_path = paths.length ? paths.join(', ') : editingArtworkPath;

  const { error: cardErr } = await sb.from('cards').update(base).eq('id', id);
  if (cardErr) { showToast('Fel: ' + cardErr.message); return false; }

  const table = base.card_type === 'minion' ? 'minion_cards'
              : base.card_type === 'spell'   ? 'spell_cards'
              : 'structure_cards';
  const { error: typeErr } = await sb.from(table).upsert({ card_id: id, ...extra });
  if (typeErr) { showToast('Fel: ' + typeErr.message); return false; }
  return true;
}

async function nextId() {
  const cards = await loadCards();
  const nums  = cards.map(c => parseInt(c.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const max   = nums.length ? Math.max(...nums) : 0;
  return 'A' + String(max + 1).padStart(5, '0');
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appEl       = document.getElementById('app');

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp();
  else         showLogin();
}

function showApp()   { loginScreen.style.display = 'none';  appEl.style.display = 'block'; }
function showLogin() { loginScreen.style.display = 'flex';  appEl.style.display = 'none'; }

document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = 'Fel email eller lösenord.';
    errEl.style.display = 'block';
  } else {
    showApp();
    showPage('page-overview');
    renderGrid();
  }
});

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  showLogin();
});

// ── Navigation ────────────────────────────────────────────────────────────────
const pages   = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('nav button[data-page]');

const DROPDOWN_PARENTS = {
  'page-overview':        'nav-btn-overview',
  'page-overview-skills': 'nav-btn-overview',
  'page-add':             'nav-btn-add',
  'page-add-skill':       'nav-btn-add',
};

function showPage(id) {
  pages.forEach(p => p.classList.toggle('active', p.id === id));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === id));

  document.querySelectorAll('.nav-dropdown-btn').forEach(btn => btn.classList.remove('active'));
  const parentId = DROPDOWN_PARENTS[id];
  if (parentId) document.getElementById(parentId).classList.add('active');

  if (id === 'page-overview')        renderGrid();
  if (id === 'page-overview-skills') renderSkillsGrid();
  if (id === 'page-list')            renderCardList();
  if (id === 'page-export')          renderExport();
}

navBtns.forEach(b => b.addEventListener('click', () => {
  showPage(b.dataset.page);
  closeAllDropdowns();
  if (b.dataset.scroll) {
    setTimeout(() => {
      const el = document.getElementById(b.dataset.scroll);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}));

// ── Dropdown toggle ───────────────────────────────────────────────────────────
function closeAllDropdowns() {
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
}

document.querySelectorAll('.nav-dropdown-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const dropdown = btn.closest('.nav-dropdown');
    const wasOpen  = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) dropdown.classList.add('open');
  });
});

document.addEventListener('click', closeAllDropdowns);

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = document.getElementById('toast');
let toastTimer;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Overview ──────────────────────────────────────────────────────────────────
const grid       = document.getElementById('card-grid');
const cardCount      = document.getElementById('card-count');
const searchEl       = document.getElementById('search');
const filterKeywords = document.getElementById('filter-keywords');
const filterType     = document.getElementById('filter-type');
const filterClass    = document.getElementById('filter-class');
const filterRar      = document.getElementById('filter-rarity');
const filterEffect   = document.getElementById('filter-effect');
const filterMana     = document.getElementById('filter-mana');
const filterAttack   = document.getElementById('filter-attack');
const filterHealth   = document.getElementById('filter-health');

const CLASS_ORDER = ['Dark', 'Wasteland', 'The Blue', 'Forest', 'Neutral'];

function cardTileHTML(c) {
  const firstPath = c.artwork_path ? c.artwork_path.split(',')[0].trim() : null;
  const imgSrc = firstPath ? imgUrl(firstPath) : null;

  const imgContent = imgSrc ? `<img src="${imgSrc}" alt="${c.name}">` : `<div class="no-img">🃏</div>`;

  let statsOverlay = '';
  if (c.card_type === 'minion') {
    statsOverlay = `<div class="card-overlay-stats">
      <span class="card-stat-atk">${c.attack ?? '?'}</span>
      <span class="card-stat-hp">${c.health ?? '?'}</span>
    </div>`;
  } else if (c.card_type === 'structure') {
    statsOverlay = `<div class="card-overlay-stats">
      <span class="card-stat-hp">${c.armor ?? '?'}</span>
    </div>`;
  }

  const keywords = (c.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  const kwHTML = keywords.length
    ? `<div class="card-tile-keywords">${keywords.map(k => `<span class="kw-badge">${k}</span>`).join('')}</div>`
    : '';

  const effectInfo = c.card_type === 'spell' && c.effect_id
    ? `<span style="font-size:10px;color:var(--muted)">${c.effect_id} ${c.effect_value > 0 ? c.effect_value : ''}</span>`
    : c.ability_id ? `<span style="font-size:10px;color:var(--muted)">${c.ability_id} ${c.ability_value > 0 ? c.ability_value : ''}</span>` : '';

  return `
  <div class="card-tile" data-id="${c.id}" title="${c.id}">
    <button class="tile-del" data-del="${c.id}">✕</button>
    <div class="card-tile-img-wrap">
      ${imgContent}
      <div class="card-overlay-mana">${c.mana ?? 0}</div>
      ${statsOverlay}
    </div>
    <div class="card-tile-info">
      <div class="card-tile-name">${c.name}</div>
      <div class="card-tile-badges">
        <span class="badge badge-${c.card_type}">${c.card_type}</span>
        <span class="badge badge-${c.rarity}">${c.rarity}</span>
        ${effectInfo}
      </div>
      ${kwHTML}
    </div>
  </div>`;
}

async function renderGrid() {
  grid.innerHTML = `<div class="empty-state">⏳<p>Laddar kort…</p></div>`;
  let cards = await loadCards();

  const q      = searchEl.value.trim().toLowerCase();
  const kw     = filterKeywords.value.trim().toUpperCase();
  const typ    = filterType.value;
  const cls    = filterClass.value;
  const rar    = filterRar.value;
  const eff    = filterEffect.value;
  const mana   = filterMana.value !== '' ? parseInt(filterMana.value) : null;
  const attack = filterAttack.value !== '' ? parseInt(filterAttack.value) : null;
  const health = filterHealth.value !== '' ? parseInt(filterHealth.value) : null;

  if (q)      cards = cards.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  if (kw)     cards = cards.filter(c => (c.keywords || '').toUpperCase().includes(kw));
  if (typ)    cards = cards.filter(c => c.card_type === typ);
  if (cls)    cards = cards.filter(c => c.card_class === cls);
  if (rar)    cards = cards.filter(c => c.rarity === rar);
  if (eff)    cards = cards.filter(c => c.effect_id === eff || c.ability_id === eff);
  if (mana   !== null) cards = cards.filter(c => (c.mana ?? 0) <= mana);
  if (attack !== null) cards = cards.filter(c => (c.attack ?? 0) >= attack);
  if (health !== null) cards = cards.filter(c => (c.health ?? 0) >= health);

  cardCount.textContent = `${cards.length} kort`;

  if (!cards.length) {
    grid.innerHTML = `<div class="empty-state">🃏<p>Inga kort hittades.</p></div>`;
    return;
  }

  const TYPE_ORDER = ['minion', 'spell', 'structure'];

  function renderSection(label, sectionCards, anchorId) {
    return `
      <div class="class-section" id="${anchorId}">
        <div class="class-heading">${label} <span class="card-count-small">${sectionCards.length}</span></div>
        <div class="class-grid">${sectionCards.map(cardTileHTML).join('')}</div>
      </div>`;
  }

  if (cls) {
    // Vald klass → gruppera per typ
    grid.innerHTML = TYPE_ORDER
      .map(typ => ({ typ, group: cards.filter(c => c.card_type === typ) }))
      .filter(({ group }) => group.length > 0)
      .map(({ typ, group }) => renderSection(
        `${cls} — ${typ.charAt(0).toUpperCase() + typ.slice(1)}`,
        group,
        `class-${cls.replace(/\s/g,'-')}-${typ}`
      )).join('');
  } else {
    // Alla klasser → gruppera per klass + typ
    grid.innerHTML = CLASS_ORDER.flatMap(cl =>
      TYPE_ORDER
        .map(t => ({ t, group: cards.filter(c => c.card_class === cl && c.card_type === t) }))
        .filter(({ group }) => group.length > 0)
        .map(({ t, group }) => renderSection(
          `${cl} — ${t.charAt(0).toUpperCase() + t.slice(1)}`,
          group,
          `class-${cl.replace(/\s/g,'-')}-${t}`
        ))
    ).join('');
  }

  grid.querySelectorAll('.tile-del').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(btn.dataset.del); });
  });

  grid.querySelectorAll('.card-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const card = cards.find(c => c.id === tile.dataset.id);
      if (card) openCardDetail(card);
    });
  });

  // Scrolla till vald klass
  if (cls) {
    const section = document.getElementById(`class-${cls.replace(/\s/g,'-')}`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

let searchTimer;
[searchEl, filterKeywords, filterType, filterClass, filterRar, filterEffect, filterMana, filterAttack, filterHealth].forEach(el => {
  el.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderGrid, 300); });
});

// ── Card detail modal ─────────────────────────────────────────────────────────
const detailModal  = document.getElementById('card-detail-modal');
const detailImages = document.getElementById('detail-images');
const detailName   = document.getElementById('detail-name');
const detailId     = document.getElementById('detail-id');
const detailBadges = document.getElementById('detail-badges');
const detailDesc   = document.getElementById('detail-desc');
const detailStats  = document.getElementById('detail-stats');

document.getElementById('btn-detail-close').addEventListener('click', () => detailModal.classList.remove('open'));
detailModal.addEventListener('click', e => { if (e.target === detailModal) detailModal.classList.remove('open'); });

document.getElementById('btn-detail-edit').addEventListener('click', () => {
  if (!currentDetailCard) return;
  detailModal.classList.remove('open');
  openEditForm(currentDetailCard);
});

let currentDetailCard = null;

function openCardDetail(card) {
  currentDetailCard = card;
  // Images
  const paths = card.artwork_path ? card.artwork_path.split(',').map(p => p.trim()).filter(Boolean) : [];
  detailImages.innerHTML = paths.length
    ? paths.map((p, i) => `
        <img src="${imgUrl(p)}" alt="Variant ${i+1}">
        ${paths.length > 1 ? `<div class="img-label">Variant ${i+1}</div>` : ''}
      `).join('')
    : '<div style="color:var(--muted);text-align:center;padding:40px">Ingen bild</div>';

  detailName.textContent = card.name;
  detailId.textContent   = `${card.id} · ${card.card_class || '-'} · Mana ${card.mana}`;

  detailBadges.innerHTML = `
    <span class="badge badge-${card.card_type}">${card.card_type}</span>
    <span class="badge badge-${card.rarity}">${card.rarity}</span>
    ${card.keywords ? card.keywords.split(',').map(k => `<span class="badge" style="background:#1a2a3a;color:#aac">${k.trim()}</span>`).join('') : ''}
  `;

  detailDesc.textContent = card.description || '—';

  const stats = [];
  if (card.card_type === 'minion') {
    stats.push(['Attack', card.attack ?? '-'], ['Health', card.health ?? '-'],
               ['Subtype', card.subtype || '-'], ['Ability', card.ability_id || '-'],
               ['Trigger', card.ability_trigger || '-'], ['Ability Cost', card.ability_cost ?? 0],
               ['Target Mode', card.ability_target_mode || '-'], ['Targeting', card.ability_targeting_mode || '-'],
               ['Ability Value', card.ability_value ?? 0], ['Draft Tag', card.draft_tag || '-']);
  } else if (card.card_type === 'spell') {
    stats.push(['Effect', card.effect_id || '-'], ['Value', card.effect_value ?? 0],
               ['Target Mode', card.target_mode || '-'], ['Targeting', card.targeting_mode || '-'],
               ['School', card.school || '-'], ['Repeat', `${card.repeat_count ?? 1}x ${card.repeat_mode || ''}`],
               ['Draft Tag', card.draft_tag || '-']);
  } else if (card.card_type === 'structure') {
    stats.push(['Armor', card.armor ?? '-'], ['Subtype', card.subtype || '-'],
               ['Maintenance', card.maintenance_cost ?? 0], ['Ability', card.ability_id || '-'],
               ['Repair Cost', card.repair_cost ?? 0], ['Repair Value', card.repair_value ?? 0],
               ['Trigger', card.trigger_id || '-'], ['Draft Tag', card.draft_tag || '-']);
  }

  detailStats.innerHTML = stats.map(([label, val]) => `
    <div class="stat-row">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${val}</div>
    </div>`).join('');

  detailModal.classList.add('open');
}

// ── Delete modal ──────────────────────────────────────────────────────────────
const delModal    = document.getElementById('delete-modal');
const delCardName = document.getElementById('del-card-name');
const btnDelCancel = document.getElementById('btn-del-cancel');
const btnDelOk    = document.getElementById('btn-del-ok');
let pendingDelId   = null;
let pendingDelType = 'card';

async function confirmDelete(id) {
  const cards = await loadCards();
  const card  = cards.find(c => c.id === id);
  if (!card) return;
  pendingDelId   = id;
  pendingDelType = 'card';
  delCardName.textContent = `"${card.name}" (${id})`;
  delModal.classList.add('open');
}

function confirmDeleteSkill(id, description) {
  pendingDelId   = id;
  pendingDelType = 'skill';
  delCardName.textContent = description ? `"${description.slice(0, 40)}${description.length > 40 ? '…' : ''}"` : 'detta skill';
  delModal.classList.add('open');
}

btnDelCancel.addEventListener('click', () => delModal.classList.remove('open'));
btnDelOk.addEventListener('click', async () => {
  if (!pendingDelId) return;
  let ok;
  if (pendingDelType === 'skill') {
    ok = await deleteSkill(pendingDelId);
    delModal.classList.remove('open');
    pendingDelId = null;
    if (ok) { showToast('Skill borttaget.'); renderSkillsGrid(); }
  } else {
    ok = await deleteCard(pendingDelId);
    delModal.classList.remove('open');
    pendingDelId = null;
    if (ok) { listAllCards = []; showToast('Kort borttaget.'); renderGrid(); }
  }
});

// ── Keyword picker ────────────────────────────────────────────────────────────
const ALL_KEYWORDS = [
  'FLYING','RAPID','RANGE','REACH','FIRST_STRIKE','DOUBLE_STRIKE',
  'TWINSTRIKE','CANT_ATTACK','PARRY','IRON_SKIN','TOXIC','VAMPIRISM','INSTANT'
];

const kwPicker = document.getElementById('keyword-picker');
const kwHidden = document.getElementById('keywords-hidden');

ALL_KEYWORDS.forEach(kw => {
  const tag = document.createElement('span');
  tag.className = 'kw-tag';
  tag.textContent = kw;
  tag.dataset.kw = kw;
  tag.addEventListener('click', () => {
    tag.classList.toggle('active');
    kwHidden.value = [...kwPicker.querySelectorAll('.kw-tag.active')]
      .map(t => t.dataset.kw).join(', ');
  });
  kwPicker.appendChild(tag);
});

function resetKeywords() {
  kwPicker.querySelectorAll('.kw-tag').forEach(t => t.classList.remove('active'));
  kwHidden.value = '';
}

// ── Duplicate check ───────────────────────────────────────────────────────────
let allCards = [];

async function refreshAllCards() {
  allCards = await loadCards();
}

function setFieldError(inputEl, msg) {
  inputEl.style.borderColor = msg ? 'var(--danger)' : '';
  let hint = inputEl.nextElementSibling;
  if (hint && hint.classList.contains('field-error')) hint.remove();
  if (msg) {
    const el = document.createElement('span');
    el.className = 'field-error';
    el.textContent = msg;
    inputEl.after(el);
  }
}

function checkDuplicateId(val) {
  if (!val) return;
  const dup = allCards.find(c => c.id.toLowerCase() === val.toLowerCase());
  setFieldError(document.getElementById('field-id'), dup ? `ID "${val}" är redan taget` : null);
}

function checkDuplicateName(val) {
  if (!val) return;
  const dup = allCards.find(c => c.name.toLowerCase() === val.toLowerCase());
  const el  = document.querySelector('input[name="name"]');
  setFieldError(el, dup ? `Namn "${val}" är redan taget (${dup.id})` : null);
}

// ── Add Card form ─────────────────────────────────────────────────────────────
const form            = document.getElementById('card-form');
const typeSelect      = document.getElementById('field-card_type');
const artworkInput    = document.getElementById('artwork-input');
const artworkPreview  = document.getElementById('artwork-preview');
const artworkFilename = document.getElementById('artwork-filename');
const artworkInput2    = document.getElementById('artwork-input-2');
const artworkPreview2  = document.getElementById('artwork-preview-2');
const artworkFilename2 = document.getElementById('artwork-filename-2');
const artwork2Wrap     = document.getElementById('artwork2-wrap');
const artworkLabel1    = document.getElementById('artwork-label-1');

let selectedImageFile  = null;
let selectedImageFile2 = null;

function setupArtworkUpload(input, preview, filenameEl, slot) {
  preview.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (slot === 1) selectedImageFile  = file;
    else            selectedImageFile2 = file;
    filenameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" alt="preview">`; };
    reader.readAsDataURL(file);
  });
}

setupArtworkUpload(artworkInput,  artworkPreview,  artworkFilename,  1);
setupArtworkUpload(artworkInput2, artworkPreview2, artworkFilename2, 2);

typeSelect.addEventListener('change', updateTypeSections);

function updateTypeSections() {
  const t = typeSelect.value;
  document.querySelectorAll('.type-section').forEach(s => {
    s.classList.toggle('visible', s.dataset.type === t);
  });
  const needsTwo = t === 'minion' || t === 'structure';
  artwork2Wrap.style.display  = needsTwo ? 'flex' : 'none';
  artworkLabel1.textContent   = needsTwo ? 'Variant 1' : 'Bild';
}

updateTypeSections();

async function resetForm() {
  editingId = null;
  editingArtworkPath = '';
  form.reset();
  selectedImageFile  = null;
  selectedImageFile2 = null;
  artworkPreview.innerHTML  = '🖼';
  artworkPreview2.innerHTML = '🖼';
  artworkFilename.textContent  = '';
  artworkFilename2.textContent = '';
  document.getElementById('field-id').readOnly = false;
  document.getElementById('field-id').value = await nextId();
  document.getElementById('form-title').textContent = 'Lägg till kort';
  form.querySelector('button[type="submit"]').textContent = 'Spara kort';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  updateTypeSections();
  resetKeywords();
}

let editingId = null;
let editingArtworkPath = '';

function setFieldVal(name, val) {
  const el = form.querySelector(`[name="${name}"]`);
  if (el && val !== undefined && val !== null) el.value = val;
}

async function openEditForm(card) {
  editingId = card.id;
  editingArtworkPath = card.artwork_path || '';
  await refreshAllCards();
  document.getElementById('form-title').textContent = `Redigera kort — ${card.name}`;
  form.querySelector('button[type="submit"]').textContent = 'Spara ändringar';
  document.getElementById('btn-cancel-edit').style.display = 'inline-block';

  setFieldVal('id',          card.id);
  setFieldVal('name',        card.name);
  setFieldVal('mana',        card.mana);
  setFieldVal('card_class',  card.card_class);
  setFieldVal('card_type',   card.card_type);
  setFieldVal('description', card.description);
  setFieldVal('rarity',      card.rarity);
  setFieldVal('draft_tag',   card.draft_tag);
  document.getElementById('field-id').readOnly = true;

  // Keywords
  resetKeywords();
  if (card.keywords) {
    card.keywords.split(',').map(k => k.trim()).forEach(kw => {
      const tag = kwPicker.querySelector(`[data-kw="${kw}"]`);
      if (tag) tag.classList.add('active');
    });
    kwHidden.value = card.keywords;
  }

  updateTypeSections();

  if (card.card_type === 'minion') {
    setFieldVal('attack', card.attack); setFieldVal('health', card.health);
    setFieldVal('subtype', card.subtype); setFieldVal('ability_id', card.ability_id);
    setFieldVal('ability_trigger', card.ability_trigger); setFieldVal('ability_cost', card.ability_cost);
    setFieldVal('ability_target_mode', card.ability_target_mode);
    setFieldVal('ability_targeting_mode', card.ability_targeting_mode);
    setFieldVal('ability_value', card.ability_value); setFieldVal('ability_arg', card.ability_arg);
  } else if (card.card_type === 'spell') {
    setFieldVal('effect_id', card.effect_id); setFieldVal('effect_value', card.effect_value);
    setFieldVal('target_mode', card.target_mode); setFieldVal('targeting_mode', card.targeting_mode);
    setFieldVal('school', card.school); setFieldVal('effect_arg', card.effect_arg);
    setFieldVal('repeat_count', card.repeat_count); setFieldVal('repeat_mode', card.repeat_mode);
  } else if (card.card_type === 'structure') {
    setFieldVal('armor', card.armor); setFieldVal('s_subtype', card.subtype);
    setFieldVal('maintenance_cost', card.maintenance_cost); setFieldVal('s_ability_id', card.ability_id);
    setFieldVal('s_ability_cost', card.ability_cost); setFieldVal('s_ability_target_mode', card.ability_target_mode);
    setFieldVal('s_ability_targeting_mode', card.ability_targeting_mode);
    setFieldVal('s_ability_value', card.ability_value); setFieldVal('s_ability_arg', card.ability_arg);
    setFieldVal('repair_cost', card.repair_cost); setFieldVal('repair_value', card.repair_value);
    setFieldVal('trigger_id', card.trigger_id); setFieldVal('trigger_value', card.trigger_value);
    setFieldVal('trigger_target_mode', card.trigger_target_mode);
  }

  // Visa befintliga bilder
  if (card.artwork_path) {
    const paths = card.artwork_path.split(',').map(p => p.trim());
    if (paths[0]) {
      artworkPreview.innerHTML = `<img src="${imgUrl(paths[0])}" alt="">`;
      artworkFilename.textContent = paths[0] + ' (befintlig)';
    }
    if (paths[1]) {
      artworkPreview2.innerHTML = `<img src="${imgUrl(paths[1])}" alt="">`;
      artworkFilename2.textContent = paths[1] + ' (befintlig)';
    }
  }

  showPage('page-add');
}

document.querySelector('nav button[data-page="page-add"]').addEventListener('click', async () => {
  if (editingId) { editingId = null; await resetForm(); }
  await refreshAllCards();
  document.getElementById('field-id').value = await nextId();
});

document.getElementById('field-id').addEventListener('input', e => checkDuplicateId(e.target.value.trim()));
document.querySelector('input[name="name"]').addEventListener('input', e => checkDuplicateName(e.target.value.trim()));

form.addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sparar…';

  const fd  = new FormData(form);
  const get = k => fd.get(k)?.trim() ?? '';

  const base = {
    id:          get('id'),
    name:        get('name'),
    mana:        parseInt(get('mana')) || 0,
    card_class:  get('card_class'),
    card_type:   get('card_type'),
    description: get('description'),
    artwork_path: selectedImageFile ? '' : '',
    rarity:      get('rarity'),
    keywords:    get('keywords'),
    draft_tag:   get('draft_tag'),
  };

  if (!base.id || !base.name || !base.card_type) {
    showToast('ID, Namn och Typ krävs.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Spara kort';
    return;
  }

  if (!editingId) {
    await refreshAllCards();
    if (allCards.find(c => c.id.toLowerCase() === base.id.toLowerCase())) {
      showToast(`ID "${base.id}" är redan taget!`);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Spara kort';
      return;
    }
    if (allCards.find(c => c.name.toLowerCase() === base.name.toLowerCase())) {
      showToast(`Namn "${base.name}" är redan taget!`);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Spara kort';
      return;
    }
  }

  let extra = {};
  if (base.card_type === 'minion') {
    extra = {
      attack: parseInt(get('attack')) || 0,
      health: parseInt(get('health')) || 1,
      subtype: get('subtype'),
      ability_id: get('ability_id'),
      ability_trigger: get('ability_trigger'),
      ability_cost: parseInt(get('ability_cost')) || 0,
      ability_target_mode: get('ability_target_mode'),
      ability_targeting_mode: get('ability_targeting_mode') || 'explicit',
      ability_value: parseInt(get('ability_value')) || 0,
      ability_arg: get('ability_arg'),
    };
  } else if (base.card_type === 'spell') {
    extra = {
      effect_id: get('effect_id'),
      effect_value: parseInt(get('effect_value')) || 0,
      target_mode: get('target_mode'),
      targeting_mode: get('targeting_mode') || 'explicit',
      school: get('school'),
      effect_arg: get('effect_arg'),
      repeat_count: parseInt(get('repeat_count')) || 1,
      repeat_mode: get('repeat_mode') || 'same_target',
    };
  } else if (base.card_type === 'structure') {
    extra = {
      armor: parseInt(get('armor')) || 1,
      subtype: get('s_subtype'),
      maintenance_cost: parseInt(get('maintenance_cost')) || 0,
      ability_id: get('s_ability_id'),
      ability_cost: parseInt(get('s_ability_cost')) || 0,
      ability_target_mode: get('s_ability_target_mode'),
      ability_targeting_mode: get('s_ability_targeting_mode') || 'explicit',
      ability_value: parseInt(get('s_ability_value')) || 0,
      ability_arg: get('s_ability_arg'),
      repair_cost: parseInt(get('repair_cost')) || 0,
      repair_value: parseInt(get('repair_value')) || 0,
      trigger_id: get('trigger_id'),
      trigger_value: parseInt(get('trigger_value')) || 0,
      trigger_target_mode: get('trigger_target_mode') || 'enemy_hero',
    };
  }

  const ok = editingId
    ? await updateCard(editingId, base, extra, selectedImageFile, selectedImageFile2)
    : await saveCard(base, extra, selectedImageFile, selectedImageFile2);

  submitBtn.disabled = false;
  submitBtn.textContent = editingId ? 'Spara ändringar' : 'Spara kort';

  if (ok) {
    listAllCards = [];
    showToast(editingId ? `"${base.name}" uppdaterat!` : `"${base.name}" sparat!`);
    await resetForm();
    showPage('page-overview');
  }
});

document.getElementById('btn-reset').addEventListener('click', resetForm);

document.getElementById('btn-cancel-edit').addEventListener('click', async () => {
  await resetForm();
  showPage('page-overview');
});

document.getElementById('btn-clear-filters').addEventListener('click', () => {
  searchEl.value = '';
  filterKeywords.value = '';
  filterType.value = '';
  filterClass.value = '';
  filterRar.value = '';
  filterEffect.value = '';
  filterMana.value = '';
  filterAttack.value = '';
  filterHealth.value = '';
  renderGrid();
});

// ── Export ────────────────────────────────────────────────────────────────────
const sqlOutput = document.getElementById('sql-output');

function esc(v) { return String(v ?? '').replace(/'/g, "''"); }

function buildSQL(cards) {
  if (!cards.length) return '-- Inga kort att exportera.';

  const ids      = cards.map(c => `'${esc(c.id)}'`).join(', ');
  const range    = `card_id IN (${ids})`;
  const idRange  = `id IN (${ids})`;

  let sql = `PRAGMA foreign_keys = ON;\n\n`;
  sql += `DELETE FROM structure_cards WHERE ${range};\n`;
  sql += `DELETE FROM spell_cards     WHERE ${range};\n`;
  sql += `DELETE FROM minion_cards    WHERE ${range};\n`;
  sql += `DELETE FROM cards           WHERE ${idRange};\n\n`;

  sql += `INSERT INTO cards (\n    id, name, mana, card_class, card_type, description, artwork_path, rarity, keywords, draft_tag\n) VALUES\n`;
  sql += cards.map((c, i) => {
    const comma = i < cards.length - 1 ? ',' : ';';
    return `    ('${esc(c.id)}', '${esc(c.name)}', ${c.mana}, '${esc(c.card_class)}', '${esc(c.card_type)}', '${esc(c.description)}', '${esc(c.artwork_path)}', '${esc(c.rarity)}', '${esc(c.keywords)}', '${esc(c.draft_tag)}')${comma}`;
  }).join('\n');

  const minions    = cards.filter(c => c.card_type === 'minion');
  const spells     = cards.filter(c => c.card_type === 'spell');
  const structures = cards.filter(c => c.card_type === 'structure');

  if (minions.length) {
    sql += `\n\nINSERT INTO minion_cards (\n    card_id, attack, health, subtype, ability_id, ability_trigger, ability_cost, ability_target_mode, ability_targeting_mode, ability_value, ability_arg\n) VALUES\n`;
    sql += minions.map((c, i) => {
      const comma = i < minions.length - 1 ? ',' : ';';
      return `    ('${esc(c.id)}', ${c.attack}, ${c.health}, '${esc(c.subtype)}', '${esc(c.ability_id)}', '${esc(c.ability_trigger)}', ${c.ability_cost}, '${esc(c.ability_target_mode)}', '${esc(c.ability_targeting_mode)}', ${c.ability_value}, '${esc(c.ability_arg)}')${comma}`;
    }).join('\n');
  }

  if (spells.length) {
    sql += `\n\nINSERT INTO spell_cards (\n    card_id, effect_id, effect_value, target_mode, targeting_mode, school, effect_arg, repeat_count, repeat_mode\n) VALUES\n`;
    sql += spells.map((c, i) => {
      const comma = i < spells.length - 1 ? ',' : ';';
      return `    ('${esc(c.id)}', '${esc(c.effect_id)}', ${c.effect_value}, '${esc(c.target_mode)}', '${esc(c.targeting_mode)}', '${esc(c.school)}', '${esc(c.effect_arg)}', ${c.repeat_count}, '${esc(c.repeat_mode)}')${comma}`;
    }).join('\n');
  }

  if (structures.length) {
    sql += `\n\nINSERT INTO structure_cards (\n    card_id, armor, subtype, maintenance_cost, ability_id, ability_cost, ability_target_mode, ability_targeting_mode, ability_value, ability_arg, repair_cost, repair_value, trigger_id, trigger_value, trigger_target_mode\n) VALUES\n`;
    sql += structures.map((c, i) => {
      const comma = i < structures.length - 1 ? ',' : ';';
      return `    ('${esc(c.id)}', ${c.armor}, '${esc(c.subtype)}', ${c.maintenance_cost}, '${esc(c.ability_id)}', ${c.ability_cost}, '${esc(c.ability_target_mode)}', '${esc(c.ability_targeting_mode)}', ${c.ability_value}, '${esc(c.ability_arg)}', ${c.repair_cost}, ${c.repair_value}, '${esc(c.trigger_id)}', ${c.trigger_value}, '${esc(c.trigger_target_mode)}')${comma}`;
    }).join('\n');
  }

  return sql;
}

async function renderExport() {
  sqlOutput.textContent = '-- Laddar…';
  const cards = await loadCards();
  sqlOutput.textContent = buildSQL(cards);
}

document.getElementById('btn-copy-sql').addEventListener('click', () => {
  navigator.clipboard.writeText(sqlOutput.textContent).then(() => showToast('SQL kopierat!'));
});

document.getElementById('btn-download-sql').addEventListener('click', () => {
  const blob = new Blob([sqlOutput.textContent], { type: 'text/plain' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'cards_export.sql',
  });
  a.click();
  showToast('SQL nedladdat!');
});

document.getElementById('btn-export-json').addEventListener('click', async () => {
  const cards = await loadCards();
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'cards_export.json',
  });
  a.click();
  showToast('JSON nedladdat!');
});

// ── Rarity migration ─────────────────────────────────────────────────────────
const RARITY_MAP = { common: 'Basic', uncommon: 'Superior', rare: 'Supreme', epic: 'Supreme', legendary: 'Legendary' };

document.getElementById('btn-migrate-rarity').addEventListener('click', async () => {
  const btn    = document.getElementById('btn-migrate-rarity');
  const status = document.getElementById('migrate-status');
  btn.disabled = true;
  status.textContent = 'Kör…';

  const cards = await loadCards();
  const toMigrate = cards.filter(c => RARITY_MAP[c.rarity]);

  if (!toMigrate.length) {
    status.textContent = 'Inga kort behöver migreras.';
    btn.disabled = false;
    return;
  }

  let updated = 0;
  for (const card of toMigrate) {
    const { error } = await sb.from('cards').update({ rarity: RARITY_MAP[card.rarity] }).eq('id', card.id);
    if (!error) updated++;
  }

  status.textContent = `${updated} av ${toMigrate.length} kort uppdaterade.`;
  btn.disabled = false;
  showToast(`Migrering klar! ${updated} kort uppdaterade.`);
});

// ── Speldesign ────────────────────────────────────────────────────────────────
const CAT_LABELS = {
  keyword: 'Keywords', effect: 'Effects', ability: 'Abilities',
  rule: 'Regler', suggestion: 'Förslag', misc: 'Övrigt'
};
const CAT_ORDER = ['keyword', 'effect', 'ability', 'rule', 'suggestion', 'misc'];

let activeCat  = '';
let editingDoc = null;

const docList           = document.getElementById('doc-list');
const docEditorOverlay  = document.getElementById('doc-editor-overlay');
const docEditorTitle    = document.getElementById('doc-editor-title');
const docCategory       = document.getElementById('doc-category');
const docTitleEl        = document.getElementById('doc-title');
const docBodyEl         = document.getElementById('doc-body');
const docTagsEl         = document.getElementById('doc-tags');
const btnDocDelete      = document.getElementById('btn-doc-delete');
const docDetailOverlay  = document.getElementById('doc-detail-overlay');
const docDetailTitle    = document.getElementById('doc-detail-title');
const docDetailBadge    = document.getElementById('doc-detail-badge');
const docDetailBody     = document.getElementById('doc-detail-body');
const docDetailTags     = document.getElementById('doc-detail-tags');

async function loadDocs() {
  let q = sb.from('game_docs').select('*').order('category').order('title');
  if (activeCat) q = q.eq('category', activeCat);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data || [];
}

async function renderDocs() {
  docList.innerHTML = '<p style="color:var(--muted);padding:20px 0">Laddar…</p>';
  const docs = await loadDocs();
  if (!docs.length) {
    docList.innerHTML = '<p style="color:var(--muted);padding:20px 0">Inga poster hittades.</p>';
    return;
  }

  const groups = {};
  CAT_ORDER.forEach(c => groups[c] = []);
  docs.forEach(d => { if (groups[d.category]) groups[d.category].push(d); });

  docList.innerHTML = CAT_ORDER
    .filter(cat => groups[cat].length)
    .map(cat => `
      <div class="doc-group">
        <div class="doc-group-title">${CAT_LABELS[cat]}</div>
        ${groups[cat].map(d => `
          <div class="doc-card" data-id="${d.id}">
            <div class="doc-card-left">
              <div class="doc-card-title">${d.title}</div>
              <div class="doc-card-body">${d.body || '<em style="color:var(--muted)">Ingen beskrivning</em>'}</div>
              ${d.tags ? `<div class="doc-card-tags">${d.tags.split(',').map(t => `<span class="doc-tag">${t.trim()}</span>`).join('')}</div>` : ''}
            </div>
            <span class="doc-cat-badge cat-${d.category}">${CAT_LABELS[d.category]}</span>
          </div>`).join('')}
      </div>`).join('');

  docList.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', () => {
      const doc = docs.find(d => d.id == card.dataset.id);
      if (doc) openDocDetail(doc);
    });
  });
}

function openDocEditor(doc = null) {
  editingDoc = doc;
  docEditorTitle.textContent = doc ? 'Redigera post' : 'Ny post';
  docCategory.value  = doc?.category  || 'keyword';
  docTitleEl.value   = doc?.title     || '';
  docBodyEl.value    = doc?.body      || '';
  docTagsEl.value    = doc?.tags      || '';
  btnDocDelete.style.display = doc ? 'inline-block' : 'none';
  docEditorOverlay.classList.add('open');
}

function closeDocEditor() {
  docEditorOverlay.classList.remove('open');
  editingDoc = null;
}

let viewingDoc = null;

function openDocDetail(doc) {
  viewingDoc = doc;
  docDetailTitle.textContent = doc.title;
  docDetailBadge.textContent = CAT_LABELS[doc.category] || doc.category;
  docDetailBadge.className = `doc-cat-badge cat-${doc.category}`;
  docDetailBody.textContent = doc.body || '';
  docDetailTags.innerHTML = doc.tags
    ? doc.tags.split(',').map(t => `<span class="doc-tag">${t.trim()}</span>`).join('')
    : '';
  docDetailOverlay.classList.add('open');
}

function closeDocDetail() {
  docDetailOverlay.classList.remove('open');
  viewingDoc = null;
}

document.getElementById('btn-doc-detail-cancel').addEventListener('click', closeDocDetail);
document.getElementById('btn-doc-detail-close').addEventListener('click', closeDocDetail);
document.getElementById('btn-doc-detail-edit').addEventListener('click', () => {
  const doc = viewingDoc;
  closeDocDetail();
  openDocEditor(doc);
});
docDetailOverlay.addEventListener('click', e => { if (e.target === docDetailOverlay) closeDocDetail(); });

document.getElementById('btn-new-doc').addEventListener('click', () => openDocEditor());
document.getElementById('btn-doc-cancel').addEventListener('click', closeDocEditor);
document.getElementById('btn-doc-close').addEventListener('click', closeDocEditor);
docEditorOverlay.addEventListener('click', e => { if (e.target === docEditorOverlay) closeDocEditor(); });

document.getElementById('btn-doc-save').addEventListener('click', async () => {
  const payload = {
    category: docCategory.value,
    title:    docTitleEl.value.trim(),
    body:     docBodyEl.value.trim(),
    tags:     docTagsEl.value.trim(),
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) { showToast('Titel krävs.'); return; }

  if (editingDoc) {
    await sb.from('game_docs').update(payload).eq('id', editingDoc.id);
    showToast('Uppdaterat!');
  } else {
    await sb.from('game_docs').insert(payload);
    showToast('Sparat!');
  }
  closeDocEditor();
  renderDocs();
});

document.getElementById('btn-doc-delete').addEventListener('click', async () => {
  if (!editingDoc) return;
  await sb.from('game_docs').delete().eq('id', editingDoc.id);
  showToast('Borttaget.');
  closeDocEditor();
  renderDocs();
});

document.querySelectorAll('.doc-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.doc-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    renderDocs();
  });
});

// Seed om databasen är tom
async function seedDocsIfEmpty() {
  const { count } = await sb.from('game_docs').select('*', { count: 'exact', head: true });
  if (count > 0) return;

  const seed = [
    // Keywords
    { category:'keyword', title:'FLYING', body:'Minionen kan bara blockas av andra minions med FLYING eller REACH.\nFlyande minions kan attackera fritt förbi marktrupper.', tags:'combat,movement' },
    { category:'keyword', title:'RAPID', body:'Minionen går direkt till FRONT_LINE när den spelas, utan att behöva vänta en tur.\nNormalt startar minions i BACK_LINE och kan inte attackera förrän nästa tur.', tags:'combat,tempo' },
    { category:'keyword', title:'REACH', body:'Minionen kan blockera FLYING-minions trots att den inte flyger själv.\nBra defensivt verktyg mot flygande hot.', tags:'combat,defense' },
    { category:'keyword', title:'RANGE', body:'Minionen kan attackera utan att ta motskada vid direkt attack.\nFienden svarar inte med skada.', tags:'combat,offense' },
    { category:'keyword', title:'FIRST_STRIKE', body:'Minionen delar ut sin skada innan motståndaren i strid.\nOm motståndaren dör av first strike-skadan svarar den aldrig.', tags:'combat' },
    { category:'keyword', title:'DOUBLE_STRIKE', body:'Minionen attackerar två gånger per strid — först med first strike, sedan igen i normal stridsupplösning.', tags:'combat,offense' },
    { category:'keyword', title:'TWINSTRIKE', body:'Minionen slår två separata måltavlor i en och samma attack.', tags:'combat,offense' },
    { category:'keyword', title:'CANT_ATTACK', body:'Minionen kan inte deklarera attacker. Kan fortfarande blockera och använda aktiverade förmågor.', tags:'combat,restriction' },
    { category:'keyword', title:'PARRY', body:'Minionen reducerar inkommande skada med sitt PARRY-värde. Ex: PARRY_2 reducerar all inkommande skada med 2.', tags:'defense,combat' },
    { category:'keyword', title:'IRON_SKIN', body:'Minionen är immun mot skada under 1 (eller definierat värde). Svår att ta bort med pytteskador.', tags:'defense' },
    { category:'keyword', title:'TOXIC', body:'Varje poäng skada den här minionen delar ut dödar målet direkt, oavsett hur mycket HP målet har kvar.', tags:'combat,removal' },
    { category:'keyword', title:'VAMPIRISM', body:'Minionen återfår HP lika med den skada den delar ut. Lifesteal.', tags:'combat,sustain' },
    { category:'keyword', title:'INSTANT', body:'Spellen med INSTANT kan spelas utanför din tur, som en reaktion.', tags:'timing,spell' },

    // Effects
    { category:'effect', title:'deal_damage', body:'Delar ut X skada till ett mål.\nAnvänds av spells och minion-abilities.\neffect_value = mängd skada.\ntarget_mode avgör vad som kan träffas.', tags:'damage' },
    { category:'effect', title:'draw_card', body:'Drar X kort från ditt deck.\neffect_value = antal kort att dra.', tags:'card-draw' },
    { category:'effect', title:'heal', body:'Återställer X HP till ett mål.\neffect_value = mängd HP.\ntarget_mode avgör vad som kan läkas.', tags:'healing' },
    { category:'effect', title:'chain', body:'Upprepar effekten på ett nytt slumpmässigt mål efter att den första effekten löst sig.\nAntal kedjor styrs av repeat_count.', tags:'aoe,bounce' },

    // Abilities
    { category:'ability', title:'activate', body:'Triggern "activate" innebär att spelaren manuellt aktiverar förmågan under sin tur mot en kostnad (ability_cost mana).\nMinionen måste vara i FRONT_LINE eller BACK_LINE — den kan inte ha attackerat samma tur.', tags:'trigger,active' },
    { category:'ability', title:'on_play', body:'Förmågan triggar automatiskt när minionen spelas från handen.\nIngen extra kostnad — effekten sker direkt.', tags:'trigger,passive' },
    { category:'ability', title:'on_death', body:'Förmågan triggar när minionen dör.\nDeathrattle-effekter löser sig efter striden.', tags:'trigger,deathrattle' },
    { category:'ability', title:'on_attack', body:'Förmågan triggar varje gång minionen attackerar.', tags:'trigger,passive' },

    // Regler
    { category:'rule', title:'Zoner — FRONT_LINE & BACK_LINE', body:'Alla minions börjar i BACK_LINE när de spelas (om de inte har RAPID).\nFrån FRONT_LINE kan de attackera.\nFlytt sker automatiskt i slutet av ägarens tur.', tags:'zones,movement' },
    { category:'rule', title:'Faser per tur', body:'DRAW → MAIN → ATTACK → BLOCK → CLEANUP → END_TURN\n\nDRAW: Spelaren drar ett kort.\nMAIN: Spela kort, aktivera förmågor.\nATTACK: Deklarera attacker med FRONT_LINE-minions.\nBLOCK: Motspelaren tilldelar blockers.\nCLEANUP: Strid löses, döda minions tas bort.\nEND_TURN: Korteffekter med "efter tur"-villkor utlöses.', tags:'phases,turn' },
    { category:'rule', title:'Mana', body:'Varje spelare börjar med 1 mana och ökar med 1 per tur upp till max (10 eller konfigurerat).\nOanvänd mana försvinner i slutet av turen — den rullas inte över.', tags:'resources,mana' },
    { category:'rule', title:'Kortens UID-system', body:'Varje kortinstans får ett unikt runtime-ID (uid).\nSpelare 0 börjar på uid 1, spelare 1 börjar på 1 000 000.\nDetta förhindrar kollisioner mellan spelares kort.', tags:'technical,uid' },
    { category:'rule', title:'Blockfönster', body:'Efter att attackeraren deklarerats öppnar servern ett blockfönster.\nMotspelaren har BLOCK_TIME sekunder på sig att sätta blockers.\nOm ingen blockar går attacken igenom direkt mot hjälten.', tags:'combat,timing' },

    // Förslag
    { category:'suggestion', title:'Mall för nya förslag', body:'Använd den här posten som mall.\nBeskriv:\n1. Problemet / idén\n2. Föreslaget beteende\n3. Eventuella undantag eller interaktioner\n4. Prioritet (låg/medium/hög)', tags:'meta' },
  ];

  await sb.from('game_docs').insert(seed);
}

// Kör seed och rendera när sidan visas
const origShowPage = showPage;

// ── Mallar ────────────────────────────────────────────────────────────────────
let activeTplType  = '';
let editingTpl     = null;

const tplGrid          = document.getElementById('tpl-grid');
const tplEditorOverlay = document.getElementById('tpl-editor-overlay');

async function loadTemplates() {
  let q = sb.from('card_templates').select('*').order('is_builtin', { ascending: false }).order('created_at');
  if (activeTplType) q = q.eq('card_type', activeTplType);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data || [];
}

function renderTplCard(tpl) {
  const data  = tpl.card_data  || {};
  const notes = tpl.field_notes || {};

  const rows = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `
      <tr>
        <td class="tpl-field-key">${k}</td>
        <td class="tpl-field-val"><code>${String(v).replace(/</g,'&lt;')}</code></td>
        <td class="tpl-field-note">${notes[k] ? String(notes[k]).replace(/</g,'&lt;') : ''}</td>
      </tr>`).join('');

  const badgeCls = `tpl-badge-${tpl.card_type}`;

  return `
    <div class="tpl-card" data-tpl-id="${tpl.id}">
      <div class="tpl-card-header">
        <div>
          <div class="tpl-card-title">${tpl.name}</div>
          ${tpl.description ? `<div class="tpl-card-desc">${tpl.description}</div>` : ''}
        </div>
        <span class="tpl-type-badge ${badgeCls}">${tpl.card_type}</span>
      </div>
      ${rows ? `
        <div class="tpl-field-guide">
          <table class="tpl-field-table">
            <thead><tr><th>Fält</th><th>Värde</th><th>Förklaring</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : ''}
      <div class="tpl-card-footer">
        ${tpl.is_builtin
          ? '<span class="tpl-builtin-label">Inbyggd mall</span>'
          : `<button class="btn btn-secondary tpl-edit-btn" data-tpl-id="${tpl.id}">Redigera</button>`}
        <button class="btn btn-primary tpl-use-btn" data-tpl-id="${tpl.id}" style="margin-left:auto">Använd mall →</button>
      </div>
    </div>`;
}

async function renderTplGrid() {
  tplGrid.innerHTML = '<p style="color:var(--muted);padding:20px 0">Laddar…</p>';
  const tpls = await loadTemplates();
  if (!tpls.length) {
    tplGrid.innerHTML = '<p style="color:var(--muted);padding:20px 0">Inga mallar hittades.</p>';
    return;
  }
  tplGrid.innerHTML = tpls.map(renderTplCard).join('');

  tplGrid.querySelectorAll('.tpl-use-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tpl = tpls.find(t => String(t.id) === btn.dataset.tplId);
      if (tpl) await applyTemplate(tpl);
    });
  });

  tplGrid.querySelectorAll('.tpl-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = tpls.find(t => String(t.id) === btn.dataset.tplId);
      if (tpl) openTplEditor(tpl);
    });
  });
}

async function applyTemplate(tpl) {
  await resetForm();
  const data = tpl.card_data || {};

  const type = data.card_type || tpl.card_type;
  setFieldVal('card_type', type);
  updateTypeSections();

  Object.entries(data).forEach(([k, v]) => {
    if (k === 'keywords') {
      resetKeywords();
      if (v) {
        v.split(',').map(kw => kw.trim()).forEach(kw => {
          const tag = kwPicker.querySelector(`[data-kw="${kw}"]`);
          if (tag) tag.classList.add('active');
        });
        kwHidden.value = v;
      }
    } else {
      setFieldVal(k, v);
    }
  });

  setFieldVal('card_type', type);
  updateTypeSections();
  showPage('page-add');
  showToast(`Mall "${tpl.name}" applicerad!`);
}

function openTplEditor(tpl = null) {
  editingTpl = tpl;
  document.getElementById('tpl-editor-title').textContent = tpl ? 'Redigera mall' : 'Ny mall';
  document.getElementById('tpl-card-type').value    = tpl?.card_type    || 'minion';
  document.getElementById('tpl-name').value         = tpl?.name         || '';
  document.getElementById('tpl-description').value  = tpl?.description  || '';
  document.getElementById('tpl-card-data').value    = tpl?.card_data    ? JSON.stringify(tpl.card_data,  null, 2) : '';
  document.getElementById('tpl-field-notes').value  = tpl?.field_notes  ? JSON.stringify(tpl.field_notes, null, 2) : '';
  document.getElementById('btn-tpl-delete').style.display = tpl && !tpl.is_builtin ? 'inline-block' : 'none';
  document.getElementById('tpl-json-error').style.display = 'none';
  tplEditorOverlay.classList.add('open');
}

function closeTplEditor() {
  tplEditorOverlay.classList.remove('open');
  editingTpl = null;
}

document.getElementById('btn-new-tpl').addEventListener('click', () => openTplEditor());
document.getElementById('btn-tpl-cancel').addEventListener('click', closeTplEditor);
document.getElementById('btn-tpl-close').addEventListener('click', closeTplEditor);
tplEditorOverlay.addEventListener('click', e => { if (e.target === tplEditorOverlay) closeTplEditor(); });

document.getElementById('btn-tpl-save').addEventListener('click', async () => {
  const errEl = document.getElementById('tpl-json-error');
  errEl.style.display = 'none';

  const name = document.getElementById('tpl-name').value.trim();
  if (!name) { showToast('Mallnamn krävs.'); return; }

  let card_data = {}, field_notes = {};
  try {
    const rawData = document.getElementById('tpl-card-data').value.trim();
    if (rawData) card_data = JSON.parse(rawData);
  } catch (e) {
    errEl.textContent = 'Ogiltig JSON i Kortdata: ' + e.message;
    errEl.style.display = 'block';
    return;
  }
  try {
    const rawNotes = document.getElementById('tpl-field-notes').value.trim();
    if (rawNotes) field_notes = JSON.parse(rawNotes);
  } catch (e) {
    errEl.textContent = 'Ogiltig JSON i Fältnoter: ' + e.message;
    errEl.style.display = 'block';
    return;
  }

  const payload = {
    name,
    description: document.getElementById('tpl-description').value.trim(),
    card_type:   document.getElementById('tpl-card-type').value,
    card_data,
    field_notes,
    is_builtin:  false,
  };

  if (editingTpl) {
    await sb.from('card_templates').update(payload).eq('id', editingTpl.id);
    showToast('Mall uppdaterad!');
  } else {
    await sb.from('card_templates').insert(payload);
    showToast('Mall sparad!');
  }
  closeTplEditor();
  renderTplGrid();
});

document.getElementById('btn-tpl-delete').addEventListener('click', async () => {
  if (!editingTpl || editingTpl.is_builtin) return;
  await sb.from('card_templates').delete().eq('id', editingTpl.id);
  showToast('Mall borttagen.');
  closeTplEditor();
  renderTplGrid();
});

// Tabb-logik för Mallar/Regelguide
document.querySelectorAll('.tpl-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tpl-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tpl-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tpl-tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.querySelectorAll('.tpl-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tpl-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTplType = btn.dataset.type;
    renderTplGrid();
  });
});

async function seedTemplatesIfEmpty() {
  const { count } = await sb.from('card_templates').select('*', { count: 'exact', head: true });
  if (count > 0) return;

  const seed = [
    // ── MINIONS ──────────────────────────────────────────────────────────
    {
      name: 'Enkel Minion — 2/2 utan förmåga',
      description: 'Den enklaste möjliga minionen. Bra startpunkt. Byt stats och klass efter behov.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:2, card_class:'Neutral', rarity:'common',
        description:'',
        attack:2, health:2, subtype:'',
      },
      field_notes: {
        mana: 'Kostnaden för att spela kortet. Tumregel: en "rättvis" 2/2 kostar 2 mana.',
        card_class: 'Neutral = alla klasser kan spela den. Dark, Wasteland, The Blue, Forest = klassspecifik.',
        rarity: 'common = dyker upp ofta i draft. legendary = max 1 kopia, designas som unika gamechangers.',
        attack: 'Skada minionen gör varje attack. 0 = kan inte anfalla effektivt.',
        health: 'HP-poäng. Minst 1. Noll = dör.',
        subtype: 'Undertyp visas under kortnamnet, t.ex. "Beast" eller "Undead". Lämna tomt om ingen.',
      },
    },
    {
      name: 'Minion med FLYING',
      description: 'Flying-minion som bara kan blockas av andra FLYING eller REACH. Bra aggro-hottar.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:2, card_class:'Dark', rarity:'common',
        description:'Flying.',
        keywords:'FLYING',
        attack:2, health:1, subtype:'Beast',
      },
      field_notes: {
        keywords: 'FLYING = kan bara blockas av FLYING eller REACH. Skriv alltid VERSALER. Flera keywords: "FLYING, RAPID".',
        description: 'Kortets regeltext. Skriv ut keywords här med stor bokstav för tydlighet: "Flying."',
        attack: '2 attack med 1 health = fragil men hotfull. Svårt att blocka utan FLYING/REACH.',
        subtype: 'Beast = tematisk för flygande djur. Kan ge synergier med beastsynergikort.',
      },
    },
    {
      name: 'Minion med RAPID (anfaller direkt)',
      description: 'Kan anfalla omedelbart när den spelas — går direkt till FRONT_LINE utan att vänta en tur.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Wasteland', rarity:'uncommon',
        description:'Rapid.',
        keywords:'RAPID',
        attack:3, health:2, subtype:'',
      },
      field_notes: {
        keywords: 'RAPID = ingen "summoning sickness". Anfaller direkt på den tur den spelas.',
        mana: '3 mana för en 3/2 med RAPID är balanserat — tempovärdet är högt.',
        attack: '3 attack = kan döda de flesta 2-mana-minions direkt. Bra för att ta board control.',
      },
    },
    {
      name: 'Tank-minion (hög health, låg attack)',
      description: 'Defensiv minion som är svår att ta bort. Blockerar hot och absorberar skada.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Forest', rarity:'common',
        description:'',
        attack:1, health:6, subtype:'',
      },
      field_notes: {
        attack: '1 attack = minimal offensiv kraft. Designad för att blocka, inte anfalla.',
        health: '6 health för 3 mana = extremt defensivt. Kostar fienden mycket resurser att ta bort.',
        mana: '3 mana 1/6 är en klassisk "wall"-minion. Bra i defensiva decks.',
      },
    },
    {
      name: 'Activate — Gör 3 skada (Soul Weaver)',
      description: 'Aktiverbar förmåga: Spelaren klickar manuellt och betalar 1 mana för att göra 2 skada mot valfritt mål.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:4, card_class:'Dark', rarity:'rare',
        description:'Activate (1): Deal 2 damage to any target.',
        keywords:'VAMPIRISM',
        attack:3, health:4, subtype:'Specter',
        ability_id:'deal_damage', ability_trigger:'activate',
        ability_cost:1, ability_target_mode:'any_target',
        ability_targeting_mode:'explicit', ability_value:2,
      },
      field_notes: {
        ability_trigger: 'activate = spelaren klickar manuellt och betalar kostnaden. Kan bara aktiveras en gång per tur och INTE samma tur minionen anföll.',
        ability_cost: '1 = kostar 1 mana ATT AKTIVERA, utöver kortets spelkostnad på 4. Totalt: 4 mana att spela + 1 mana att aktivera.',
        ability_id: 'deal_damage = gör X skada mot ett mål.',
        ability_value: '2 = skadan som görs. Öka för kraftigare förmåga (och höj mana/cost).',
        ability_target_mode: 'any_target = spelaren väljer minion ELLER hjälte fritt.',
        ability_targeting_mode: 'explicit = spelaren klickar manuellt på målet.',
        keywords: 'VAMPIRISM = läker ägaren med lika mycket skada som minionen gör. Kombineras fint med activate.',
      },
    },
    {
      name: 'Activate — Läk hjälten (Discard-kostnad)',
      description: 'Aktiveras genom att kasta ett kort istället för mana. Kraftfull men riskabel.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Dark', rarity:'uncommon',
        description:'Activate (discard 1): Restore 4 health to your hero.',
        attack:2, health:4, subtype:'Shaman',
        ability_id:'heal', ability_trigger:'activate',
        ability_cost:0, ability_target_mode:'friendly_hero',
        ability_targeting_mode:'auto', ability_value:4,
        ability_arg:'cost:discard:1',
      },
      field_notes: {
        ability_arg: 'cost:discard:1 = spelaren måste kasta 1 kort (väljer själv vilket) för att aktivera. Sätt ability_cost till 0 när du använder discard-kostnad.',
        ability_cost: '0 = ingen manakostnad. Kostnaden är istället ability_arg (discard 1).',
        ability_id: 'heal = återställer X HP till ett mål.',
        ability_value: '4 = mängden HP som läks.',
        ability_target_mode: 'friendly_hero = läker bara din hjälte.',
        ability_targeting_mode: 'auto = inget manuellt val behövs. Läker automatiskt rätt mål.',
      },
    },
    {
      name: 'Activate — Dra ett kort',
      description: 'Betala 1 mana för att dra ett kort. Ger kortdragning på en stabil minion.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'The Blue', rarity:'uncommon',
        description:'Activate (1): Draw a card.',
        attack:1, health:3, subtype:'Scholar',
        ability_id:'draw_card', ability_trigger:'activate',
        ability_cost:1, ability_target_mode:'self',
        ability_targeting_mode:'auto', ability_value:1,
      },
      field_notes: {
        ability_id: 'draw_card = drar X kort från ditt deck till handen.',
        ability_value: '1 = dra ett kort. Sätt till 2 för dubbeldragning (höj cost).',
        ability_target_mode: 'self = kortet drar till ägaren. Inget målval visas.',
        ability_targeting_mode: 'auto = ingen dialog. Drar direkt.',
        ability_cost: '1 = betala 1 mana extra per dragning. Balanserat.',
      },
    },
    {
      name: 'On_play — Slumpmässig skada (Battlecry)',
      description: 'Triggar automatiskt vid inläggning och gör 2 skada mot en slumpmässig fiendes minion.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Wasteland', rarity:'uncommon',
        description:'Battlecry: Deal 2 damage to a random enemy minion.',
        attack:2, health:3,
        ability_id:'deal_damage', ability_trigger:'on_play',
        ability_cost:0, ability_target_mode:'enemy_minion',
        ability_targeting_mode:'random', ability_value:2,
      },
      field_notes: {
        ability_trigger: 'on_play = triggar direkt när kortet spelas. Inga extra kostnader — effekten ingår i grundkostnaden.',
        ability_targeting_mode: 'random = servern väljer ett slumpmässigt giltigt mål automatiskt. Spelaren klickar ingenting.',
        ability_target_mode: 'enemy_minion = bara fiendens minions är giltiga mål. Hjältar träffas inte.',
        ability_value: '2 = skada. Lagom mot 2-mana-minions. 3 dödar de flesta 3-hälsa-minions.',
      },
    },
    {
      name: 'On_death — Dra ett kort (Deathrattle)',
      description: 'Deathrattle: kortet drar ett kort när minionen dör. Belönar fienden för att ta bort den.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Wasteland', rarity:'rare',
        description:'Deathrattle: Draw a card.',
        attack:2, health:2, subtype:'Specter',
        ability_id:'draw_card', ability_trigger:'on_death',
        ability_cost:0, ability_targeting_mode:'auto', ability_value:1,
      },
      field_notes: {
        ability_trigger: 'on_death = triggar när minionen dör. Löser sig efter stridsupplösning — minionen är redan borta.',
        ability_id: 'draw_card = drar kort till ägarens hand.',
        ability_value: '1 = ett kort. Sätt 2 för kraftig deathrattle (höj manakostnad).',
        ability_targeting_mode: 'auto = inget val. Kortet dras direkt.',
        mana: '3 mana 2/2 med deathrattle är fair — effekten kompenserar de svaga statsarna.',
      },
    },
    {
      name: 'On_attack — Vampirism-trigger',
      description: 'Varje gång minionen anfaller triggar förmågan. Här: läker ägaren för 1 per attack.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:3, card_class:'Dark', rarity:'rare',
        description:'On Attack: Restore 1 health to your hero.',
        attack:3, health:3,
        ability_id:'heal', ability_trigger:'on_attack',
        ability_cost:0, ability_target_mode:'friendly_hero',
        ability_targeting_mode:'auto', ability_value:1,
      },
      field_notes: {
        ability_trigger: 'on_attack = triggar VARJE GÅNG minionen anfaller — inte bara en gång. Kan stapla upp läkning.',
        ability_id: 'heal = läker målet.',
        ability_value: '1 = läker 1 HP per attack. Litet men konstant. Öka för starkare effekt.',
        ability_target_mode: 'friendly_hero = läker din hjälte varje gång minionen anfaller.',
      },
    },
    {
      name: 'TOXIC + FIRST_STRIKE (enkel removal)',
      description: 'TOXIC dödar allt den skadar. FIRST_STRIKE slår innan motståndaren. Dödlig kombination.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:4, card_class:'Dark', rarity:'rare',
        description:'First Strike. Toxic.',
        keywords:'FIRST_STRIKE, TOXIC',
        attack:1, health:3, subtype:'Demon',
      },
      field_notes: {
        keywords: 'FIRST_STRIKE + TOXIC = slår sin 1-skada INNAN motståndaren och dödar den direkt oavsett health. Extremt effektiv removal.',
        attack: '1 attack räcker med TOXIC — varje poäng skada dödar. Håll attack låg och kompensera med health.',
        health: '3 health = överlever de flesta 2-mana-minions utan TOXIC/FIRST_STRIKE.',
        mana: '4 mana för dessa keywords är rätt balanserat — effekterna är starka.',
      },
    },
    {
      name: 'CANT_ATTACK + hög health (Pure Tank)',
      description: 'Kan aldrig anfalla men absorberar enormt mycket skada. Köper tid för din strategi.',
      card_type: 'minion', is_builtin: true,
      card_data: {
        mana:2, card_class:'Forest', rarity:'common',
        description:'Can\'t Attack.',
        keywords:'CANT_ATTACK',
        attack:0, health:8, subtype:'',
      },
      field_notes: {
        keywords: 'CANT_ATTACK = minionen kan ALDRIG deklarera attacker. Kan fortfarande blockera och använda activate-förmågor.',
        health: '8 health för 2 mana är extremt. Balansen = noll offensiv kraft. Bra för time-stalling.',
        attack: '0 attack = meningslöst att anfalla med. Håll alltid på 0 för CANT_ATTACK-minions.',
      },
    },

    // ── SPELLS ──────────────────────────────────────────────────────────
    {
      name: 'Enkel skadespell — 3 skada',
      description: 'Grundläggande skadespell. Spelaren väljer målet. Kan träffa minion eller hjälte.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:2, card_class:'Dark', rarity:'common',
        description:'Deal 3 damage to any target.',
        effect_id:'deal_damage', effect_value:3,
        target_mode:'any_target', targeting_mode:'explicit',
        school:'Shadow', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        effect_id: 'deal_damage = gör X skada.',
        effect_value: '3 = mängden skada. Tumregel: 3 för 2 mana, 4–5 för 3 mana, 6–7 för 4 mana.',
        target_mode: 'any_target = spelaren väljer minion eller hjälte fritt. Mest flexibelt.',
        targeting_mode: 'explicit = spelaren klickar på målet. Alltid explicit när spelaren ska välja.',
        school: 'Shadow = magiskola för flavortext. Påverkar inte gameplay direkt.',
        repeat_count: '1 = träffar en gång. Öka för multi-hit (kombinera med repeat_mode).',
      },
    },
    {
      name: 'Riktat mot minion — inte hjälte',
      description: 'Removal-spell som bara kan träffa minions. Bra för board clear utan face-skada.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:2, card_class:'Forest', rarity:'common',
        description:'Deal 4 damage to a minion.',
        effect_id:'deal_damage', effect_value:4,
        target_mode:'target_minion', targeting_mode:'explicit',
        school:'Nature', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        target_mode: 'target_minion = kan bara träffa minions (vän eller fiende), INTE hjältar. Bra removal.',
        effect_value: '4 skada för 2 mana när det bara kan träffa minions — mer värde per mana.',
        targeting_mode: 'explicit = spelaren klickar på vilken minion de vill ta bort.',
      },
    },
    {
      name: 'Slumpmässig fiendes minion',
      description: 'Träffar en slumpmässig fiendes minion automatiskt. Spelaren väljer inget mål.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:1, card_class:'Wasteland', rarity:'common',
        description:'Deal 2 damage to a random enemy minion.',
        effect_id:'deal_damage', effect_value:2,
        target_mode:'enemy_minion', targeting_mode:'random',
        school:'Dark', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        targeting_mode: 'random = servern slumpar ett mål automatiskt. Spelaren klickar ingenting.',
        target_mode: 'enemy_minion = slumpar BARA bland fiendens minions. Hjälten är aldrig mål.',
        mana: '1 mana för 2 slumpmässig skada = hög effektivitet men osäkert mål.',
      },
    },
    {
      name: 'AOE-spell — träffar 4 minions',
      description: 'Gör 1 skada mot 4 slumpmässiga fiendes minions (kan träffa samma igen). Bra mot wide boards.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:3, card_class:'The Blue', rarity:'uncommon',
        description:'Deal 1 damage to 4 random enemy minions.',
        effect_id:'deal_damage', effect_value:1,
        target_mode:'enemy_minion', targeting_mode:'random',
        school:'Storm', repeat_count:4, repeat_mode:'reroll_each_time',
      },
      field_notes: {
        repeat_count: '4 = träffar 4 gånger. Totalt 4 skada fördelat på 1–4 minions.',
        repeat_mode: 'reroll_each_time = nytt slumpmål för varje träff. En minion kan träffas flera gånger om det inte finns 4 stycken.',
        targeting_mode: 'random + reroll = klassisk AOE-spell. Ingen spelarkontroll på fördelning.',
        effect_value: '1 per träff. Dödar tokens och svaga minions. Öka för hårdare AOE (och höj mana).',
      },
    },
    {
      name: 'Kedjebolt — studsar 2 gånger (Chain Lightning)',
      description: 'Spelaren väljer originalmålet. Blixtbulten studsar sedan till 2 slumpmässiga extra mål.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:3, card_class:'The Blue', rarity:'rare',
        description:'Deal 2 damage. Bounces to 2 additional random targets.',
        effect_id:'chain', effect_value:2,
        target_mode:'any_target', targeting_mode:'explicit',
        school:'Storm', repeat_count:2, repeat_mode:'reroll_each_time',
      },
      field_notes: {
        effect_id: 'chain = effekten studsar till extra mål efter originalet.',
        repeat_count: '2 = studsar till 2 EXTRA mål. Totalt 3 träffar (1 original + 2 studsar).',
        repeat_mode: 'reroll_each_time = nytt slumpmål per studs. Kan träffa vänner eller fiender beroende på target_mode.',
        targeting_mode: 'explicit = spelaren väljer originalmålet. Studsarna är alltid slumpmässiga.',
        effect_value: '2 per träff inklusive studsar.',
      },
    },
    {
      name: 'Läkespell — återställ 5 HP',
      description: 'Läker ägarens hjälte för 5 HP. Enkel och pålitlig defensiv stavning.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:2, card_class:'Forest', rarity:'common',
        description:'Restore 5 health to your hero.',
        effect_id:'heal', effect_value:5,
        target_mode:'friendly_hero', targeting_mode:'auto',
        school:'Blood', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        effect_id: 'heal = återställer X HP till målet.',
        effect_value: '5 = mängden HP som läks. Mer än kortets manakostnad = bra deal.',
        target_mode: 'friendly_hero = läker bara din hjälte. Fienden kan inte väljas.',
        targeting_mode: 'auto = ingen dialog visas. Läker direkt vid cast.',
      },
    },
    {
      name: 'Läkespell — valfritt mål',
      description: 'Läker valfri minion eller hjälte. Spelaren väljer vad som ska läkas.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:2, card_class:'Forest', rarity:'common',
        description:'Restore 4 health to any target.',
        effect_id:'heal', effect_value:4,
        target_mode:'any_target', targeting_mode:'explicit',
        school:'Nature', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        target_mode: 'any_target = spelaren väljer vad som läks — hjälte, vänlig minion eller fiendens minion.',
        targeting_mode: 'explicit = spelaren klickar på målet.',
        effect_value: '4 = lagom för att hålla en tuff minion i livet.',
      },
    },
    {
      name: 'Kortdragning — dra 2 kort',
      description: 'Drar 2 kort direkt utan målval. Enkel och stark kortdragning.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:3, card_class:'The Blue', rarity:'uncommon',
        description:'Draw 2 cards.',
        effect_id:'draw_card', effect_value:2,
        target_mode:'self', targeting_mode:'auto',
        school:'Void', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        effect_id: 'draw_card = drar X kort till ägarens hand.',
        effect_value: '2 = dra 2 kort. Standard draw-spell.',
        target_mode: 'self = "målet" är spelaren själv. Inget val visas.',
        targeting_mode: 'auto = drar direkt utan klick.',
        school: 'Void = tematisk skola för mystisk/mörk magi.',
      },
    },
    {
      name: 'INSTANT-spell — spelas som reaktion',
      description: 'Kan spelas under blockfönstret (fiendens tur). Bra motåtgärd mot aggro.',
      card_type: 'spell', is_builtin: true,
      card_data: {
        mana:1, card_class:'The Blue', rarity:'uncommon',
        description:'Instant. Deal 2 damage to any target.',
        keywords:'INSTANT',
        effect_id:'deal_damage', effect_value:2,
        target_mode:'any_target', targeting_mode:'explicit',
        school:'Storm', repeat_count:1, repeat_mode:'same_target',
      },
      field_notes: {
        keywords: 'INSTANT = kan spelas UTANFÖR din tur, under blockfönstret. Enda keyword som gäller stavningar.',
        mana: '1 mana INSTANT är mycket starkt — kan döda en anfallande minion mitt i en attack.',
        effect_value: '2 skada för 1 mana är rättvist som INSTANT-kostnad.',
      },
    },

    // ── STRUCTURES ──────────────────────────────────────────────────────
    {
      name: 'Torn — skjuter varje tur (Tower)',
      description: 'Skjuter automatiskt 1 skada mot fiendens hjälte i slutet av varje dragskede. Klassiskt torn.',
      card_type: 'structure', is_builtin: true,
      card_data: {
        mana:3, card_class:'Dark', rarity:'uncommon',
        description:'At the start of your turn: deal 1 damage to the enemy hero.',
        armor:5, s_subtype:'Tower', maintenance_cost:1,
        repair_cost:1, repair_value:2,
        trigger_id:'deal_damage', trigger_value:1, trigger_target_mode:'enemy_hero',
      },
      field_notes: {
        armor: '5 armor = strukturens HP. Fienden måste lägga ned 5 skada för att förstöra tornet.',
        s_subtype: 'Tower = undertypens namn. Visas som "Structure — Tower" på kortet.',
        maintenance_cost: '1 = betala 1 mana per tur för att hålla tornet aktivt. 0 = gratis.',
        trigger_id: 'deal_damage = triggar automatiskt och gör X skada.',
        trigger_value: '1 = 1 skada per tur. Staplar upp — om fienden inte tar bort tornet förlorar de HP kontinuerligt.',
        trigger_target_mode: 'enemy_hero = tornet skjuter direkt på fiendens hjälte varje tur.',
        repair_cost: '1 mana för att reparera manuellt.',
        repair_value: '2 armor återfås per reparation.',
      },
    },
    {
      name: 'Verkstad med Activate (Workshop)',
      description: 'Kan aktiveras för att dra ett kort. Ger kontinuerlig kortdragning om den överlever.',
      card_type: 'structure', is_builtin: true,
      card_data: {
        mana:4, card_class:'The Blue', rarity:'rare',
        description:'Activate (2): Draw a card.',
        armor:6, s_subtype:'Workshop', maintenance_cost:2,
        s_ability_id:'draw_card', s_ability_cost:2,
        s_ability_target_mode:'self', s_ability_targeting_mode:'auto', s_ability_value:1,
        repair_cost:2, repair_value:3,
      },
      field_notes: {
        armor: '6 armor = robust. Svår att ta bort snabbt.',
        maintenance_cost: '2 = betala 2 mana per tur. Dyr underhållskostnad men stark effekt.',
        s_ability_id: 'draw_card = drar kort. Fälten för strukturens förmåga börjar med s_ för att skilja från trigger.',
        s_ability_cost: '2 = kosta 2 mana ATT AKTIVERA (utöver maintenance). Totalkostnad per tur: 2 maintenance + 2 activate = 4.',
        s_ability_target_mode: 'self = drar till ägaren. Inget mål väljs.',
        s_ability_targeting_mode: 'auto = inget klick. Drar direkt.',
        repair_cost: '2 mana för reparation.',
        repair_value: '3 armor per reparation.',
      },
    },
    {
      name: 'Totem — läker slumpmässig vänlig minion',
      description: 'Passiv trigger som läker en slumpmässig vänlig minion i slutet av varje tur.',
      card_type: 'structure', is_builtin: true,
      card_data: {
        mana:3, card_class:'Forest', rarity:'uncommon',
        description:'At end of turn: restore 1 health to a random friendly minion.',
        armor:4, s_subtype:'Totem', maintenance_cost:0,
        repair_cost:2, repair_value:2,
        trigger_id:'heal', trigger_value:1, trigger_target_mode:'friendly_minion',
      },
      field_notes: {
        s_subtype: 'Totem = undertypens namn.',
        maintenance_cost: '0 = gratis att hålla aktiv. Inget att betala per tur.',
        trigger_id: 'heal = läker ett mål varje gång triggern utlöses.',
        trigger_value: '1 HP per tur. Litet men konstant — håller minions vid liv längre.',
        trigger_target_mode: 'friendly_minion = läker en av dina egna minions, slumpmässigt vald.',
      },
    },
    {
      name: 'Fortification — skada mot fiendes minions',
      description: 'Trigger som gör 1 slumpmässig skada mot fiendes minions varje tur. Board control utan attack.',
      card_type: 'structure', is_builtin: true,
      card_data: {
        mana:4, card_class:'Wasteland', rarity:'rare',
        description:'At end of turn: deal 1 damage to a random enemy minion.',
        armor:5, s_subtype:'Fortification', maintenance_cost:1,
        repair_cost:2, repair_value:2,
        trigger_id:'deal_damage', trigger_value:1, trigger_target_mode:'enemy_minion',
      },
      field_notes: {
        trigger_target_mode: 'enemy_minion = skjuter mot fiendens minions, INTE hjälten. Jämför med Tower som skjuter mot enemy_hero.',
        trigger_value: '1 skada per tur. Dödar svaga tokens och pressar fienden att ta bort strukturen.',
        maintenance_cost: '1 mana per tur. Bör placeras tidigt så den ger värde under många turer.',
      },
    },
  ];

  await sb.from('card_templates').insert(seed);
}

document.querySelector('nav button[data-page="page-templates"]').addEventListener('click', async () => {
  await seedTemplatesIfEmpty();
  renderTplGrid();
});

// ── Skills ────────────────────────────────────────────────────────────────────
const skillForm            = document.getElementById('skill-form');
const skillArtworkInput    = document.getElementById('skill-artwork-input');
const skillArtworkPreview  = document.getElementById('skill-artwork-preview');
const skillArtworkFilename = document.getElementById('skill-artwork-filename');
const skillNameEl          = document.getElementById('skill-name');
const skillDescEl          = document.getElementById('skill-description');
const skillCountEl         = document.getElementById('skill-count');
const skillsGrid           = document.getElementById('skills-grid');

let selectedSkillImageFile = null;

skillArtworkPreview.addEventListener('click', () => skillArtworkInput.click());
skillArtworkInput.addEventListener('change', () => {
  const file = skillArtworkInput.files[0];
  if (!file) return;
  selectedSkillImageFile = file;
  skillArtworkFilename.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => { skillArtworkPreview.innerHTML = `<img src="${e.target.result}" alt="preview">`; };
  reader.readAsDataURL(file);
});

function resetSkillForm() {
  skillForm.reset();
  selectedSkillImageFile = null;
  skillArtworkPreview.innerHTML = '🖼';
  skillArtworkFilename.textContent = '';
  skillNameEl.value = '';
  skillDescEl.value = '';
}

document.getElementById('btn-skill-reset').addEventListener('click', resetSkillForm);

async function loadSkills() {
  const { data, error } = await sb.from('skills').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveSkill(name, imagePath, description) {
  const { error } = await sb.from('skills').insert({ name, image_path: imagePath, description });
  if (error) { showToast('Fel: ' + error.message); return false; }
  return true;
}

async function deleteSkill(id) {
  const { error } = await sb.from('skills').delete().eq('id', id);
  if (error) { showToast('Fel: ' + error.message); return false; }
  return true;
}

async function renderSkillsGrid() {
  const skills = await loadSkills();
  skillCountEl.textContent = `${skills.length} skill${skills.length !== 1 ? 's' : ''}`;

  if (!skills.length) {
    skillsGrid.innerHTML = '<div class="empty-state">🎯<p>Inga skills ännu.</p></div>';
    return;
  }

  skillsGrid.innerHTML = skills.map(s => {
    const imgSrc = s.image_path ? imgUrl(s.image_path) : null;
    const imgContent = imgSrc
      ? `<img src="${imgSrc}" alt="skill">`
      : `<div class="no-img" style="font-size:32px">🎯</div>`;
    return `
      <div class="skill-tile" data-skill-id="${s.id}">
        <button class="tile-del skill-del-btn" data-skill-del="${s.id}">✕</button>
        <div class="skill-tile-img">${imgContent}</div>
        <div class="skill-tile-desc">${s.name || '<em style="color:var(--muted)">Ingen titel</em>'}</div>
      </div>`;
  }).join('');

  skillsGrid.querySelectorAll('.skill-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const skill = skills.find(s => s.id === btn.dataset.skillDel);
      confirmDeleteSkill(btn.dataset.skillDel, skill?.name || skill?.description || '');
    });
  });

  skillsGrid.querySelectorAll('.skill-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const skill = skills.find(s => s.id === tile.dataset.skillId);
      if (skill) openSkillDetail(skill);
    });
  });
}

// ── Skill detail modal ────────────────────────────────────────────────────────
const skillDetailModal  = document.getElementById('skill-detail-modal');
const skillDetailImages = document.getElementById('skill-detail-images');
const skillDetailName   = document.getElementById('skill-detail-name');
const skillDetailDesc   = document.getElementById('skill-detail-desc');

document.getElementById('btn-skill-detail-close').addEventListener('click', () => skillDetailModal.classList.remove('open'));
skillDetailModal.addEventListener('click', e => { if (e.target === skillDetailModal) skillDetailModal.classList.remove('open'); });

function openSkillDetail(skill) {
  skillDetailImages.innerHTML = skill.image_path
    ? `<img src="${imgUrl(skill.image_path)}" alt="skill">`
    : '<div style="color:var(--muted);text-align:center;padding:40px">Ingen bild</div>';
  skillDetailName.textContent = skill.name || '—';
  skillDetailDesc.textContent = skill.description || '';
  skillDetailModal.classList.add('open');
}

skillForm.addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = skillForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sparar…';

  let imagePath = null;
  if (selectedSkillImageFile) {
    const file = selectedSkillImageFile;
    const ext  = file.name.split('.').pop();
    const path = `skills/skill_${Date.now()}.${ext}`;
    const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (uploadErr) {
      showToast('Bilduppladdning misslyckades: ' + uploadErr.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Spara skill';
      return;
    }
    imagePath = path;
  }

  const name        = skillNameEl.value.trim();
  const description = skillDescEl.value.trim();

  if (!name) {
    showToast('Titel krävs.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Spara skill';
    return;
  }

  const ok = await saveSkill(name, imagePath, description);

  submitBtn.disabled = false;
  submitBtn.textContent = 'Spara skill';

  if (ok) {
    showToast('Skill sparat!');
    resetSkillForm();
    showPage('page-overview');
  }
});

// ── Card list view ────────────────────────────────────────────────────────────
let listAllCards  = [];
let listSort      = { col: 'mana', dir: 'asc' };
let listSearchVal = '';

const listTbody   = document.getElementById('list-tbody');
const listCount   = document.getElementById('list-count');
const listSearch  = document.getElementById('list-search');

const LIST_COLS = ['id','name','mana','card_class','card_type','rarity','attack','health','armor','keywords','description','ability_id','draft_tag'];

async function renderCardList() {
  if (!listAllCards.length) {
    listAllCards = await loadCards();
  }
  applyListSort();
}

function applyListSort() {
  const q = listSearchVal.toLowerCase();
  let cards = listAllCards.filter(c =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.id.toLowerCase().includes(q) ||
    (c.card_class || '').toLowerCase().includes(q) ||
    (c.card_type  || '').toLowerCase().includes(q) ||
    (c.rarity     || '').toLowerCase().includes(q) ||
    (c.keywords   || '').toLowerCase().includes(q)
  );

  const { col, dir } = listSort;
  cards = [...cards].sort((a, b) => {
    let va = a[col] ?? '';
    let vb = b[col] ?? '';
    if (typeof va === 'number' || typeof vb === 'number') {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    }
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  listCount.textContent = `${cards.length} kort`;

  listTbody.innerHTML = cards.map(c => `
    <tr class="list-row" data-id="${c.id}">
      <td class="list-id">${c.id}</td>
      <td class="list-name">${c.name}</td>
      <td class="list-center">${c.mana ?? 0}</td>
      <td>${c.card_class || '—'}</td>
      <td><span class="badge badge-${c.card_type}">${c.card_type}</span></td>
      <td><span class="badge badge-${c.rarity}">${c.rarity}</span></td>
      <td class="list-center">${c.card_type === 'minion'     ? (c.attack ?? '—') : '—'}</td>
      <td class="list-center">${c.card_type === 'minion'     ? (c.health ?? '—') : '—'}</td>
      <td class="list-center">${c.card_type === 'structure'  ? (c.armor  ?? '—') : '—'}</td>
      <td class="list-keywords">${c.keywords || '—'}</td>
      <td class="list-desc">${c.description || '—'}</td>
      <td>${c.ability_id || c.effect_id || '—'}</td>
      <td>${c.draft_tag || '—'}</td>
    </tr>`).join('');

  listTbody.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => {
      const card = cards.find(c => c.id === row.dataset.id);
      if (card) openCardDetail(card);
    });
  });

  // Uppdatera sort-indikatorer i header
  document.querySelectorAll('#list-table thead th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === listSort.col) {
      th.classList.add(listSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

document.querySelectorAll('#list-table thead th').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (listSort.col === col) {
      listSort.dir = listSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      listSort = { col, dir: 'asc' };
    }
    applyListSort();
  });
});

listSearch.addEventListener('input', () => {
  listSearchVal = listSearch.value.trim();
  applyListSort();
});

// Rensa cache när ett kort sparas/uppdateras så listan alltid är färsk
const _origRenderGrid = renderGrid;

// ── Smart Templates ───────────────────────────────────────────────────────────

const SMART_KW = [
  { id:'FLYING',        label:'FLYING',        tip:'Kan bara blockas av FLYING/REACH' },
  { id:'RAPID',         label:'RAPID',         tip:'Anfaller direkt när spelad' },
  { id:'RANGE',         label:'RANGE',         tip:'Ignorerar blockers helt' },
  { id:'FIRST_STRIKE',  label:'FIRST_STRIKE',  tip:'Slår före motståndaren' },
  { id:'DOUBLE_STRIKE', label:'DOUBLE_STRIKE', tip:'Anfaller två gånger' },
  { id:'VAMPIRISM',     label:'VAMPIRISM',     tip:'Läker ägaren med skada den gör' },
  { id:'TOXIC',         label:'TOXIC',         tip:'Dödar allt den skadar direkt' },
  { id:'CANT_ATTACK',   label:'CANT_ATTACK',   tip:'Kan inte anfalla' },
];

const SMART_AB = [
  { id:'act_dmg',   label:'Activate: Damage',   short:'Activate (1): Deal 2 damage to any target.',        d:{ ability_id:'deal_damage', ability_trigger:'activate',  ability_cost:1, ability_target_mode:'any_target',    ability_targeting_mode:'explicit', ability_value:2 } },
  { id:'act_heal',  label:'Activate: Heal',     short:'Activate (1): Restore 3 health to your hero.',      d:{ ability_id:'heal',        ability_trigger:'activate',  ability_cost:1, ability_target_mode:'friendly_hero', ability_targeting_mode:'auto',     ability_value:3 } },
  { id:'act_draw',  label:'Activate: Draw',     short:'Activate (1): Draw a card.',                        d:{ ability_id:'draw_card',   ability_trigger:'activate',  ability_cost:1, ability_target_mode:'self',          ability_targeting_mode:'auto',     ability_value:1 } },
  { id:'play_dmg',  label:'Battlecry: Damage',  short:'Battlecry: Deal 2 damage to a random enemy minion.',d:{ ability_id:'deal_damage', ability_trigger:'on_play',   ability_cost:0, ability_target_mode:'enemy_minion',  ability_targeting_mode:'random',   ability_value:2 } },
  { id:'play_heal', label:'Battlecry: Heal',    short:'Battlecry: Restore 2 health to your hero.',         d:{ ability_id:'heal',        ability_trigger:'on_play',   ability_cost:0, ability_target_mode:'friendly_hero', ability_targeting_mode:'auto',     ability_value:2 } },
  { id:'death_draw',label:'Deathrattle: Draw',  short:'Deathrattle: Draw a card.',                         d:{ ability_id:'draw_card',   ability_trigger:'on_death',  ability_cost:0, ability_target_mode:'self',          ability_targeting_mode:'auto',     ability_value:1 } },
  { id:'atk_heal',  label:'On Attack: Heal',    short:'On Attack: Restore 1 health to your hero.',         d:{ ability_id:'heal',        ability_trigger:'on_attack', ability_cost:0, ability_target_mode:'friendly_hero', ability_targeting_mode:'auto',     ability_value:1 } },
  { id:'atk_dmg',   label:'On Attack: Damage',  short:'On Attack: Deal 1 damage to a random enemy minion.',d:{ ability_id:'deal_damage', ability_trigger:'on_attack', ability_cost:0, ability_target_mode:'enemy_minion',  ability_targeting_mode:'random',   ability_value:1 } },
];

const SMART_SAB = [
  { id:'sact_dmg',  label:'Activate: Damage',  short:'Activate (1): Deal 2 damage to any target.',   d:{ s_ability_id:'deal_damage', s_ability_cost:1, s_ability_target_mode:'any_target',    s_ability_targeting_mode:'explicit', s_ability_value:2 } },
  { id:'sact_heal', label:'Activate: Heal',    short:'Activate (1): Restore 3 health to your hero.', d:{ s_ability_id:'heal',        s_ability_cost:1, s_ability_target_mode:'friendly_hero', s_ability_targeting_mode:'auto',     s_ability_value:3 } },
  { id:'sact_draw', label:'Activate: Draw',    short:'Activate (2): Draw a card.',                   d:{ s_ability_id:'draw_card',   s_ability_cost:2, s_ability_target_mode:'self',          s_ability_targeting_mode:'auto',     s_ability_value:1 } },
];

const SMART_TRIG = [
  { id:'trig_dmg_hero', label:'EoT: Damage Hero',   short:'End of turn: deal 1 damage to enemy hero.',       d:{ trigger_id:'deal_damage', trigger_value:1, trigger_target_mode:'enemy_hero' } },
  { id:'trig_dmg_min',  label:'EoT: Damage Minion', short:'End of turn: deal 1 damage (random enemy minion).',d:{ trigger_id:'deal_damage', trigger_value:1, trigger_target_mode:'enemy_minion' } },
  { id:'trig_heal',     label:'EoT: Heal Hero',     short:'End of turn: restore 1 health to your hero.',     d:{ trigger_id:'heal',        trigger_value:1, trigger_target_mode:'friendly_hero' } },
  { id:'trig_draw',     label:'EoT: Draw',          short:'End of turn: draw a card.',                       d:{ trigger_id:'draw_card',   trigger_value:1, trigger_target_mode:'self' } },
];

const SMART_EFFECTS = [
  { id:'eff_dmg_hero',  label:'Damage: Hero',      short:'Deal 3 damage to the enemy hero.',            d:{ effect_id:'deal_damage', effect_value:3, target_mode:'enemy_hero',   targeting_mode:'explicit', repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_dmg_any',   label:'Damage: Any',       short:'Deal 2 damage to any target.',                d:{ effect_id:'deal_damage', effect_value:2, target_mode:'any_target',   targeting_mode:'explicit', repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_dmg_rand',  label:'Damage: Random',    short:'Deal 2 damage to a random enemy.',            d:{ effect_id:'deal_damage', effect_value:2, target_mode:'enemy_minion', targeting_mode:'random',   repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_dmg_aoe',   label:'Damage: AOE x3',    short:'Deal 1 damage to 3 random enemies.',          d:{ effect_id:'deal_damage', effect_value:1, target_mode:'enemy_minion', targeting_mode:'random',   repeat_count:3, repeat_mode:'reroll_each_time' } },
  { id:'eff_heal',      label:'Heal: Hero',        short:'Restore 4 health to your hero.',              d:{ effect_id:'heal',        effect_value:4, target_mode:'friendly_hero',targeting_mode:'auto',     repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_heal_any',  label:'Heal: Any',         short:'Restore 3 health to any target.',             d:{ effect_id:'heal',        effect_value:3, target_mode:'any_target',   targeting_mode:'explicit', repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_draw1',     label:'Draw 1',            short:'Draw 1 card.',                                d:{ effect_id:'draw_card',   effect_value:1, target_mode:'',             targeting_mode:'auto',     repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_draw2',     label:'Draw 2',            short:'Draw 2 cards.',                               d:{ effect_id:'draw_card',   effect_value:2, target_mode:'',             targeting_mode:'auto',     repeat_count:1, repeat_mode:'same_target' } },
  { id:'eff_chain',     label:'Chain x3',          short:'Deal 2 damage, bouncing to 3 targets.',       d:{ effect_id:'chain',       effect_value:2, target_mode:'any_target',   targeting_mode:'explicit', repeat_count:3, repeat_mode:'reroll_each_time' } },
];

const SMART_MINION_STATS = [
  { id:'s11', label:'1/1',  tip:'Mana 1', d:{ attack:1, health:1, mana:1 } },
  { id:'s21', label:'2/1',  tip:'Mana 1', d:{ attack:2, health:1, mana:1 } },
  { id:'s12', label:'1/2',  tip:'Mana 1', d:{ attack:1, health:2, mana:1 } },
  { id:'s22', label:'2/2',  tip:'Mana 2', d:{ attack:2, health:2, mana:2 } },
  { id:'s23', label:'2/3',  tip:'Mana 3', d:{ attack:2, health:3, mana:3 } },
  { id:'s32', label:'3/2',  tip:'Mana 3', d:{ attack:3, health:2, mana:3 } },
];

const SMART_COMBO_STATS = [
  { id:'c22', label:'2/2',  tip:'Mana 3', d:{ attack:2, health:2, mana:3 } },
  { id:'c23', label:'2/3',  tip:'Mana 4', d:{ attack:2, health:3, mana:4 } },
  { id:'c33', label:'3/3',  tip:'Mana 4', d:{ attack:3, health:3, mana:4 } },
  { id:'c34', label:'3/4',  tip:'Mana 5', d:{ attack:3, health:4, mana:5 } },
  { id:'c43', label:'4/3',  tip:'Mana 5', d:{ attack:4, health:3, mana:5 } },
];

const SMART_STRUCT_STATS = [
  { id:'a3', label:'Armor 3', tip:'Mana 2', d:{ armor:3, mana:2 } },
  { id:'a5', label:'Armor 5', tip:'Mana 3', d:{ armor:5, mana:3 } },
  { id:'a7', label:'Armor 7', tip:'Mana 4', d:{ armor:7, mana:4 } },
];

const SMART_SPELL_MANA = [
  { id:'m1', label:'1', d:{ mana:1 } },
  { id:'m2', label:'2', d:{ mana:2 } },
  { id:'m3', label:'3', d:{ mana:3 } },
  { id:'m4', label:'4', d:{ mana:4 } },
  { id:'m5', label:'5', d:{ mana:5 } },
];

function kwDesc(kw) {
  const map = { FLYING:'Flying.', RAPID:'Rapid.', RANGE:'Range.', FIRST_STRIKE:'First Strike.',
    DOUBLE_STRIKE:'Double Strike.', VAMPIRISM:'Vampirism.', TOXIC:'Toxic.', CANT_ATTACK:"Can't Attack." };
  return map[kw] || '';
}

function buildSmartSection(sectionCfg, state, onchange) {
  const wrap = document.createElement('div');
  wrap.className = 'smart-section';

  const labelRow = document.createElement('div');
  labelRow.className = 'smart-section-label';
  labelRow.innerHTML = `${sectionCfg.label}${sectionCfg.required
    ? ' <span class="smart-req">obligatorisk</span>'
    : ' <span class="smart-limit">max 1</span>'}`;
  wrap.appendChild(labelRow);

  const opts = document.createElement('div');
  opts.className = 'smart-opts';
  wrap.appendChild(opts);

  const preview = document.createElement('div');
  preview.className = 'smart-preview';
  wrap.appendChild(preview);

  sectionCfg.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'smart-opt-btn';
    btn.textContent = opt.label;
    if (opt.tip) btn.title = opt.tip;

    btn.addEventListener('click', () => {
      const wasActive = btn.classList.contains('active');
      opts.querySelectorAll('.smart-opt-btn').forEach(b => b.classList.remove('active'));
      if (!wasActive) {
        btn.classList.add('active');
        state[sectionCfg.key] = opt.id;
        preview.textContent = opt.short || opt.tip || '';
      } else {
        state[sectionCfg.key] = null;
        preview.textContent = '';
      }
      onchange();
    });
    opts.appendChild(btn);
  });

  return wrap;
}

function buildSmartCard(cfg) {
  const state = {};
  cfg.sections.forEach(s => { state[s.key] = s.default || null; });

  const card = document.createElement('div');
  card.className = 'smart-tpl-card';
  card.innerHTML = `
    <div class="smart-tpl-header">
      <span class="smart-tpl-icon">${cfg.icon}</span>
      <div>
        <div class="smart-tpl-title">${cfg.title}</div>
        <div class="smart-tpl-subtitle">${cfg.subtitle}</div>
      </div>
    </div>`;

  cfg.sections.forEach(secCfg => {
    card.appendChild(buildSmartSection(secCfg, state, updateBtn));
  });

  const footer = document.createElement('div');
  footer.className = 'smart-tpl-footer';

  const comboPreview = document.createElement('div');
  comboPreview.className = 'smart-combo-label';
  footer.appendChild(comboPreview);

  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn btn-primary';
  applyBtn.textContent = 'Använd mall →';
  footer.appendChild(applyBtn);
  card.appendChild(footer);

  function updateBtn() {
    const requiredMet = cfg.sections.filter(s => s.required).every(s => state[s.key]);
    applyBtn.disabled = !requiredMet;

    if (cfg.showCombo) {
      const parts = cfg.sections
        .map(s => { const o = s.options.find(o => o.id === state[s.key]); return o?.label || null; })
        .filter(Boolean);
      comboPreview.textContent = parts.length > 1 ? `Combo: ${parts.join(' + ')}` : '';
    }
  }

  applyBtn.addEventListener('click', async () => {
    const data = cfg.buildData(state);
    await applyTemplate({ name: cfg.title, card_type: data.card_type, card_data: data });
  });

  updateBtn();
  return card;
}

function initSmartTemplates() {
  const grid = document.getElementById('smart-tpl-grid');
  grid.innerHTML = '';

  // ── Minion Basic ──────────────────────────────────────────────────────────
  grid.appendChild(buildSmartCard({
    icon: '⚔️', title: 'Minion Basic', subtitle: 'Välj stats, valfritt keyword och/eller ability',
    showCombo: false,
    sections: [
      { key:'stats',   label:'Stats',   required:true,  options: SMART_MINION_STATS },
      { key:'keyword', label:'Keyword', required:false, options: SMART_KW },
      { key:'ability', label:'Ability', required:false, options: SMART_AB },
    ],
    buildData(state) {
      const stats  = SMART_MINION_STATS.find(s => s.id === state.stats) || SMART_MINION_STATS[3];
      const ab     = SMART_AB.find(a => a.id === state.ability);
      const kwStr  = state.keyword || '';
      const desc   = [kwStr ? kwDesc(kwStr) : '', ab?.short || ''].filter(Boolean).join(' ');
      return {
        card_type:'minion', card_class:'Neutral', rarity:'Basic',
        ...stats.d,
        keywords: kwStr,
        description: desc,
        ...(ab ? ab.d : {}),
      };
    },
  }));

  // ── Minion Combo ──────────────────────────────────────────────────────────
  grid.appendChild(buildSmartCard({
    icon: '⚡', title: 'Minion Combo', subtitle: 'Välj stats + 1 keyword + 1 ability (båda obligatoriska)',
    showCombo: true,
    sections: [
      { key:'stats',   label:'Stats',   required:true,  options: SMART_COMBO_STATS },
      { key:'keyword', label:'Keyword', required:true,  options: SMART_KW },
      { key:'ability', label:'Ability', required:true,  options: SMART_AB },
    ],
    buildData(state) {
      const stats = SMART_COMBO_STATS.find(s => s.id === state.stats) || SMART_COMBO_STATS[2];
      const ab    = SMART_AB.find(a => a.id === state.ability);
      const kwStr = state.keyword || '';
      const desc  = [kwStr ? kwDesc(kwStr) : '', ab?.short || ''].filter(Boolean).join(' ');
      return {
        card_type:'minion', card_class:'Neutral', rarity:'Superior',
        ...stats.d,
        keywords: kwStr,
        description: desc,
        ...(ab ? ab.d : {}),
      };
    },
  }));

  // ── Structure ─────────────────────────────────────────────────────────────
  grid.appendChild(buildSmartCard({
    icon: '🏰', title: 'Structure', subtitle: 'Välj armor, valfri activate-ability och/eller trigger',
    showCombo: false,
    sections: [
      { key:'stats',   label:'Armor',   required:true,  options: SMART_STRUCT_STATS },
      { key:'ability', label:'Ability (Activate)', required:false, options: SMART_SAB },
      { key:'trigger', label:'Trigger (End of Turn)', required:false, options: SMART_TRIG },
    ],
    buildData(state) {
      const stats = SMART_STRUCT_STATS.find(s => s.id === state.stats) || SMART_STRUCT_STATS[1];
      const ab    = SMART_SAB.find(a => a.id === state.ability);
      const trig  = SMART_TRIG.find(t => t.id === state.trigger);
      const descParts = [ab?.short || '', trig?.short || ''].filter(Boolean);
      return {
        card_type:'structure', card_class:'Neutral', rarity:'Basic',
        ...stats.d,
        description: descParts.join(' '),
        maintenance_cost: 0,
        repair_cost: 0, repair_value: 0,
        ...(ab ? ab.d : {}),
        ...(trig ? trig.d : {}),
      };
    },
  }));

  // ── Spell ─────────────────────────────────────────────────────────────────
  grid.appendChild(buildSmartCard({
    icon: '✨', title: 'Spell', subtitle: 'Välj manakostnad och effekt',
    showCombo: false,
    sections: [
      { key:'mana',   label:'Mana',    required:true,  options: SMART_SPELL_MANA },
      { key:'effect', label:'Effekt',  required:true,  options: SMART_EFFECTS },
    ],
    buildData(state) {
      const mana = SMART_SPELL_MANA.find(m => m.id === state.mana) || SMART_SPELL_MANA[1];
      const eff  = SMART_EFFECTS.find(e => e.id === state.effect);
      return {
        card_type:'spell', card_class:'Neutral', rarity:'Basic',
        mana: mana.d.mana,
        description: eff?.short || '',
        school: '',
        ...(eff ? eff.d : {}),
      };
    },
  }));
}

document.querySelector('.tpl-tab-btn[data-tab="smart"]').addEventListener('click', initSmartTemplates);

// ── Init ──────────────────────────────────────────────────────────────────────
initAuth();

// Lyssna på design-fliken
document.querySelector('nav button[data-page="page-design"]').addEventListener('click', async () => {
  await seedDocsIfEmpty();
  renderDocs();
});
