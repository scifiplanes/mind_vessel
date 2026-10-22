#!/bin/bash
# Double-click this file in Finder to host a MIND//VESSEL world.
set -e
cd "$(dirname "$0")"

clear
echo ""
echo "  MIND//VESSEL — starting your world"
echo "  ──────────────────────────────────"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed."
  echo "  Install it from https://nodejs.org (LTS), then double-click this again."
  echo ""
  read -r -p "  Press Enter to close…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First run: installing dependencies…"
  npm install
  echo ""
fi

npm start
echo ""
read -r -p "  World stopped. Press Enter to close…"
