#!/usr/bin/env python3
"""
Migration: CSV-filer -> PocketBase
"""

import os
import csv
import glob
import json
import requests

# ── Config ────────────────────────────────────────────────────────────────────
PB_URL      = 'http://192.168.50.24:8091'
PB_EMAIL    = 'freddzi@admin.com'
PB_PASSWORD = input('PocketBase admin password: ')
IMAGES_DIR  = '/home/freddzi/card/Client/Resources/Card'
CSV_DIR     = '/home/freddzi/card-editor'

# ── Helpers ───────────────────────────────────────────────────────────────────
def pb_auth():
    r = requests.post(f'{PB_URL}/api/collections/_superusers/auth-with-password',
                      json={'identity': PB_EMAIL, 'password': PB_PASSWORD})
    r.raise_for_status()
    return r.json()['token']

def pb_create(token, collection, data, files=None):
    headers = {'Authorization': f'Bearer {token}'}
    if files:
        return requests.post(f'{PB_URL}/api/collections/{collection}/records',
                             headers=headers, data=data, files=files)
    return requests.post(f'{PB_URL}/api/collections/{collection}/records',
                         headers=headers, json=data)

def read_csv(filename):
    path = os.path.join(CSV_DIR, filename)
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def convert_id(old_id):
    num = int(old_id[1:])
    return 'a' + str(num).zfill(14)

def find_local_image(filename):
    """Hitta lokal bildfil, exakt match först, sedan prefix-match."""
    # Exakt match
    matches = glob.glob(f'{IMAGES_DIR}/**/{filename}', recursive=True)
    matches = [m for m in matches if not m.endswith('.import')]
    if matches:
        return matches[0]
    # Om filen har timestamp-suffix (t.ex. A00004_v2_1777638428920.png),
    # försök hitta utan timestamp
    base = os.path.splitext(filename)[0]
    parts = base.split('_')
    if len(parts) >= 3 and parts[-1].isdigit() and len(parts[-1]) > 10:
        clean_name = '_'.join(parts[:-1]) + '.png'
        matches = glob.glob(f'{IMAGES_DIR}/**/{clean_name}', recursive=True)
        matches = [m for m in matches if not m.endswith('.import')]
        if matches:
            return matches[0]
    return None

def open_image(path):
    return open(path, 'rb')

# ── Auth ──────────────────────────────────────────────────────────────────────
print('Authenticating...')
token = pb_auth()
print('OK\n')

# ── 1. Cards ──────────────────────────────────────────────────────────────────
print('=== Cards ===')
cards    = read_csv('cards_rows.csv')
minions  = {r['card_id']: r for r in read_csv('minion_cards_rows.csv')}
spells   = {r['card_id']: r for r in read_csv('spell_cards_rows.csv')}
structs  = {r['card_id']: r for r in read_csv('structure_cards_rows.csv')}

SKIP_FIELDS = {'card_id', 'created_at', 'artwork_path', 'id'}

ok = skip = 0
for c in cards:
    old_id    = c['id']
    new_id    = convert_id(old_id)
    card_type = c.get('card_type', '')

    extra = {}
    if card_type == 'minion'     and old_id in minions: extra = minions[old_id]
    elif card_type == 'spell'    and old_id in spells:  extra = spells[old_id]
    elif card_type == 'structure' and old_id in structs: extra = structs[old_id]

    data = {
        'id':          new_id,
        'name':        c.get('name', ''),
        'mana':        c.get('mana', '0') or '0',
        'card_class':  c.get('card_class', ''),
        'card_type':   card_type,
        'description': c.get('description', ''),
        'rarity':      c.get('rarity', ''),
        'keywords':    c.get('keywords', ''),
        'draft_tag':   c.get('draft_tag', ''),
        'inlagd':      'true' if c.get('inlagd', '').lower() == 'true' else 'false',
    }
    for k, v in extra.items():
        if k not in SKIP_FIELDS and v:
            data[k] = v

    # Bilder
    artwork_path = c.get('artwork_path', '') or ''
    filenames = [p.strip() for p in artwork_path.split(',') if p.strip()]

    files = []
    for fname in filenames:
        local = find_local_image(os.path.basename(fname))
        if local:
            files.append(('artwork', (os.path.basename(local), open_image(local), 'image/png')))
        else:
            print(f'    ! Bild ej hittad: {fname}')

    r = pb_create(token, 'cards', data, files if files else None)
    if r.status_code in (200, 201):
        ok += 1
        imgs = f' +{len(files)} bild(er)' if files else ''
        print(f'  ✓ {old_id} -> {new_id}{imgs}')
    else:
        skip += 1
        print(f'  ✗ {old_id}: {r.text[:150]}')

print(f'\nCards: {ok} OK, {skip} fel\n')

# ── 2. Skills ─────────────────────────────────────────────────────────────────
print('=== Skills ===')
skills = read_csv('skills_rows.csv')

ok = skip = 0
for s in skills:
    data = {
        'name':        s.get('name', ''),
        'description': s.get('description', ''),
        'text':        s.get('text', '') or s.get('description', ''),
    }
    files = []
    img_path = s.get('image_path', '')
    if img_path:
        local = find_local_image(os.path.basename(img_path))
        if local:
            files.append(('image', (os.path.basename(local), open_image(local), 'image/png')))
        else:
            print(f'    ! Skill-bild ej hittad: {img_path}')

    r = pb_create(token, 'skills', data, files if files else None)
    if r.status_code in (200, 201):
        ok += 1
        print(f'  ✓ {s.get("name", "?")}')
    else:
        skip += 1
        print(f'  ✗ {s.get("name", "?")}: {r.text[:150]}')

print(f'\nSkills: {ok} OK, {skip} fel\n')

# ── 3. Game docs ──────────────────────────────────────────────────────────────
print('=== Game docs ===')
docs = read_csv('game_docs_rows.csv')

ok = skip = 0
for d in docs:
    data = {
        'category': d.get('category', ''),
        'title':    d.get('title', ''),
        'body':     d.get('body', ''),
        'tags':     d.get('tags', ''),
        'in_godot': 'true' if d.get('in_godot', '').lower() == 'true' else 'false',
    }
    r = pb_create(token, 'game_docs', data)
    if r.status_code in (200, 201):
        ok += 1
    else:
        skip += 1
        print(f'  ✗ {d.get("title", "?")}: {r.text[:150]}')

print(f'Game docs: {ok} OK, {skip} fel\n')

# ── 4. Card templates ─────────────────────────────────────────────────────────
print('=== Card templates ===')
templates = read_csv('card_templates_rows.csv')

ok = skip = 0
for t in templates:
    try:
        card_data   = json.loads(t.get('card_data', '{}') or '{}')
        field_notes = json.loads(t.get('field_notes', '{}') or '{}')
    except json.JSONDecodeError:
        card_data = {}
        field_notes = {}

    data = {
        'name':        t.get('name', ''),
        'description': t.get('description', ''),
        'card_type':   t.get('card_type', ''),
        'card_data':   json.dumps(card_data),
        'field_notes': json.dumps(field_notes),
        'is_builtin':  'true' if t.get('is_builtin', '').lower() == 'true' else 'false',
    }
    r = pb_create(token, 'card_templates', data)
    if r.status_code in (200, 201):
        ok += 1
    else:
        skip += 1
        print(f'  ✗ {t.get("name", "?")}: {r.text[:150]}')

print(f'Card templates: {ok} OK, {skip} fel\n')

print('=== Migration klar! ===')
