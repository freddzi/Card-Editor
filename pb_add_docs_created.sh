#!/bin/bash
# Lägger till tidsstämplar (created/updated) i game_docs, så nya Speldesign-poster får datum.
# Gamla poster får inget datum. Användning: bash pb_add_docs_created.sh [pb_url] [email] [password]
set -e

PB_URL="${1:-$(cat "$(dirname "$0")/pb_url.txt")}"
EMAIL="${2:-}"
PASSWORD="${3:-}"

if [ -z "$EMAIL" ]; then read -p "Admin email: " EMAIL; fi
if [ -z "$PASSWORD" ]; then read -s -p "Admin password: " PASSWORD; echo ""; fi

TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
[ -z "$TOKEN" ] && { echo "Inloggningen misslyckades"; exit 1; }

CURRENT=$(curl -s "$PB_URL/api/collections/game_docs" -H "Authorization: Bearer $TOKEN")
NEW=$(echo "$CURRENT" | python3 -c '
import sys, json
c = json.load(sys.stdin)
names = {f["name"] for f in c["fields"]}
if "created" not in names:
    c["fields"].append({"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False})
if "updated" not in names:
    c["fields"].append({"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True})
print(json.dumps({"fields": c["fields"]}))
')
curl -s -X PATCH "$PB_URL/api/collections/game_docs" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "$NEW" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Klart:', [f['name'] for f in d.get('fields',[])] if 'fields' in d else d)"
