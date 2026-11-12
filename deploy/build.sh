#!/bin/sh
# Vercel build step: download the game at one exact commit and publish its game/ folder.
# Usage: sh build.sh <commit-sha>
set -eu
SHA="$1"
rm -rf public src.tgz
mkdir -p public
curl -fsSL "https://codeload.github.com/Hodaifaa/Hodaifaa/tar.gz/$SHA" -o src.tgz
tar -xzf src.tgz --strip-components=2 -C public --wildcards '*/game/*'
rm -f src.tgz
# Stamp the offline cache with the commit, so every release replaces the old files.
sed -i "s/__BUILD__/$(printf %s "$SHA" | cut -c1-12)/" public/sw.js
test -s public/index.html
test -s public/js/app.js
