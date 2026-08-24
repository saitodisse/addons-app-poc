import { describe, expect, it } from 'vitest';
import { HealthChecker, HEALTH_BASE_URLS, manifest } from './index';

/** Cliente falso: 5291 e 5292 OK, 5293 fora do ar. */
function fakeClient() {
  return {
    async getManifest(baseUrl: string) {
      if (baseUrl.includes('5293')) throw new Error('conexão recusada');
      return { id: 'x', version: '1.0.0', name: 'x', description: 'd', author: 'a', license: 'MIT', resources: [] };
    },
  };
}

describe('HealthChecker', () => {
  it('reporta ok para add-ons acessíveis e erro para os que falham', async () => {
    const checker = new HealthChecker(fakeClient(), HEALTH_BASE_URLS);
    const entries = await checker.checkAll();
    expect(entries.length).toBe(HEALTH_BASE_URLS.length);
    const ok = entries.filter((e) => e.ok);
    const bad = entries.filter((e) => !e.ok);
    expect(ok.length).toBe(3); // 5291, 5292, 5294
    expect(bad.length).toBe(1); // 5293
    expect(bad[0].error).toBeTruthy();
    expect(ok[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('mede latência em cada entrada', async () => {
    const checker = new HealthChecker(fakeClient(), ['http://localhost:5291']);
    const [entry] = await checker.checkAll();
    expect(entry.latencyMs).toBeTypeOf('number');
    expect(entry.ok).toBe(true);
  });
});

describe('manifest', () => {
  it('declara o serviço healthCheck', () => {
    expect(manifest.id).toBe('health');
    expect(manifest.contract.services.map((s) => s.id)).toContain('addons.health.health-check');
  });
});
