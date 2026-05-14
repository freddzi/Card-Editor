[1mdiff --git a/app.js b/app.js[m
[1mindex 5774ca4..c66c224 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -1765,6 +1765,106 @@[m [mdocument.getElementById('btn-download-sql').addEventListener('click', () => {[m
   showToast('SQL nedladdat!');[m
 });[m
 [m
[32m+[m[32mdocument.getElementById('btn-download-db').addEventListener('click', async () => {[m
[32m+[m[32m  const btn = document.getElementById('btn-download-db');[m
[32m+[m[32m  btn.disabled = true;[m
[32m+[m[32m  btn.textContent = 'Bygger .db…';[m
[32m+[m[32m  try {[m
[32m+[m[32m    const all   = await loadCards();[m
[32m+[m[32m    const cards = filterExportCards(all);[m
[32m+[m[32m    const suffix = exportInlagdFilter === 'true' ? '_inlagda' : exportInlagdFilter === 'false' ? '_ej_inlagda' : '';[m
[32m+[m
[32m+[m[32m    const SQL = await initSqlJs({[m
[32m+[m[32m      locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`,[m
[32m+[m[32m    });[m
[32m+[m[32m    const db = new SQL.Database();[m
[32m+[m
[32m+[m[32m    db.run(`[m
[32m+[m[32m      CREATE TABLE IF NOT EXISTS cards ([m
[32m+[m[32m        id TEXT PRIMARY KEY, name TEXT, mana INTEGER, card_class TEXT,[m
[32m+[m[32m        card_type TEXT, description TEXT, artwork_path TEXT, rarity TEXT,[m
[32m+[m[32m        keywords TEXT, draft_tag TEXT[m
[32m+[m[32m      );[m
[32m+[m[32m      CREATE TABLE IF NOT EXISTS minion_cards ([m
[32m+[m[32m        card_id TEXT PRIMARY KEY, attack INTEGER, health INTEGER, subtype TEXT,[m
[32m+[m[32m        ability_id TEXT, ability_trigger TEXT, ability_cost INTEGER,[m
[32m+[m[32m        ability_target_mode TEXT, ability_targeting_mode TEXT, ability_value INTEGER,[m
[32m+[m[32m        ability_arg TEXT, target_filter TEXT, passive_id TEXT, passive_arg TEXT,[m
[32m+[m[32m        passive_value INTEGER, passive_cap INTEGER[m
[32m+[m[32m      );[m
[32m+[m[32m      CREATE TABLE IF NOT EXISTS spell_cards ([m
[32m+[m[32m        card_id TEXT PRIMARY KEY, effect_id TEXT, effect_value INTEGER,[m
[32m+[m[32m        target_mode TEXT, targeting_mode TEXT, school TEXT, effect_arg TEXT,[m
[32m+[m[32m        repeat_count INTEGER, repeat_mode TEXT, target_filter TEXT[m
[32m+[m[32m      );[m
[32m+[m[32m      CREATE TABLE IF NOT EXISTS structure_cards ([m
[32m+[m[32m        card_id TEXT PRIMARY KEY, armor INTEGER, subtype TEXT, maintenance_cost INTEGER,[m
[32m+[m[32m        ability_id TEXT, ability_cost INTEGER, ability_target_mode TEXT,[m
[32m+[m[32m        ability_targeting_mode TEXT, ability_value INTEGER, ability_arg TEXT,[m
[32m+[m[32m        repair_cost INTEGER, repair_value INTEGER, trigger_id TEXT, trigger_value INTEGER,[m
[32m+[m[32m        trigger_target_mode TEXT, target_filter TEXT[m
[32m+[m[32m      );[m
[32m+[m[32m    `);[m
[32m+[m
[32m+[m[32m    const cardStmt = db.prepare(`INSERT OR REPLACE INTO cards VALUES (?,?,?,?,?,?,?,?,?,?)`);[m
[32m+[m[32m    for (const c of cards) {[m
[32m+[m[32m      cardStmt.run([c.id, c.name, c.mana??0, c.card_class, c.card_type, c.description,[m
[32m+[m[32m        c.artwork_path, c.rarity, c.keywords, c.draft_tag]);[m
[32m+[m[32m    }[m
[32m+[m[32m    cardStmt.free();[m
[32m+[m
[32m+[m[32m    const minions = cards.filter(c => c.card_type === 'minion');[m
[32m+[m[32m    if (minions.length) {[m
[32m+[m[32m      const s = db.prepare(`INSERT OR REPLACE INTO minion_cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);[m
[32m+[m[32m      for (const c of minions) {[m
[32m+[m[32m        s.run([c.id, c.attack??0, c.health??0, c.subtype, c.ability_id, c.ability_trigger,[m
[32m+[m[32m          c.ability_cost??0, c.ability_target_mode, c.ability_targeting_mode||'explicit',[m
[32m+[m[32m          c.ability_value??0, c.ability_arg, c.target_filter, c.passive_id||'',[m
[32m+[m[32m          c.passive_arg||'', c.passive_value??0, c.passive_cap??0]);[m
[32m+[m[32m      }[m
[32m+[m[32m      s.free();[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const spells = cards.filter(c => c.card_type === 'spell');[m
[32m+[m[32m    if (spells.length) {[m
[32m+[m[32m      const s = db.prepare(`INSERT OR REPLACE INTO spell_cards VALUES (?,?,?,?,?,?,?,?,?,?)`);[m
[32m+[m[32m      for (const c of spells) {[m
[32m+[m[32m        s.run([c.id, c.effect_id, c.effect_value??0, c.target_mode, c.targeting_mode||'explicit',[m
[32m+[m[32m          c.school, c.effect_arg, c.repeat_count??1, c.repeat_mode||'same_target', c.target_filter]);[m
[32m+[m[32m      }[m
[32m+[m[32m      s.free();[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const structures = cards.filter(c => c.card_type === 'structure');[m
[32m+[m[32m    if (structures.length) {[m
[32m+[m[32m      const s = db.prepare(`INSERT OR REPLACE INTO structure_cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);[m
[32m+[m[32m      for (const c of structures) {[m
[32m+[m[32m        s.run([c.id, c.armor??1, c.subtype, c.maintenance_cost??0, c.ability_id,[m
[32m+[m[32m          c.ability_cost??0, c.ability_target_mode, c.ability_targeting_mode||'explicit',[m
[32m+[m[32m          c.ability_value??0, c.ability_arg, c.repair_cost??0, c.repair_value??0,[m
[32m+[m[32m          c.trigger_id, c.trigger_value??0, c.trigger_target_mode||'enemy_hero', c.target_filter]);[m
[32m+[m[32m      }[m
[32m+[m[32m      s.free();[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const bytes = db.export();[m
[32m+[m[32m    db.close();[m
[32m+[m[32m    const blob = new Blob([bytes], { type: 'application/octet-stream' });[m
[32m+[m[32m    const a = Object.assign(document.createElement('a'), {[m
[32m+[m[32m      href: URL.createObjectURL(blob),[m
[32m+[m[32m      download: `cards_export${suffix}.db`,[m
[32m+[m[32m    });[m
[32m+[m[32m    a.click();[m
[32m+[m[32m    showToast('.db nedladdat!');[m
[32m+[m[32m  } catch (err) {[m
[32m+[m[32m    showToast('Fel: ' + err.message);[m
[32m+[m[32m    console.error(err);[m
[32m+[m[32m  } finally {[m
[32m+[m[32m    btn.disabled = false;[m
[32m+[m[32m    btn.textContent = 'Ladda ner .db';[m
[32m+[m[32m  }[m
[32m+[m[32m});[m
[32m+[m
 document.getElementById('btn-export-json').addEventListener('click', async () => {[m
   const all   = await loadCards();[m
   const cards = filterExportCards(all).map(convertCard);[m
[1mdiff --git a/index.html b/index.html[m
[1mindex 38ecae5..f237057 100644[m
[1m--- a/index.html[m
[1m+++ b/index.html[m
[36m@@ -761,6 +761,7 @@[m
     <div class="export-toolbar">[m
       <button class="btn btn-primary" id="btn-copy-sql">Kopiera SQL</button>[m
       <button class="btn btn-green" id="btn-download-sql">Ladda ner .sql</button>[m
[32m+[m[32m      <button class="btn btn-green" id="btn-download-db">Ladda ner .db</button>[m
       <button class="btn btn-secondary" id="btn-export-json">Ladda ner JSON</button>[m
     </div>[m
     <pre id="sql-output">-- Laddar…</pre>[m
[36m@@ -1296,6 +1297,7 @@[m
 [m
 <script src="https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.umd.js"></script>[m
 <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>[m
[32m+[m[32m<script src="https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.js"></script>[m
 <script src="app.js"></script>[m
 </body>[m
 </html>[m
