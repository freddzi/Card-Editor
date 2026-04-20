# Kortdatabasguide

Alla kort lagras i SQLite-databasen `card-base.db` via två tabeller per kort:
en rad i `cards` (gemensamma fält) och en rad i respektive typspecifik tabell
(`minion_cards`, `spell_cards`, `structure_cards`).

---

## Kortets ID

```
Format: [SET][LÖPNUMMER]
Exempel: A00001, B00042
```

- **SET** — en bokstav som identifierar kortset (A = Dark set 01, B = nästa set osv.)
- **LÖPNUMMER** — fem siffror med nollpadding

Alla ID:n i ett INSERT-block ska höra till samma set och nummerintervall.
Seed-filen börjar alltid med `DELETE FROM ... WHERE id BETWEEN 'A00001' AND 'A00050'`
för att kunna köras om utan dubbletter.

---

## Tabell: `cards` — gemensamma fält

| Kolumn | Typ | Krav | Beskrivning |
|---|---|---|---|
| `id` | TEXT | obligatorisk | Unikt kort-ID, se format ovan |
| `name` | TEXT | obligatorisk | Kortets namn, visas i UI |
| `mana` | INTEGER ≥ 0 | obligatorisk | Manakostnad för att spela kortet |
| `card_class` | TEXT | obligatorisk | Klassidentifierare, t.ex. `Dark`, `Light`, `Nature` |
| `card_type` | TEXT | obligatorisk | Måste vara exakt `minion`, `spell` eller `structure` |
| `description` | TEXT | | Flavortext / regeltext som visas på kortet |
| `artwork_path` | TEXT | | Kommaseparerade filnamn, t.ex. `1-1.png, 2-1.png` — handbild följt av play-bild |
| `rarity` | TEXT | | `common` · `uncommon` · `rare` · `epic` · `legendary` (default: `common`) |
| `keywords` | TEXT | | Kommaseparerade nyckelord i versaler, se lista nedan |
| `draft_tag` | TEXT | | Grupperingsnamn för draft, t.ex. `dark_set_01` |

### Nyckelord (`keywords`)

Skriv som kommaseparerad sträng i versaler. Ordning spelar ingen roll.

| Nyckelord | Effekt |
|---|---|
| `FLYING` | Kan bara blockas av FLYING eller REACH. Kan anfalla FLYING direkt. |
| `REACH` | Kan blocka FLYING. |
| `RAPID` | Kan anfalla omedelbart när den spelas (går direkt till FRONT_LINE). |
| `RANGE` | Ignorerar alltid blockers, anfaller direkt mot hjälten. |
| `FIRST_STRIKE` | Slår skada innan motståndaren i strid. |
| `DOUBLE_STRIKE` | Anfaller två gånger per tur. |
| `TWINSTRIKE` | Alternativt namn för DOUBLE_STRIKE. |
| `CANT_ATTACK` | Kan aldrig anfalla. |
| `PARRY` | Minskar inkommande skada (kan ha värde, t.ex. `PARRY_2`). |
| `IRON_SKIN` | Ignorerar liten skada. |
| `TOXIC` | Dödar omedelbart allt den skadar. |
| `VAMPIRISM` | Läker ägaren med skadan den gör. |
| `INSTANT` | Enbart på stavningar — kan spelas under blockfönstret. |

**Exempel:** `'FLYING, RAPID'` eller `'DOUBLE_STRIKE, VAMPIRISM'`

---

## Tabell: `minion_cards`

Varje rad i `cards` med `card_type = 'minion'` **måste** ha en matchande rad här.

| Kolumn | Typ | Krav | Beskrivning |
|---|---|---|---|
| `card_id` | TEXT | obligatorisk | Samma ID som i `cards` |
| `attack` | INTEGER ≥ 0 | obligatorisk | Attackvärde |
| `health` | INTEGER ≥ 1 | obligatorisk | Livsvärde |
| `subtype` | TEXT | | Subtypnamn, t.ex. `Beast`, `Undead`, `Demon`, `Knight` |
| `ability_id` | TEXT | | Effekt-ID för aktiverbar förmåga, t.ex. `deal_damage`, `draw_card`, `heal` |
| `ability_trigger` | TEXT | | Hur förmågan triggas — använd `activate` för klickbar ability |
| `ability_cost` | INTEGER ≥ 0 | | Kostnad i mana (eller antal kort om discard) |
| `ability_target_mode` | TEXT | | Vad förmågan kan riktas mot — se mållägen nedan |
| `ability_targeting_mode` | TEXT | | `explicit` (spelaren väljer) · `random` · `auto` |
| `ability_value` | INTEGER | | Numeriskt värde på effekten, t.ex. skada eller heals |
| `ability_arg` | TEXT | | Extra konfiguration — se ability_arg-format nedan |

### Tomma förmågafält

Minions utan förmåga fyller alla ability-kolumner med tomma standardvärden:

```sql
('A00001', 2, 2, 'Beast', '', '', 0, '', 0, '')
```

### `ability_trigger`-värden

| Värde | Beskrivning |
|---|---|
| `activate` | Spelaren klickar manuellt för att aktivera (visas som glow-area på kortet) |
| *(tom)* | Ingen aktiverbar förmåga |

*Framtida triggers kan läggas till: `on_play`, `on_death`, `on_attack` osv.*

### Mållägen (`ability_target_mode` / `target_mode`)

| Värde | Beskrivning |
|---|---|
| `any_target` | Valfri minion eller hjälte |
| `target_minion` | Valfri minion (vän eller fiende) |
| `enemy_minion` | Fiendens minion |
| `friendly_minion` | Egen minion |
| `enemy_hero` | Fiendens hjälte |
| `friendly_hero` | Egen hjälte |
| `enemy_player` | Fiendens hjälte (alias) |
| `friendly_player` | Egen hjälte (alias) |
| `self` | Kortet självt (ingen explicit målvalsdialog) |
| *(tom)* | Inget mål krävs |

### `ability_arg`-format

`ability_arg` är en flexibel textsträng för extra konfiguration av förmågan.

| Format | Beskrivning | Exempel |
|---|---|---|
| *(tom)* | Ingen extra konfiguration | `''` |
| `cost:discard:N` | Aktivering kostar att kasta N kort (spelaren väljer vilka) | `'cost:discard:1'` |
| `cost:discard_random:N` | Aktivering kastar N slumpmässiga kort automatiskt | `'cost:discard_random:2'` |

### Exempelrader — minions

```sql
-- Enkel minion utan förmåga
('A00003', 2, 2, 'Beast', '', '', 0, '', 0, '')

-- Minion med activate-förmåga: kosta 2 mana, deal 3 damage mot valfri minion
('A00050', 3, 3, 'Mage', 'deal_damage', 'activate', 2, 'target_minion', 3, '')

-- Minion med activate-förmåga: kosta 1 kort discard, läker egen hjälte 4
('A00051', 2, 4, 'Shaman', 'heal', 'activate', 0, 'friendly_hero', 4, 'cost:discard:1')

-- Minion med activate-förmåga: dra 1 kort, kostar 1 mana
('A00052', 1, 3, 'Scholar', 'draw_card', 'activate', 1, 'self', 1, '')
```

---

## Tabell: `spell_cards`

Varje rad i `cards` med `card_type = 'spell'` **måste** ha en matchande rad här.

| Kolumn | Typ | Krav | Beskrivning |
|---|---|---|---|
| `card_id` | TEXT | obligatorisk | Samma ID som i `cards` |
| `effect_id` | TEXT | obligatorisk | Effekt som utförs — se effekt-ID nedan |
| `effect_value` | INTEGER | | Numeriskt värde på effekten |
| `target_mode` | TEXT | | Vad stavningen riktas mot — se mållägen ovan |
| `targeting_mode` | TEXT | | `explicit` · `random` · `auto` (default: `explicit`) |
| `school` | TEXT | | Magiskola, t.ex. `Shadow`, `Blood`, `Void` — används för flavortext/groupering |
| `effect_arg` | TEXT | | Extra konfiguration (samma format som `ability_arg`) |
| `repeat_count` | INTEGER ≥ 1 | | Hur många gånger effekten upprepas (default: 1) |
| `repeat_mode` | TEXT | | `same_target` — träffar samma mål varje gång · `reroll_each_time` — nytt slumpmål varje gång |

### Effekt-ID:n (`effect_id`)

| Värde | Beskrivning |
|---|---|
| `deal_damage` | Gör X skada på målet |
| `heal` | Läker målet X liv |
| `draw_card` | Drar X kort |
| `chain` | Kedjeeffekt (fryser minion i N rundor) |

### Exempelrader — stavningar

```sql
-- Deal 3 damage to any target
('A00016', 'deal_damage', 3, 'any_target', 'explicit', 'Shadow', '', 1, 'same_target')

-- Deal 2 damage to a random enemy minion (auto-targets, no player choice)
('A00017', 'deal_damage', 2, 'enemy_minion', 'random', 'Dark', '', 1, 'same_target')

-- Deal 1 damage to ALL enemy minions (repeat + reroll varje gång mot random fiendeminion)
-- Notera: kräver att det finns 4 enemy minions, annars kan samma träffas
('A00018', 'deal_damage', 1, 'enemy_minion', 'random', 'Fire', '', 4, 'reroll_each_time')

-- Draw 2 cards (inget mål, auto)
('A00019', 'draw_card', 2, 'self', 'auto', 'Void', '', 1, 'same_target')

-- Restore 5 health to friendly hero
('A00020', 'heal', 5, 'friendly_hero', 'auto', 'Blood', '', 1, 'same_target')
```

---

## Tabell: `structure_cards`

Varje rad i `cards` med `card_type = 'structure'` **måste** ha en matchande rad här.
Strukturer är fasta byggnader som inte anfaller — de har rustning istället för liv.

| Kolumn | Typ | Krav | Beskrivning |
|---|---|---|---|
| `card_id` | TEXT | obligatorisk | Samma ID som i `cards` |
| `armor` | INTEGER ≥ 1 | obligatorisk | Rustning (liv-ekvivalent för strukturer) |
| `subtype` | TEXT | | T.ex. `Tower`, `Fortification`, `Workshop` |
| `maintenance_cost` | INTEGER ≥ 0 | | Manakostnad varje tur för att behålla strukturen aktiv |
| `ability_id` | TEXT | | Aktiverbar förmåga (samma effekt-ID som stavningar) |
| `ability_cost` | INTEGER ≥ 0 | | Manakostnad för att aktivera förmågan |
| `ability_target_mode` | TEXT | | Målläge för förmågan |
| `ability_targeting_mode` | TEXT | | `explicit` · `random` · `auto` |
| `ability_value` | INTEGER | | Numeriskt värde på förmågan |
| `ability_arg` | TEXT | | Extra konfiguration |
| `repair_cost` | INTEGER ≥ 0 | | Manakostnad för att reparera strukturen |
| `repair_value` | INTEGER ≥ 0 | | Hur mycket rustning som återfås vid reparation |
| `trigger_id` | TEXT | | Passiv trigger-effekt — t.ex. `deal_damage` = skjuter varje dragskedets start |
| `trigger_value` | INTEGER | | Värde på trigger-effekten |
| `trigger_target_mode` | TEXT | | Mål för trigger, oftast `enemy_hero` (default) |

### Exempelrader — strukturer

```sql
-- Torn: 5 rustning, underhåll 1, skjuter 1 skada på fiendens hjälte varje dragskede
('A00041', 5, 'Tower', 1,   '', 0, '', 'auto', 0, '',   1, 0,   'deal_damage', 1, 'enemy_hero')

-- Verkstad: 6 rustning, underhåll 2, aktiverbar förmåga (draw 1 kort för 2 mana)
('A00042', 6, 'Workshop', 2,   'draw_card', 2, 'self', 'auto', 1, '',   2, 3,   '', 0, 'enemy_hero')
```

---

## Komplett exempel — nytt kort från grunden

### Minion med activate-ability

```sql
-- 1. Gemensam rad
INSERT INTO cards (id, name, mana, card_class, card_type, description, artwork_path, rarity, keywords, draft_tag)
VALUES ('B00001', 'Soul Weaver', 4, 'Dark', 'minion',
        'Activate (1): Deal 2 damage to any target.',
        'b1-1.png, b2-1.png', 'rare', 'VAMPIRISM', 'dark_set_02');

-- 2. Minion-rad
INSERT INTO minion_cards (card_id, attack, health, subtype, ability_id, ability_trigger, ability_cost, ability_target_mode, ability_targeting_mode, ability_value, ability_arg)
VALUES ('B00001', 3, 4, 'Specter', 'deal_damage', 'activate', 1, 'any_target', 'explicit', 2, '');
```

### Stavning

```sql
INSERT INTO cards (id, name, mana, card_class, card_type, description, artwork_path, rarity, keywords, draft_tag)
VALUES ('B00002', 'Chain Lightning', 3, 'Storm', 'spell',
        'Deal 2 damage to a random enemy minion. Repeat 3 times.',
        'bs1.png', 'rare', '', 'storm_set_01');

INSERT INTO spell_cards (card_id, effect_id, effect_value, target_mode, targeting_mode, school, effect_arg, repeat_count, repeat_mode)
VALUES ('B00002', 'deal_damage', 2, 'enemy_minion', 'random', 'Storm', '', 3, 'reroll_each_time');
```

---

## Vanliga misstag

| Misstag | Konsekvens | Korrekt |
|---|---|---|
| `card_type = 'Minion'` (stor bokstav) | Constraint-fel, kortet laddas inte | `'minion'` |
| Sätter `ability_trigger = 'activate'` men `ability_id = ''` | Kortet visas som ability-kort men gör ingenting | Fyll i `ability_id` |
| `targeting_mode = 'Explicit'` | Constraint-fel | `'explicit'` |
| Glömmer rad i `minion_cards` för ett minion-kort | Foreign key-fel, spelet kraschar vid kortladdning | Lägg alltid till båda raderna |
| `keywords = 'Flying'` (liten bokstav) | Tolkas inte — kortet får inte FLYING-regeln | `'FLYING'` |
| `repeat_count = 0` | Constraint-fel | Minst `1` |
