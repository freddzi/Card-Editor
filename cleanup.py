#!/usr/bin/env python3
"""Rensa alla onödiga thumbnail-filer från cards storage."""

import os

STORAGE_DIR = os.path.expanduser('~/pocketbase/pb_data/storage')
CARDS_COL   = 'pbc_3481593366'
KEEP_SIZE   = '200x300'

storage_path = os.path.join(STORAGE_DIR, CARDS_COL)
deleted = 0

for record_id in os.listdir(storage_path):
    record_path = os.path.join(storage_path, record_id)
    if not os.path.isdir(record_path):
        continue

    for entry in os.listdir(record_path):
        full_path = os.path.join(record_path, entry)

        # Radera thumb_* filer (uppladdade till thumb-fältet, ej thumbs_*)
        if entry.startswith('thumb_') and os.path.isfile(full_path):
            os.remove(full_path)
            deleted += 1
            print(f'  Raderad: {entry}')
            continue

        # Radera thumbs_* filer som råkat bli filer istället för mappar
        if entry.startswith('thumbs_') and os.path.isfile(full_path):
            os.remove(full_path)
            deleted += 1
            print(f'  Raderad (felaktig fil): {entry}')
            continue

        # Inne i thumbs_* mappar: radera alla storlekar utom 200x300
        if entry.startswith('thumbs_') and os.path.isdir(full_path):
            for thumb_file in os.listdir(full_path):
                if not thumb_file.startswith(KEEP_SIZE + '_'):
                    thumb_full = os.path.join(full_path, thumb_file)
                    if os.path.isfile(thumb_full):
                        os.remove(thumb_full)
                        deleted += 1
                        print(f'  Raderad (gammal storlek): {thumb_file}')

print(f'\nKlart: {deleted} filer raderade')
