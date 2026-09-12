const DEFAULT_MAX_ENTRIES = 100;

/**
 * Histórico pequeno e serializável para inspeção local do tráfego HTTP.
 * O limite evita que um servidor de desenvolvimento cresça sem fim, mas cada
 * entrada retida mantém o corpo completo que foi enviado ou recebido.
 */
export function createTrafficRecorder({ maxEntries = DEFAULT_MAX_ENTRIES, onRecord } = {}) {
  const limit = Number.isSafeInteger(maxEntries) && maxEntries > 0 ? maxEntries : DEFAULT_MAX_ENTRIES;
  const entries = [];
  let sequence = 0;

  return {
    maxEntries: limit,

    record(event) {
      const entry = {
        sequence: ++sequence,
        recordedAt: new Date().toISOString(),
        ...event,
      };
      entries.push(entry);
      if (entries.length > limit) entries.splice(0, entries.length - limit);
      try {
        onRecord?.(entry);
      } catch (error) {
        console.error('[addon-server] observador de tráfego falhou', error);
      }
      return entry;
    },

    snapshot() {
      return entries.map((entry) => ({ ...entry }));
    },

    clear() {
      entries.length = 0;
    },
  };
}
