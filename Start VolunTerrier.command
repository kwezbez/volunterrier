#!/bin/bash
# Double-click this file in Finder to start VolunTerrier on your Mac.
# First run installs everything (needs internet, ~2 minutes). Close this window to stop the app.
cd "$(dirname "$0")" || exit 1
clear
echo "🐾  Starting VolunTerrier…"
echo

NODE_LINK="https://nodejs.org/dist/v22.23.4/node-v22.23.4.pkg"
# Finder-launched shells may not have the installer's path
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1 || ! node -v >/dev/null 2>&1; then
  echo "❌  Node.js is missing or doesn't work on this Mac."
  echo "    Install Node 22 (works on macOS 11, 12, 13+) from:"
  echo "    $NODE_LINK"
  echo "    Then double-click this file again."
  open "$NODE_LINK" 2>/dev/null
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi

MAJOR=$(node -p "process.versions.node.split('.')[0]")
MINOR=$(node -p "process.versions.node.split('.')[1]")
if [ "$MAJOR" -lt 20 ] || { [ "$MAJOR" -eq 20 ] && [ "$MINOR" -lt 19 ]; }; then
  echo "❌  Your Node.js ($(node -v)) is too old. Install Node 22 from:"
  echo "    $NODE_LINK"
  open "$NODE_LINK" 2>/dev/null
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
echo "✅  Node.js $(node -v)"

# Create a private settings file once (random secret keeps you logged in across restarts)
if [ ! -f .env ]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  printf "SESSION_SECRET=%s\nAPP_URL=http://localhost:3001\n" "$SECRET" > .env
  echo "✅  Created your private .env settings file"
fi

if [ ! -d node_modules ]; then
  echo "📦  Installing (first run only, about 1–2 minutes)…"
  npm install --no-fund --no-audit || { echo "❌  Install failed. Check your internet connection and try again."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
fi

if [ ! -f dist/index.html ] || [ -n "$(find src index.html -newer dist/index.html 2>/dev/null | head -1)" ]; then
  echo "🔨  Building the website…"
  npm run build >/dev/null 2>&1 || npm run build || { read -n 1 -s -r -p "Build failed. Press any key to close…"; exit 1; }
fi

echo
echo "🌐  VolunTerrier is running at:  http://localhost:3001"
echo "    Your browser will open automatically."
echo "    Keep this window open while you use the app. Close it (or press Ctrl+C) to stop."
echo
( sleep 4; open "http://localhost:3001" ) &
node server/index.js
