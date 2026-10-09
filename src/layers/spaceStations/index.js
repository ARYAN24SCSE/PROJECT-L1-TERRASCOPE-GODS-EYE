import { normalizeSpaceStations } from './model.js';

export function createSpaceStationsLayer({ source, services = {} }) {
  if (typeof source?.getSnapshot !== 'function') {
    throw new TypeError('A space stations source is required');
  }

  let enabled = false;
  let loading = false;
  let error = null;
  let lastUpdate = null;
  let stations = [];
  let selectedId = null;
  let viewer = null;
  let filter = 'all'; // 'all' | 'active' | 'historical'
  let listener = null;
  let request = null;

  const notify = () => {
    try {
      listener?.();
    } catch {
      /* ignore */
    }
  };

  const selected = () =>
    stations.find((station) => station.id === selectedId) || null;

  const layer = {
    id: 'space-stations',
    name: 'Space Stations',
    icon: '🛰️',
    source: 'Launch Library 2',
    updateInterval: 3600_000, // 1 hour refresh interval

    init(nextViewer) {
      viewer = nextViewer;
      stations = [];
      selectedId = null;
      filter = 'all';
      error = null;
      lastUpdate = null;
    },

    enable() {
      enabled = true;
      notify();
    },

    disable() {
      enabled = false;
      request?.abort();
      request = null;
      loading = false;
      error = null;
      selectedId = null;
      notify();
    },

    async update(_viewer, { signal } = {}) {
      if (!enabled) return false;
      request?.abort();
      const controller = new AbortController();
      if (signal?.aborted) controller.abort(signal.reason);
      request = controller;
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      loading = true;
      notify();

      try {
        signal?.throwIfAborted();
        const payload = await source.getSnapshot({ signal: controller.signal });
        if (!enabled || controller.signal.aborted || request !== controller) {
          return false;
        }
        stations = normalizeSpaceStations(payload);
        error = null;
        lastUpdate = Date.now();
        if (selectedId && !stations.some((s) => s.id === selectedId)) {
          selectedId = null;
        }
        return true;
      } catch (cause) {
        if (controller.signal.aborted || request !== controller) return false;
        error = cause?.message || 'Space Stations data unavailable';
        return false;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (request === controller) {
          request = null;
          loading = false;
          notify();
        }
      }
    },

    setParams(params = {}) {
      if (!enabled) return;
      let changed = false;
      if (
        params.filter &&
        ['all', 'active', 'historical'].includes(params.filter)
      ) {
        filter = params.filter;
        changed = true;
      }
      if (params.clear === true || params.stationId === null) {
        selectedId = null;
        changed = true;
      } else if (
        typeof params.stationId === 'string' &&
        stations.some((s) => s.id === params.stationId)
      ) {
        selectedId = params.stationId;
        changed = true;
      }
      if (changed) notify();
    },

    getParams() {
      return {
        filter,
        selectedStationId: selectedId,
      };
    },

    getRowControls() {
      const current = selected();
      const activeCount = stations.filter((s) => s.active).length;
      const decommissionedCount = stations.filter(
        (s) => s.decommissioned,
      ).length;

      const detail = current
        ? `${current.name} · ${current.status} · Orbit: ${current.orbit}`
        : `${stations.length} space stations (${activeCount} active, ${decommissionedCount} de-orbited/decommissioned)`;

      const lines = [];
      if (current) {
        lines.push({
          id: 'status',
          text: `Status: ${current.status} · Orbit: ${current.orbit}`,
        });
        if (current.founded || current.deorbited) {
          const dates = [
            current.founded ? `Launched: ${current.founded}` : null,
            current.deorbited ? `De-orbited: ${current.deorbited}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          lines.push({ id: 'dates', text: dates, muted: true });
        }
        if (current.owners.length > 0) {
          const ownerNames = current.owners
            .map((o) => o.abbrev || o.name)
            .join(', ');
          lines.push({
            id: 'owners',
            text: `Operator: ${ownerNames}`,
            muted: true,
          });
        }
        if (current.activeExpeditions.length > 0) {
          const expNames = current.activeExpeditions
            .map((e) => e.name)
            .join(', ');
          lines.push({
            id: 'expeditions',
            text: `Active Expeditions: ${expNames}`,
          });
        }
        if (current.image) {
          const imgCredit = [
            current.image.credit ? `Credit: ${current.image.credit}` : null,
            current.image.license?.name
              ? `License: ${current.image.license.name}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
          if (imgCredit) {
            lines.push({ id: 'image-credit', text: imgCredit, muted: true });
          }
        }
      }

      const filteredStations = stations.filter((s) => {
        if (filter === 'active') return s.active;
        if (filter === 'historical') return s.decommissioned;
        return true;
      });

      return {
        readout: true,
        summary: {
          label: 'Space Stations · Launch Library 2',
          coverage: 'Global / Low Earth Orbit',
          compact: current
            ? `${current.name} (${current.status})`
            : `${stations.length} space stations`,
          detail,
          status: error || (loading ? 'Loading stations…' : null),
          lines,
          actions: [],
          settings: [],
        },
        list: {
          ariaLabel: 'Space Stations Catalog',
          items: filteredStations.map((station, index) => ({
            id: station.id,
            ordinal: index + 1,
            lead: station.active ? 'ACTIVE' : 'HISTORICAL',
            text: `${station.name} · ${station.status} · ${station.orbit}`,
            active: station.id === selectedId,
            params: { stationId: station.id },
          })),
        },
        chips: [
          {
            id: 'filter-all',
            label: `All (${stations.length})`,
            active: filter === 'all',
            params: { filter: 'all' },
          },
          {
            id: 'filter-active',
            label: `Active (${activeCount})`,
            active: filter === 'active',
            params: { filter: 'active' },
          },
          {
            id: 'filter-historical',
            label: `Historical (${decommissionedCount})`,
            active: filter === 'historical',
            params: { filter: 'historical' },
          },
        ],
        legend: [
          { label: 'Active station', color: '#4cc9f0' },
          { label: 'Decommissioned / De-orbited', color: '#888888' },
        ],
        info: current
          ? `${current.name}\nStatus: ${current.status}\nOrbit: ${current.orbit}${current.description ? `\n\n${current.description}` : ''}`
          : `Space Stations catalog from Launch Library 2. Tracks active and historical space stations, orbit characteristics, launch/de-orbit dates, and active expeditions.`,
      };
    },

    setRowControlsListener(value) {
      listener = typeof value === 'function' ? value : null;
    },

    getStats() {
      return {
        count: stations.length,
        lastUpdate,
        loading,
        error,
        stale: false,
        source: 'Launch Library 2',
      };
    },

    destroy() {
      layer.disable();
      viewer = null;
      stations = [];
      selectedId = null;
      listener = null;
    },
  };

  return layer;
}

export { normalizeSpaceStations } from './model.js';
export { createSpaceStationsSource } from './source.js';
