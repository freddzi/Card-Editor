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
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    inlagd        BOOLEAN NOT NULL DEFAULT FALSE
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
    ability_arg              TEXT    NOT NULL DEFAULT '',
    target_filter            TEXT    NOT NULL DEFAULT ''
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
    repeat_mode      TEXT    NOT NULL DEFAULT 'same_target',
    target_filter    TEXT    NOT NULL DEFAULT ''
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
    trigger_target_mode      TEXT    NOT NULL DEFAULT 'enemy_hero',
    target_filter            TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE card_templates (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    card_type    TEXT    NOT NULL DEFAULT 'minion',
    card_data    JSONB   NOT NULL DEFAULT '{}',
    field_notes  JSONB   NOT NULL DEFAULT '{}',
    is_builtin   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON card_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE game_docs (
    id          BIGSERIAL PRIMARY KEY,
    category    TEXT        NOT NULL DEFAULT 'keyword',
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL DEFAULT '',
    tags        TEXT        NOT NULL DEFAULT '',
    in_godot    BOOLEAN     NOT NULL DEFAULT false,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migration (kör om tabellerna redan finns):
-- ALTER TABLE game_docs       ADD COLUMN IF NOT EXISTS in_godot       BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE minion_cards    ADD COLUMN IF NOT EXISTS target_filter  TEXT    NOT NULL DEFAULT '';
-- ALTER TABLE spell_cards     ADD COLUMN IF NOT EXISTS target_filter  TEXT    NOT NULL DEFAULT '';
-- ALTER TABLE structure_cards ADD COLUMN IF NOT EXISTS target_filter  TEXT    NOT NULL DEFAULT '';

ALTER TABLE game_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON game_docs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE skills (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT    NOT NULL,
    image_path  TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    text        TEXT    NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON skills FOR ALL USING (true) WITH CHECK (true);
