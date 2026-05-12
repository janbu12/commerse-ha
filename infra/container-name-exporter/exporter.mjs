import http from 'node:http';

const dockerSocketPath = process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock';
const listenPort = Number(process.env.PORT ?? 9500);

function escapeLabel(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export function formatContainerMetrics(containers) {
  const lines = [
    '# HELP docker_container_info Docker container name mapping for cAdvisor metrics',
    '# TYPE docker_container_info gauge'
  ];

  for (const container of containers) {
    const name = (container.Names?.[0] ?? container.Id.slice(0, 12)).replace(/^\//, '');
    const labels = container.Labels ?? {};
    lines.push(
      [
        'docker_container_info{',
        `id="/docker/${escapeLabel(container.Id)}",`,
        `container_name="${escapeLabel(name)}",`,
        `compose_service="${escapeLabel(labels['com.docker.compose.service'] ?? name)}",`,
        `compose_project="${escapeLabel(labels['com.docker.compose.project'] ?? '')}",`,
        `state="${escapeLabel(container.State ?? '')}"`,
        '} 1'
      ].join('')
    );
  }

  return `${lines.join('\n')}\n`;
}

function requestDocker(path) {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: dockerSocketPath, path }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve(JSON.parse(body));
      });
    });

    request.on('error', reject);
    request.end();
  });
}

async function metricsResponse() {
  const containers = await requestDocker('/containers/json?all=1');
  return formatContainerMetrics(containers);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  http
    .createServer(async (request, response) => {
      if (request.url !== '/metrics') {
        response.writeHead(404);
        response.end('not found\n');
        return;
      }

      try {
        response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
        response.end(await metricsResponse());
      } catch (error) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end(`${error instanceof Error ? error.message : 'unknown error'}\n`);
      }
    })
    .listen(listenPort, () => {
      console.log(`container-name-exporter listening on :${listenPort}`);
    });
}
