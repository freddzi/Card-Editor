#!/bin/bash
# Lägger till saknade fält i cards-kollektionen (passive_*, transform_*)
# Användning: bash pb_migrate_add_fields.sh <pb_url> <email> <password>
set -e

PB_URL="${1:-http://192.168.50.24:8091}"
EMAIL="${2:-}"
PASSWORD="${3:-}"

if [ -z "$EMAIL" ]; then read -p "Admin email: " EMAIL; fi
if [ -z "$PASSWORD" ]; then read -s -p "Admin password: " PASSWORD; echo ""; fi

echo "Loggar in..."
RESPONSE=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Auth misslyckades: $RESPONSE"
  exit 1
fi
echo "OK"

H1="Content-Type: application/json"
H2="Authorization: Bearer $TOKEN"

echo "Hämtar nuvarande cards-schema..."
CURRENT=$(curl -s "$PB_URL/api/collections/cards" -H "$H2")

COLL_ID=$(echo "$CURRENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
if [ -z "$COLL_ID" ]; then
  echo "Hittade inte cards-kollektionen: $CURRENT"
  exit 1
fi

echo "Collection ID: $COLL_ID"
echo "Lägger till fält..."

# Hämta befintliga fältnamn och lägg till saknade
python3 - "$CURRENT" "$PB_URL/api/collections/$COLL_ID" "$H2" << 'PYEOF'
import sys, json, urllib.request, urllib.error

current_json = sys.argv[1]
patch_url    = sys.argv[2]
auth_header  = sys.argv[3]

data = json.loads(current_json)
existing = {f["name"] for f in data.get("fields", [])}

new_fields = [
    {"name": "passive_id",         "type": "text"},
    {"name": "passive_arg",        "type": "text"},
    {"name": "passive_value",      "type": "number"},
    {"name": "passive_cap",        "type": "number"},
    {"name": "transform_attack",   "type": "number"},
    {"name": "transform_health",   "type": "number"},
    {"name": "transform_keywords", "type": "text"},
]

added = []
for f in new_fields:
    if f["name"] not in existing:
        data["fields"].append(f)
        added.append(f["name"])

if not added:
    print("Alla fält finns redan — inget att göra.")
    sys.exit(0)

print(f"Lägger till: {', '.join(added)}")

payload = json.dumps(data).encode()
req = urllib.request.Request(patch_url, data=payload, method="PATCH")
req.add_header("Content-Type", "application/json")
req.add_header("Authorization", auth_header)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        names = [f["name"] for f in result.get("fields", [])]
        print(f"✓ Klart! Kollektionen har nu {len(names)} fält.")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP-fel {e.code}: {body}")
    sys.exit(1)
PYEOF

echo "Migration klar."
