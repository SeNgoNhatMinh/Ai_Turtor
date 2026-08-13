FROM docker.n8n.io/n8nio/n8n:latest

USER root

COPY railway-entrypoint.sh /usr/local/bin/railway-n8n-entrypoint
RUN chmod 0755 /usr/local/bin/railway-n8n-entrypoint

ENTRYPOINT ["tini", "--", "/usr/local/bin/railway-n8n-entrypoint"]
CMD ["start"]
