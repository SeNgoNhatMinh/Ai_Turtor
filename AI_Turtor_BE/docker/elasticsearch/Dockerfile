FROM elasticsearch:8.13.0

USER root

COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY entrypoint.sh /usr/local/bin/railway-elasticsearch-entrypoint

RUN chmod 0755 /usr/local/bin/railway-elasticsearch-entrypoint \
    && chown root:elasticsearch /usr/share/elasticsearch/config/elasticsearch.yml \
    && chmod 0660 /usr/share/elasticsearch/config/elasticsearch.yml

ENV ES_JAVA_OPTS="-Xms256m -Xmx256m"

ENTRYPOINT ["/usr/local/bin/railway-elasticsearch-entrypoint"]
