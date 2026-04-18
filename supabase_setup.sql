-- Tabeller
CREATE TABLE cards (
    id            TEXT PRIMARY KEY,
    name          TEXT    NOT NULL,
    mana          INTEGER NOT NULL DEFAULT 0,
    card_class    TEXT    NOT NULL DEFAULT '',
    card_type     TEXT    NOT NULL CHECK (card_type IN ('minion', 'spell', 'structure')),
    description   TEXT    NOT NULL DEFAULT '',
    artwork_path  TEXT    NOT NULL DEFAULT '',
    rarity        TEXT    NOT NULL DEFAULT 'common',
    keywords      TEXT    NOT NULL DEFAULT '',
    draft_tag     TEXT    NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE minion_cards (
    card_id                  TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    attack                   INTEGER NOT NULL DEFAULT 0,
    health                   INTEGER NOT NULL DEFAULT 1,
    subtype                  TEXT    NOT NULL DEFAULT '',
    ability_id               TEXT    NOT NULL DEFAULT '',
    ability_trigger          TEXT    NOT NULL DEFAULT '',
    ability_cost             INTEGER NOT NULL DEFAULT 0,
    ability_target_mode      TEXT    NOT NULL DEFAULT '',
    ability_targeting_mode   TEXT    NOT NULL DEFAULT 'explicit',
    ability_value            INTEGER NOT NULL DEFAULT 0,
    ability_arg              TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE spell_cards (
    card_id          TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    effect_id        TEXT    NOT NULL DEFAULT '',
    effect_value     INTEGER NOT NULL DEFAULT 0,
    target_mode      TEXT    NOT NULL DEFAULT '',
    targeting_mode   TEXT    NOT NULL DEFAULT 'explicit',
    school           TEXT    NOT NULL DEFAULT '',
    effect_arg       TEXT    NOT NULL DEFAULT '',
    repeat_count     INTEGER NOT NULL DEFAULT 1,
    repeat_mode      TEXT    NOT NULL DEFAULT 'same_target'
);

CREATE TABLE structure_cards (
    card_id                  TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    armor                    INTEGER NOT NULL DEFAULT 1,
    subtype                  TEXT    NOT NULL DEFAULT '',
    maintenance_cost         INTEGER NOT NULL DEFAULT 0,
    ability_id               TEXT    NOT NULL DEFAULT '',
    ability_cost             INTEGER NOT NULL DEFAULT 0,
    ability_target_mode      TEXT    NOT NULL DEFAULT '',
    ability_targeting_mode   TEXT    NOT NULL DEFAULT 'explicit',
    ability_value            INTEGER NOT NULL DEFAULT 0,
    ability_arg              TEXT    NOT NULL DEFAULT '',
    repair_cost              INTEGER NOT NULL DEFAULT 0,
    repair_value             INTEGER NOT NULL DEFAULT 0,
    trigger_id               TEXT    NOT NULL DEFAULT '',
    trigger_value            INTEGER NOT NULL DEFAULT 0,
    trigger_target_mode      TEXT    NOT NULL DEFAULT 'enemy_hero'
);

-- Tillåt publik läsning och skrivning (anon key)
ALTER TABLE cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE minion_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE spell_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE structure_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON cards           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON minion_cards    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON spell_cards     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON structure_cards FOR ALL USING (true) WITH CHECK (true);
