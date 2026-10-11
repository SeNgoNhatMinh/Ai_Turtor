#!/bin/bash
set -euo pipefail

mkdir -p /usr/share/elasticsearch/data /usr/share/elasticsearch/logs
chown -R elasticsearch:root /usr/share/elasticsearch/data /usr/share/elasticsearch/logs

export ES_JAVA_OPTS="${ES_JAVA_OPTS:--Xms256m -Xmx256m}"

# Elasticsearch turns every environment variable whose name contains a dot
# into a setting. Railway currently has a broken value for one of those
# variables, and that value is written into overrides.yml before startup.
clean_env=()
while IFS= read -r line; do
  name="${line%%=*}"
  case "$name" in
    *.*) continue ;;
    "") continue ;;
  esac
  clean_env+=("$line")
done < <(env)

exec runuser -u elasticsearch -- env -i "${clean_env[@]}" /usr/local/bin/docker-entrypoint.sh eswrapper
