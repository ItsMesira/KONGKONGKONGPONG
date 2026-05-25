#!/bin/bash
set -e

echo "=== HomeworkMEP Local Test ==="

# 1. Check .env
if [ ! -f .env ]; then
  echo "❌ No .env file found. Create one from .env.example:"
  echo "   cp .env.example .env"
  echo "   nano .env"
  exit 1
fi

# 2. Install deps
echo "📦 Installing dependencies..."
npm install

# 3. Clear old sessions (start fresh)
rm -f data/sessions.json

# 4. Start bot
echo "🚀 Starting bot + WebUI..."
echo "   Admin panel: http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""
npm start
