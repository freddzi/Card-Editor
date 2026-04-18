'use strict';

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://uofhyrawyjhqbdztagae.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QtniV0UdS9gY80_2O5HL7g_5uVDarKy';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'card-images';

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
    base.artwork_url  = sb.storage.from(BUCKET).getPublicUrl(paths[0]).data.publicUrl;
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

async function nextId() {
  const cards = await loadCards();
  const nums  = cards.map(c => parseInt(c.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const max   = nums.length ? Math.max(...nums) : 0;
  return 'A' + String(max + 1).padStart(5, '0');
}

// ── Navigation ────────────────────────────────────────────────────────────────
const pages   = document.querySelectorAll('.page');
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
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Overview ──────────────────────────────────────────────────────────────────
const grid       = document.getElementById('card-grid');
const cardCount  = document.getElementById('card-count');
const searchEl   = document.getElementById('search');
const filterType = document.getElementById('filter-type');
const filterRar  = document.getElementById('filter-rarity');

async function renderGrid() {
  grid.innerHTML = `<div class="empty-state">⏳<p>Laddar kort…</p></div>`;
  let cards = await loadCards();

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
    const imgSrc = c.artwork_url || (c.artwork_path
      ? sb.storage.from(BUCKET).getPublicUrl(c.artwork_path).data.publicUrl
      : null);
    const img = imgSrc
      ? `<img src="${imgSrc}" alt="${c.name}">`
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
    btn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(btn.dataset.del); });
  });
}

let searchTimer;
[searchEl, filterType, filterRar].forEach(el => {
  el.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderGrid, 300); });
});

// ── Delete modal ──────────────────────────────────────────────────────────────
const delModal    = document.getElementById('delete-modal');
const delCardName = document.getElementById('del-card-name');
const btnDelCancel = document.getElementById('btn-del-cancel');
const btnDelOk    = document.getElementById('btn-del-ok');
let pendingDelId  = null;

async function confirmDelete(id) {
  const cards = await loadCards();
  const card  = cards.find(c => c.id === id);
  if (!card) return;
  pendingDelId = id;
  delCardName.textContent = `"${card.name}" (${id})`;
  delModal.classList.add('open');
}

btnDelCancel.addEventListener('click', () => delModal.classList.remove('open'));
btnDelOk.addEventListener('click', async () => {
  if (!pendingDelId) return;
  const ok = await deleteCard(pendingDelId);
  delModal.classList.remove('open');
  pendingDelId = null;
  if (ok) { showToast('Kort borttaget.'); renderGrid(); }
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
  form.reset();
  selectedImageFile  = null;
  selectedImageFile2 = null;
  artworkPreview.innerHTML  = '🖼';
  artworkPreview2.innerHTML = '🖼';
  artworkFilename.textContent  = '';
  artworkFilename2.textContent = '';
  document.getElementById('field-id').value = await nextId();
  updateTypeSections();
  resetKeywords();
}

document.querySelector('nav button[data-page="page-add"]').addEventListener('click', async () => {
  document.getElementById('field-id').value = await nextId();
});

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

  const ok = await saveCard(base, extra, selectedImageFile, selectedImageFile2);
  submitBtn.disabled = false;
  submitBtn.textContent = 'Spara kort';

  if (ok) {
    showToast(`"${base.name}" sparat!`);
    await resetForm();
    showPage('page-overview');
  }
});

document.getElementById('btn-reset').addEventListener('click', resetForm);

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

// ── Init ──────────────────────────────────────────────────────────────────────
showPage('page-overview');
