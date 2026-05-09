#!/bin/bash
set -e

PB_URL="http://192.168.50.24:8091"
read -p "Admin email: " EMAIL
read -s -p "Admin password: " PASSWORD
echo ""

echo "Authenticating..."
RESPONSE=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Auth failed: $RESPONSE"
  exit 1
fi
echo "OK"

H1="Content-Type: application/json"
H2="Authorization: Bearer $TOKEN"

create() {
  local name="$1"
  local body="$2"
  code=$(curl -s -o /tmp/pb_out.json -w "%{http_code}" -X POST "$PB_URL/api/collections" \
    -H "$H1" -H "$H2" -d "$body")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "created: $name"
  else
    echo "error $name ($code): $(cat /tmp/pb_out.json)"
  fi
}

create "cards" '{
  "name":"cards","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"name","type":"text","required":true},
    {"name":"mana","type":"number"},
    {"name":"card_class","type":"text"},
    {"name":"card_type","type":"select","required":true,"maxSelect":1,"values":["minion","spell","structure"]},
    {"name":"description","type":"text"},
    {"name":"artwork","type":"file","maxSelect":2,"maxSize":10485760},
    {"name":"rarity","type":"text"},
    {"name":"keywords","type":"text"},
    {"name":"draft_tag","type":"text"},
    {"name":"inlagd","type":"bool"},
    {"name":"attack","type":"number"},
    {"name":"health","type":"number"},
    {"name":"subtype","type":"text"},
    {"name":"ability_id","type":"text"},
    {"name":"ability_trigger","type":"text"},
    {"name":"ability_cost","type":"number"},
    {"name":"ability_target_mode","type":"text"},
    {"name":"ability_targeting_mode","type":"text"},
    {"name":"ability_value","type":"number"},
    {"name":"ability_arg","type":"text"},
    {"name":"target_filter","type":"text"},
    {"name":"effect_id","type":"text"},
    {"name":"effect_value","type":"number"},
    {"name":"target_mode","type":"text"},
    {"name":"targeting_mode","type":"text"},
    {"name":"school","type":"text"},
    {"name":"effect_arg","type":"text"},
    {"name":"repeat_count","type":"number"},
    {"name":"repeat_mode","type":"text"},
    {"name":"armor","type":"number"},
    {"name":"maintenance_cost","type":"number"},
    {"name":"repair_cost","type":"number"},
    {"name":"repair_value","type":"number"},
    {"name":"trigger_id","type":"text"},
    {"name":"trigger_value","type":"number"},
    {"name":"trigger_target_mode","type":"text"}
  ]
}'

create "game_docs" '{
  "name":"game_docs","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"category","type":"text"},
    {"name":"title","type":"text","required":true},
    {"name":"body","type":"text"},
    {"name":"tags","type":"text"},
    {"name":"in_godot","type":"bool"}
  ]
}'

create "card_templates" '{
  "name":"card_templates","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"name","type":"text","required":true},
    {"name":"description","type":"text"},
    {"name":"card_type","type":"text"},
    {"name":"card_data","type":"json"},
    {"name":"field_notes","type":"json"},
    {"name":"is_builtin","type":"bool"}
  ]
}'

create "skills" '{
  "name":"skills","type":"base",
  "listRule":"","viewRule":"","createRule":"","updateRule":"","deleteRule":"",
  "fields":[
    {"name":"name","type":"text","required":true},
    {"name":"image","type":"file","maxSelect":1,"maxSize":10485760},
    {"name":"description","type":"text"},
    {"name":"text","type":"text"}
  ]
}'

echo "Done! Collections created."
echo "Now create a user account in PocketBase admin: $PB_URL/_/"
echo "Go to Collections -> users -> New record"
