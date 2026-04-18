'use strict';

// ── Storage ──────────────────────────────────────────────────────────────────
const STORE_KEY = 'card_editor_cards';

function loadCards() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}

function saveCards(cards) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cards));
}

function nextId(cards) {
  const nums = cards
    .map(c => parseInt(c.id.replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'A' + String(max + 1).padStart(5, '0');
}

// ── Navigation ────────────────────────────────────────────────────────────────
const pages = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('nav button[data-page]');

function showPage(id) {
  pages.forEach(p => p.classList.toggle('active', p.id === id));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'page-overview') renderGrid();
  if (id === 'page-export')   renderExport();
}

navBtns.forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = document.getElementById('toast');
let toastTimer;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Overview ──────────────────────────────────────────────────────────────────
const grid       = document.getElementById('card-grid');
const cardCount  = document.getElementById('card-count');
const searchEl   = document.getElementById('search');
const filterType = document.getElementById('filter-type');
const filterRar  = document.getElementById('filter-rarity');

function renderGrid() {
  let cards = loadCards();
  const q   = searchEl.value.trim().toLowerCase();
  const typ = filterType.value;
  const rar = filterRar.value;

  if (q)   cards = cards.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  if (typ) cards = cards.filter(c => c.card_type === typ);
  if (rar) cards = cards.filter(c => c.rarity === rar);

  cardCount.textContent = `${cards.length} kort`;

  if (!cards.length) {
    grid.innerHTML = `<div class="empty-state">🃏<p>Inga kort hittades.</p></div>`;
    return;
  }

  grid.innerHTML = cards.map(c => {
    const img = c.artwork_data
      ? `<img src="${c.artwork_data}" alt="${c.name}">`
      : `<div class="no-img">🃏</div>`;
    const stats = c.card_type === 'minion'
      ? `${c.attack ?? '?'}/${c.health ?? '?'} · ${c.subtype || '-'}`
      : c.card_type === 'spell'
      ? `Mana ${c.mana}`
      : `Armor ${c.armor ?? '?'}`;

    return `
    <div class="card-tile" data-id="${c.id}" title="${c.id}">
      ${img}
      <button class="tile-del" data-del="${c.id}">✕</button>
      <div class="card-tile-info">
        <div class="card-tile-name">${c.name}</div>
        <div class="card-tile-sub">
          <span class="badge badge-${c.card_type}">${c.card_type}</span>
          <span class="badge badge-${c.rarity}">${c.rarity}</span>
        </div>
        <div class="card-tile-sub" style="margin-top:4px;font-size:11px">${stats}</div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.tile-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDelete(btn.dataset.del);
    });
  });
}

[searchEl, filterType, filterRar].forEach(el => el.addEventListener('input', renderGrid));

// ── Delete modal ──────────────────────────────────────────────────────────────
const delModal     = document.getElementById('delete-modal');
const delCardName  = document.getElementById('del-card-name');
const btnDelCancel = document.getElementById('btn-del-cancel');
const btnDelOk     = document.getElementById('btn-del-ok');
let pendingDelId   = null;

function confirmDelete(id) {
  const cards = loadCards();
  const card  = cards.find(c => c.id === id);
  if (!card) return;
  pendingDelId = id;
  delCardName.textContent = `"${card.name}" (${id})`;
  delModal.classList.add('open');
}

btnDelCancel.addEventListener('click', () => delModal.classList.remove('open'));
btnDelOk.addEventListener('click', () => {
  if (!pendingDelId) return;
  const cards = loadCards().filter(c => c.id !== pendingDelId);
  saveCards(cards);
  delModal.classList.remove('open');
  pendingDelId = null;
  renderGrid();
  showToast('Kort borttaget.');
});

// ── Add Card form ─────────────────────────────────────────────────────────────
const form          = document.getElementById('card-form');
const typeSelect    = document.getElementById('field-card_type');
const artworkInput  = document.getElementById('artwork-input');
const artworkPreview = document.getElementById('artwork-preview');
const artworkFilename = document.getElementById('artwork-filename');

let artworkData = null;   // base64 data URL
let artworkName = '';

// artwork upload
artworkPreview.addEventListener('click', () => artworkInput.click());
artworkInput.addEventListener('change', () => {
  const file = artworkInput.files[0];
  if (!file) return;
  artworkName = file.name;
  artworkFilename.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    artworkData = e.target.result;
    artworkPreview.innerHTML = `<img src="${artworkData}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});

// card type → show/hide sections
typeSelect.addEventListener('change', updateTypeSections);

function updateTypeSections() {
  const t = typeSelect.value;
  document.querySelectorAll('.type-section').forEach(s => {
    s.classList.toggle('visible', s.dataset.type === t);
  });
}

updateTypeSections();

// reset form
function resetForm() {
  form.reset();
  artworkData = null;
  artworkName = '';
  artworkPreview.innerHTML = '🖼';
  artworkFilename.textContent = '';
  document.getElementById('field-id').value = nextId(loadCards());
  updateTypeSections();
}

// pre-fill next id when navigating to Add
document.querySelector('nav button[data-page="page-add"]').addEventListener('click', () => {
  document.getElementById('field-id').value = nextId(loadCards());
});

// submit
form.addEventListener('submit', e => {
  e.preventDefault();
  const fd  = new FormData(form);
  const get = k => fd.get(k)?.trim() ?? '';

  const base = {
    id:          get('id'),
    name:        get('name'),
    mana:        parseInt(get('mana')) || 0,
    card_class:  get('card_class'),
    card_type:   get('card_type'),
    description: get('description'),
    artwork_path: artworkName,
    artwork_data: artworkData,
    rarity:      get('rarity'),
    keywords:    get('keywords'),
    draft_tag:   get('draft_tag'),
  };

  if (!base.id || !base.name || !base.card_type) {
    showToast('ID, Namn och Typ krävs.');
    return;
  }

  const cards = loadCards();
  if (cards.find(c => c.id === base.id)) {
    showToast(`ID ${base.id} finns redan!`);
    return;
  }

  let extra = {};
  if (base.card_type === 'minion') {
    extra = {
      attack:                parseInt(get('attack')) || 0,
      health:                parseInt(get('health')) || 1,
      subtype:               get('subtype'),
      ability_id:            get('ability_id'),
      ability_trigger:       get('ability_trigger'),
      ability_cost:          parseInt(get('ability_cost')) || 0,
      ability_target_mode:   get('ability_target_mode'),
      ability_targeting_mode:get('ability_targeting_mode') || 'explicit',
      ability_value:         parseInt(get('ability_value')) || 0,
      ability_arg:           get('ability_arg'),
    };
  } else if (base.card_type === 'spell') {
    extra = {
      effect_id:      get('effect_id'),
      effect_value:   parseInt(get('effect_value')) || 0,
      target_mode:    get('target_mode'),
      targeting_mode: get('targeting_mode') || 'explicit',
      school:         get('school'),
      effect_arg:     get('effect_arg'),
      repeat_count:   parseInt(get('repeat_count')) || 1,
      repeat_mode:    get('repeat_mode') || 'same_target',
    };
  } else if (base.card_type === 'structure') {
    extra = {
      armor:                  parseInt(get('armor')) || 1,
      subtype:                get('s_subtype'),
      maintenance_cost:       parseInt(get('maintenance_cost')) || 0,
      ability_id:             get('s_ability_id'),
      ability_cost:           parseInt(get('s_ability_cost')) || 0,
      ability_target_mode:    get('s_ability_target_mode'),
      ability_targeting_mode: get('s_ability_targeting_mode') || 'explicit',
      ability_value:          parseInt(get('s_ability_value')) || 0,
      ability_arg:            get('s_ability_arg'),
      repair_cost:            parseInt(get('repair_cost')) || 0,
      repair_value:           parseInt(get('repair_value')) || 0,
      trigger_id:             get('trigger_id'),
      trigger_value:          parseInt(get('trigger_value')) || 0,
      trigger_target_mode:    get('trigger_target_mode') || 'enemy_hero',
    };
  }

  cards.push({ ...base, ...extra });
  saveCards(cards);
  showToast(`"${base.name}" sparat!`);
  resetForm();
  showPage('page-overview');
});

document.getElementById('btn-reset').addEventListener('click', resetForm);

// ── Export ────────────────────────────────────────────────────────────────────
const sqlOutput = document.getElementById('sql-output');

function esc(v) { return String(v).replace(/'/g, "''"); }

function buildSQL(cards) {
  if (!cards.length) return '-- Inga kort att exportera.';

  const ids = cards.map(c => `'${esc(c.id)}'`).join(', ');
  const range = `card_id IN (${ids})`;
  const idRange = `id IN (${ids})`;

  let sql = `PRAGMA foreign_keys = ON;\n\n`;
  sql += `-- Rensa befintliga poster för dessa ID:n\n`;
  sql += `DELETE FROM structure_cards WHERE ${range};\n`;
  sql += `DELETE FROM spell_cards     WHERE ${range};\n`;
  sql += `DELETE FROM minion_cards    WHERE ${range};\n`;
  sql += `DELETE FROM cards           WHERE ${idRange};\n\n`;

  // cards table
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

function renderExport() {
  sqlOutput.textContent = buildSQL(loadCards());
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
});

document.getElementById('btn-export-json').addEventListener('click', () => {
  const cards = loadCards().map(c => {
    const { artwork_data, ...rest } = c;
    return rest;
  });
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'cards_export.json',
  });
  a.click();
  showToast('JSON nedladdat!');
});

// ── Init ──────────────────────────────────────────────────────────────────────
showPage('page-overview');
