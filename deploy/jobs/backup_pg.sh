#!/bin/bash

set -xeo pipefail

cd "$(dirname "$0")"

echo "$DATABASE_URL"

if [[ ! -f ./rclone ]]; then
	echo "rclone not found, downloading..."
	curl https://downloads.rclone.org/rclone-current-linux-amd64.zip -o rclone.zip
	unzip rclone.zip
	find . -name rclone -type f -exec mv {} /app \;
	rm -rf rclone.zip rclone-v*
	chmod +x ./rclone
fi

cat > ./rclone.conf << EOF
[b2]
type = b2
account = $B2_ACCOUNT
key = $B2_KEY
hard_delete = true
EOF

cat > ~/.pgpass << EOF
*:*:*:*:$POSTGRES_PASSWORD
EOF
chmod 0600 ~/.pgpass

OUTPUT_FILE="ott-prod-$(date +%Y-%m-%d).sql.gz"
pg_dumpall --no-password -d "$DATABASE_URL" | gzip --best > "$OUTPUT_FILE"
./rclone --progress --config ./rclone.conf --b2-chunk-size 64M --b2-upload-cutoff 100M --checkers 1 --transfers 1 copy "$OUTPUT_FILE" "b2:ott-backups/ott-prod"
rm "$OUTPUT_FILE"
