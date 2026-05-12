// @ts-expect-error The exporter is a plain Node.js ESM utility used by Docker.
const { formatContainerMetrics } = await import('../infra/container-name-exporter/exporter.mjs');

describe('container name exporter', () => {
  it('exports Docker container names with cAdvisor-compatible ids', () => {
    const metrics = formatContainerMetrics([
      {
        Id: '14bcbf55a0c0e904c504b20b5f185848054907927d1ff85872b4cdc77fe1717c',
        Names: ['/ecommerce-api-1'],
        Labels: {
          'com.docker.compose.service': 'ecommerce-api-1',
          'com.docker.compose.project': 'commerce-ha'
        },
        State: 'running'
      }
    ]);

    expect(metrics).toContain('# HELP docker_container_info Docker container name mapping for cAdvisor metrics');
    expect(metrics).toContain(
      'docker_container_info{id="/docker/14bcbf55a0c0e904c504b20b5f185848054907927d1ff85872b4cdc77fe1717c",container_name="ecommerce-api-1",compose_service="ecommerce-api-1",compose_project="commerce-ha",state="running"} 1'
    );
  });
});
