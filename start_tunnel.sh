#!/bin/bash
GITHUB_TOKEN="DIN_TOKEN_HÄR"
GITHUB_USER="freddzi"
GITHUB_REPO="Card-Editor"
FILE_PATH="pb_url.txt"
LOG="$HOME/cloudflared.log"

# Starta cloudflared
nohup $HOME/cloudflared tunnel --url http://localhost:8091 > "$LOG" 2>&1 &

# Vänta på URL (max 30 sek)
for i in $(seq 1 30); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | tail -1)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Kunde inte hitta URL"
  exit 1
fi

echo "Ny URL: $URL"

# Hämta nuvarande filens SHA (krävs av GitHub API för att uppdatera)
SHA=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_USER/$GITHUB_REPO/contents/$FILE_PATH" \
  | grep '"sha"' | head -1 | cut -d'"' -f4)

# Koda innehållet i base64
CONTENT=$(echo -n "$URL" | base64 -w 0)

# Pusha till GitHub
curl -s -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Update tunnel URL\",\"content\":\"$CONTENT\",\"sha\":\"$SHA\"}" \
  "https://api.github.com/repos/$GITHUB_USER/$GITHUB_REPO/contents/$FILE_PATH"

echo "Klar!"
