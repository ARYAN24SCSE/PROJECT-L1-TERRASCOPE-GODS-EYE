/** Read Space Stations data snapshot from local proxy with cancellation support. */
export function createSpaceStationsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function getSpaceStationsSnapshot({ signal } = {}) {
    signal?.throwIfAborted();
    const response = await fetchImpl('/api/space-stations', { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    signal?.throwIfAborted();
    if (!Array.isArray(payload) && !Array.isArray(payload?.results)) {
      throw new Error('Malformed space stations snapshot');
    }
    return {
      payload,
      stale: response.headers?.get?.('x-gev-cache') === 'STALE-ERROR',
    };
  }

  return {
    getSpaceStationsSnapshot,
    async getSnapshot(options) {
      return (await getSpaceStationsSnapshot(options)).payload;
    },
  };
}
