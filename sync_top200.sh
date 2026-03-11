#!/usr/bin/env bash

set -euo pipefail

SRC_DIR="/Users/max/Documents/GitHub/geo/geo_tech_demo/publish_release/"
DST_DIR="/Users/max/Documents/GitHub/top200_publish_release_sync_repo/"

echo "Syncing:"
echo "  from: $SRC_DIR"
echo "  to:   $DST_DIR"

rsync -av --delete \
  --exclude '.git' \
  --exclude '.env' \
  "$SRC_DIR" \
  "$DST_DIR"

echo
echo "Done."
echo "Next:"
echo "  cd $DST_DIR"
echo "  git status"
