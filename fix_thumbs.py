#!/usr/bin/env python3
"""Ta bort felaktiga thumbs_-filer som blockerar PocketBase thumbnail-generering."""

import os
import requests

STORAGE_DIR = os.path.expanduser('~/pocketbase/pb_data/storage')
CARDS_COL   = 'pbc_3481593366'
PB_URL      = 'http://localhost:8091'
THUMB       = '200x200'

storage_path = os.path.join(STORAGE_DIR, CARDS_COL)

# Ta bort felaktiga thumbs_-filer
deleted = 0
for record_id in os.listdir(storage_path):
    record_path = os.path.join(storage_path, record_id)
    if not os.path.isdir(record_path):
        continue
    for f in os.listdir(record_path):
        full = os.path.join(record_path, f)
        if f.startswith('thumbs_') and os.path.isfile(full):
            os.remove(full)
            deleted += 1
            print(f'  Raderad: {f}')

print(f'\n{deleted} filer raderade')

# Generera thumbnails via PocketBase
print('\nGenererar thumbnails...')
r = requests.get(f'{PB_URL}/api/collections/cards/records?perPage=500')
r.raise_for_status()
records = r.json().get('items', [])

ok = skip = 0
for rec in records:
    artwork = rec.get('artwork', [])
    if not artwork:
        skip += 1
        continue
    filename = artwork[0] if isinstance(artwork, list) else artwork
    url = f'{PB_URL}/api/files/{CARDS_COL}/{rec["id"]}/{filename}?thumb={THUMB}'
    resp = requests.get(url, timeout=60)
    if resp.status_code == 200 and len(resp.content) < 500000:
        ok += 1
        print(f'  ✓ {rec["id"]}')
    else:
        skip += 1

print(f'\nKlart: {ok} thumbnails genererade, {skip} hoppade över')
