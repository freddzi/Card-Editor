#!/usr/bin/env python3
"""Pre-generera alla card-thumbnails via localhost."""

import requests

PB_URL = 'http://192.168.50.24:8091'
THUMB   = '200x300'

r = requests.get(f'{PB_URL}/api/collections/cards/records?perPage=500&fields=id,artwork,collectionId')
r.raise_for_status()
records = r.json().get('items', [])

print(f'{len(records)} kort hittade')

ok = fail = 0
for rec in records:
    col_id  = rec.get('collectionId', 'cards')
    rec_id  = rec['id']
    artwork = rec.get('artwork', [])
    if not artwork:
        continue
    filename = artwork[0] if isinstance(artwork, list) else artwork
    url = f'{PB_URL}/api/files/{col_id}/{rec_id}/{filename}?thumb={THUMB}'
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            ok += 1
            print(f'  ✓ {rec_id}')
        else:
            fail += 1
            print(f'  ✗ {rec_id}: {resp.status_code}')
    except Exception as e:
        fail += 1
        print(f'  ✗ {rec_id}: {e}')

print(f'\nKlart: {ok} ok, {fail} fel')
