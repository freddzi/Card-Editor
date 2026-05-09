#!/usr/bin/env python3
"""Generera card-thumbnails manuellt med Pillow."""

import os
import requests
from PIL import Image

PB_URL      = 'http://localhost:8091'
STORAGE_DIR = os.path.expanduser('~/pocketbase/pb_data/storage')
CARDS_COL   = 'pbc_3481593366'
THUMB_SIZE  = (200, 200)

r = requests.get(f'{PB_URL}/api/collections/cards/records?perPage=500')
r.raise_for_status()
records = r.json().get('items', [])
print(f'{len(records)} kort')

ok = skip = fail = 0
for rec in records:
    artwork = rec.get('artwork', [])
    if not artwork:
        skip += 1
        continue
    filename = artwork[0] if isinstance(artwork, list) else artwork
    rec_dir  = os.path.join(STORAGE_DIR, CARDS_COL, rec['id'])
    orig     = os.path.join(rec_dir, filename)
    thumb    = os.path.join(rec_dir, f'thumbs_{filename}')

    if os.path.exists(thumb):
        skip += 1
        continue
    if not os.path.exists(orig):
        print(f'  ! Fil saknas: {orig}')
        fail += 1
        continue
    try:
        img = Image.open(orig).convert('RGB')
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        img.save(thumb, 'PNG', optimize=True)
        ok += 1
        print(f'  ✓ {rec["id"]}')
    except Exception as e:
        fail += 1
        print(f'  ✗ {rec["id"]}: {e}')

print(f'\nKlart: {ok} skapade, {skip} hoppade över, {fail} fel')
