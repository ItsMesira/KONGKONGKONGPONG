#!/bin/bash
git pull origin main
npm install
pm2 restart emble-bot
echo "✅ Deployed"
