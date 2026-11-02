#!/bin/bash
set -euo pipefail

mkdir -p /usr/share/elasticsearch/data /usr/share/elasticsearch/logs
chown -R elasticsearch:root /usr/share/elasticsearch/data /usr/share/elasticsearch/logs

export ES_JAVA_OPTS="${ES_JAVA_OPTS:--Xms256m -Xmx256m}"
export PORT="${PORT:-9200}"

# Elasticsearch turns every environment variable whose name contains a dot
# into a setting. Railway currently has a broken value for one of those
# variables, and that value is written into overrides.yml before startup. Use
# a small allow-list instead of forwarding Railway's entire environment. The
# runtime configuration lives in elasticsearch.yml, so no dotted setting is
# required here.
echo "Starting Elasticsearch on 0.0.0.0:9200 with persistent data at /usr/share/elasticsearch/data"

exec runuser -u elasticsearch -- env -i \
  HOME=/usr/share/elasticsearch \
  PATH="$PATH" \
  LANG="${LANG:-C.UTF-8}" \
  ES_JAVA_OPTS="$ES_JAVA_OPTS" \
  PORT="$PORT" \
  /usr/local/bin/docker-entrypoint.sh eswrapper
