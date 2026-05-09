#!/usr/bin/env python3
"""Ladda upp manuella thumbnails till thumb-fältet i PocketBase."""

import os
import getpass
import requests

PB_URL      = 'http://localhost:8091'
STORAGE_DIR = os.path.expanduser('~/pocketbase/pb_data/storage')
CARDS_COL   = 'pbc_3481593366'

password = getpass.getpass('PocketBase admin password: ')
r = requests.post(f'{PB_URL}/api/collections/_superusers/auth-with-password',
                  json={'identity': 'freddzi@admin.com', 'password': password})
r.raise_for_status()
token = r.json()['token']
headers = {'Authorization': f'Bearer {token}'}

r = requests.get(f'{PB_URL}/api/collections/cards/records?perPage=500', headers=headers)
r.raise_for_status()
records = r.json().get('items', [])
print(f'{len(records)} kort')

ok = skip = fail = 0
for rec in records:
    if rec.get('thumb'):
        skip += 1
        continue
    artwork = rec.get('artwork', [])
    if not artwork:
        skip += 1
        continue
    filename = artwork[0] if isinstance(artwork, list) else artwork
    thumb_path = os.path.join(STORAGE_DIR, CARDS_COL, rec['id'], f'thumbs_{filename}')
    if not os.path.exists(thumb_path) or os.path.isdir(thumb_path):
        skip += 1
        continue
    with open(thumb_path, 'rb') as f:
        resp = requests.patch(f'{PB_URL}/api/collections/cards/records/{rec["id"]}',
                              headers=headers,
                              files={'thumb': (f'thumb_{filename}', f, 'image/png')})
    if resp.status_code in (200, 201):
        ok += 1
        print(f'  ✓ {rec["id"]}')
    else:
        fail += 1
        print(f'  ✗ {rec["id"]}: {resp.text[:100]}')

print(f'\nKlart: {ok} uppladdade, {skip} hoppade över, {fail} fel')
