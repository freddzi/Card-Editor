#!/bin/bash
# Skapar patch_notes och suggestions-kollektioner i PocketBase
# Kör: bash create_patcher_collections.sh

PB_URL="http://192.168.50.24:8091"
EMAIL="${1}"
PASSWORD="${2}"
if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  read -p "Admin email: " EMAIL
  read -s -p "Admin password: " PASSWORD
  echo ""
fi

RESPONSE=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Auth misslyckades: $RESPONSE"
  exit 1
fi
echo "Inloggad OK"

H1="Content-Type: application/json"
H2="Authorization: Bearer $TOKEN"

create() {
  local name="$1"
  local body="$2"
  code=$(curl -s -o /tmp/pb_out.json -w "%{http_code}" -X POST "$PB_URL/api/collections" \
    -H "$H1" -H "$H2" -d "$body")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "Skapade: $name"
  else
    echo "Fel $name ($code): $(cat /tmp/pb_out.json)"
  fi
}

create "patch_notes" '{
  "name":"patch_notes","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"title","type":"text","required":true},
    {"name":"body","type":"text"}
  ]
}'

create "suggestions" '{
  "name":"suggestions","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"title","type":"text","required":true},
    {"name":"body","type":"text"},
    {"name":"author","type":"text"}
  ]
}'

echo "Klart!"
