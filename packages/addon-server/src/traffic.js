const DEFAULT_MAX_ENTRIES = 100;

/**
 * Small serializable history for local HTTP traffic inspection.
 * The limit keeps a development server from growing indefinitely, while each
 * retained entry keeps the complete body that was sent or received.
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
        console.error('[addon-server] traffic observer failed', error);
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
