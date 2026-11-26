# Pinned: the bundled workflows are exported from and tested on n8n 2.33.7.
FROM n8nio/n8n:2.33.7

USER root

COPY AI-tutor-workflow-runtime-fixed.json /opt/ai-tutor-workflows/AI-tutor-workflow-runtime-fixed.json
COPY AI-tutor-v2-proactive-workflows.json /opt/ai-tutor-workflows/AI-tutor-v2-proactive-workflows.json
COPY railway-entrypoint.sh /usr/local/bin/railway-n8n-entrypoint
RUN chmod 0755 /usr/local/bin/railway-n8n-entrypoint

ENTRYPOINT ["tini", "--", "/usr/local/bin/railway-n8n-entrypoint"]
CMD ["start"]
