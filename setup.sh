#!/bin/bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║   HomeworkMEP — One-time setup          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Google credentials ───────────────────────────────────────────────────
echo "➡️  Paste your Google service account JSON key below, then press Ctrl+D:"
cat > google-credentials.json
echo "✅ Saved google-credentials.json"

# ─── .env ──────────────────────────────────────────────────────────────────
echo ""
echo "➡️  Enter your Discord bot token:"
read -r DISCORD_TOKEN

echo "➡️  Enter your Discord CLIENT_ID:"
read -r CLIENT_ID

echo "➡️  Enter your Discord CLIENT_SECRET (from OAuth2 page):"
read -r CLIENT_SECRET

echo "➡️  Enter your GUILD_ID (server ID):"
read -r GUILD_ID

echo "➡️  Enter your ADMIN_ROLE_ID:"
read -r ADMIN_ROLE_ID

echo "➡️  Enter your GOOGLE_SHEET_ID (from sheet URL):"
read -r GOOGLE_SHEET_ID

SESSION_SECRET=$(openssl rand -hex 32)
BASE_URL="http://localhost:3000"

cat > .env << ENVEOF
DISCORD_TOKEN=${DISCORD_TOKEN}
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}
GUILD_ID=${GUILD_ID}
ADMIN_ROLE_ID=${ADMIN_ROLE_ID}
GOOGLE_SHEET_ID=${GOOGLE_SHEET_ID}
GOOGLE_CREDENTIALS_FILE=google-credentials.json
SESSION_SECRET=${SESSION_SECRET}
BASE_URL=${BASE_URL}
ENVEOF

echo ""
echo "✅ .env created"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setup complete!"
echo "Run: npm install && npm start"
echo "Then open: http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
