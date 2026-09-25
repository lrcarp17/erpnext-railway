# Custom image: Frappe version-16 + apps from apps.json,
# then the Railway one-service production layout (nginx, redis, entrypoint).
# For private repos, set GITHUB_TOKEN build arg and use ${GITHUB_TOKEN} in apps.json URLs.
ARG FRAPPE_BRANCH=version-16
ARG FRAPPE_IMAGE_PREFIX=frappe

FROM ${FRAPPE_IMAGE_PREFIX}/build:${FRAPPE_BRANCH} AS builder

ARG FRAPPE_BRANCH=version-16
ARG FRAPPE_PATH=https://github.com/frappe/frappe
ARG GITHUB_TOKEN=""

USER frappe
COPY --chown=frappe:frappe apps.json /opt/frappe/apps.json.template
RUN envsubst < /opt/frappe/apps.json.template > /opt/frappe/apps.json && rm /opt/frappe/apps.json.template
# apps.json names branches, not commits, so a new push to an app's branch leaves this
# step's cache key unchanged and Docker would reuse the old clone. Railway passes
# service variables to the build, so changing APPS_REVISION (any new value) on the
# ERPNext service forces a fresh clone of every app.
ARG APPS_REVISION=""
RUN echo "railway: fetching apps (APPS_REVISION=${APPS_REVISION:-unset})" \
  && bench init \
      --apps_path=/opt/frappe/apps.json \
      --frappe-branch=${FRAPPE_BRANCH} \
      --frappe-path=${FRAPPE_PATH} \
      --no-procfile \
      --no-backups \
      --skip-redis-config-generation \
      --verbose \
      /home/frappe/frappe-bench \
  && cd /home/frappe/frappe-bench \
  && echo "{}" > sites/common_site_config.json \
  && find apps -mindepth 1 -path "*/.git" | xargs rm -fr

FROM ${FRAPPE_IMAGE_PREFIX}/base:${FRAPPE_BRANCH}

USER frappe
COPY --from=builder --chown=frappe:frappe /home/frappe/frappe-bench /home/frappe/frappe-bench
WORKDIR /home/frappe/frappe-bench
# Move assets to image-layer storage; the Railway volume mounts over sites/.
RUN cp -r sites/assets assets && rm -rf sites/assets

USER root

# Frappe keeps its cache and job queue in Redis. Running both here, as `bench setup
# production` does on a server, saves two services and their private-network wiring.
RUN apt-get update \
    && apt-get install -y --no-install-recommends redis-server \
    && rm -rf /var/lib/apt/lists/*

# nginx sizes `worker_processes auto` from the host's cores (48 on Railway), and that
# many workers alone can run a small plan out of memory. Its log files are symlinks
# to /dev/stdout and /dev/stderr, which the frappe user may not reopen once they are
# pipes from a root process: errors go to the inherited stderr instead, and access
# logs are off (Railway's HTTP logs already have every request).
RUN sed -i -e 's/^worker_processes .*/worker_processes 2;/' \
      -e 's|^error_log .*|error_log stderr;|' \
      -e 's|access_log /var/log/nginx/access.log;|access_log off;|' /etc/nginx/nginx.conf

# The Railway volume mounts over sites/ and hides these; the entrypoint puts them back.
RUN cp sites/apps.txt sites/apps.json /home/frappe/

# A fingerprint of the apps' code, so the entrypoint migrates whenever any app changes,
# not only when an app's version number is bumped (Dealerbase rarely bumps it).
RUN find apps -type f \( -name '*.py' -o -name '*.json' -o -name '*.js' \) \
      -not -path '*/node_modules/*' -print0 | sort -z | xargs -0 sha256sum \
      | sha256sum | cut -c1-16 > /home/frappe/apps.hash

# The image has no bytecode for whoosh, and Python 3.14 compiling it prints invalid
# escape SyntaxWarnings to stderr on every boot, where Railway shows them as errors.
RUN env/bin/python -W ignore -m compileall -q env/lib/python3.*/site-packages/whoosh || true

COPY nginx.conf /templates/nginx/railway.conf.template
COPY --chmod=0755 railway-entrypoint.sh /railway-entrypoint.sh
COPY --chmod=0755 erpnext-backup erpnext-restore /usr/local/bin/

# Starts as root only to chown the Railway volume; every process runs as frappe.
ENTRYPOINT ["/railway-entrypoint.sh"]
CMD []
