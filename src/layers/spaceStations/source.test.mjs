import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceStationsSource } from './source.js';
import { createSpaceStationsLayer, normalizeSpaceStations } from './index.js';

test('space stations source rejects malformed snapshots', async () => {
  for (const payload of [{}, { results: null }]) {
    const source = createSpaceStationsSource({
      fetchImpl: async () => new Response(JSON.stringify(payload)),
    });
    await assert.rejects(source.getSnapshot(), /Malformed space stations snapshot/);
  }
});

test('space stations source rejects cancellation during parsing', async () => {
  const controller = new AbortController();
  const source = createSpaceStationsSource({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        controller.abort();
        return { results: [] };
      },
    }),
  });
  await assert.rejects(source.getSnapshot({ signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('space stations model normalizes stations, preserves image credits and active expeditions', () => {
  const payload = {
    count: 2,
    results: [
      {
        id: 1,
        name: 'International Space Station',
        status: { id: 1, name: 'Active' },
        orbit: 'Low Earth Orbit',
        founded: '1998-11-20',
        deorbited: null,
        description: 'Habitable artificial satellite in low Earth orbit.',
        owners: [
          {
            name: 'National Aeronautics and Space Administration',
            abbrev: 'NASA',
            country: [{ name: 'United States of America', alpha_3_code: 'USA' }],
          },
        ],
        active_expeditions: [
          {
            id: 101,
            name: 'Expedition 71',
            start: '2024-04-06T03:53:00Z',
            end: '2024-09-23T00:00:00Z',
          },
        ],
        image: {
          image_url: 'https://example.com/iss.jpg',
          thumbnail_url: 'https://example.com/iss_thumb.jpg',
          credit: 'NASA',
          license: { id: 2, name: 'Public Domain', link: 'https://example.com/license' },
          single_use: false,
        },
      },
      {
        id: 2,
        name: 'Mir',
        status: { id: 2, name: 'De-Orbited' },
        orbit: 'Low Earth Orbit',
        founded: '1986-02-20',
        deorbited: '2001-03-23',
        description: 'Soviet and later Russian space station.',
        owners: [{ name: 'ROSCOSMOS', abbrev: 'RFSA' }],
        active_expeditions: [],
        image: null,
      },
    ],
  };

  const stations = normalizeSpaceStations(payload);
  assert.equal(stations.length, 2);

  const iss = stations[0];
  assert.equal(iss.name, 'International Space Station');
  assert.equal(iss.active, true);
  assert.equal(iss.decommissioned, false);
  assert.equal(iss.orbit, 'Low Earth Orbit');
  assert.equal(iss.founded, '1998-11-20');
  assert.equal(iss.deorbited, null);
  assert.equal(iss.activeExpeditions.length, 1);
  assert.equal(iss.activeExpeditions[0].name, 'Expedition 71');
  assert.equal(iss.image.credit, 'NASA');
  assert.equal(iss.image.license.name, 'Public Domain');
  assert.equal(iss.owners[0].abbrev, 'NASA');

  const mir = stations[1];
  assert.equal(mir.name, 'Mir');
  assert.equal(mir.active, false);
  assert.equal(mir.decommissioned, true);
  assert.equal(mir.deorbited, '2001-03-23');
  assert.equal(mir.image, null);
});

test('space stations layer constructs without fetching and manages lifecycle and selection', async () => {
  let fetchCalled = false;
  const mockSource = {
    async getSnapshot() {
      fetchCalled = true;
      return {
        results: [
          {
            id: 1,
            name: 'Tiangong',
            status: { id: 1, name: 'Active' },
            orbit: 'Low Earth Orbit',
            founded: '2021-04-29',
            owners: [{ name: 'CNSA' }],
            active_expeditions: [{ id: 1, name: 'Shenzhou 18' }],
          },
        ],
      };
    },
  };

  const layer = createSpaceStationsLayer({ source: mockSource });
  assert.equal(fetchCalled, false);
  assert.equal(layer.id, 'space-stations');
  assert.equal(layer.getStats().count, 0);

  layer.init({});
  layer.enable();

  const updateResult = await layer.update({});
  assert.equal(updateResult, true);
  assert.equal(fetchCalled, true);
  assert.equal(layer.getStats().count, 1);

  const controls = layer.getRowControls();
  assert.equal(controls.list.items.length, 1);
  assert.equal(controls.list.items[0].text.includes('Tiangong'), true);

  layer.setParams({ stationId: '1' });
  assert.equal(layer.getParams().selectedStationId, '1');

  const selectedControls = layer.getRowControls();
  assert.equal(selectedControls.summary.lines.some((l) => l.text.includes('Tiangong') || l.text.includes('Active')), true);

  assert.equal(selectedControls.chips.length, 3);
  assert.equal(selectedControls.chips[0].active, true);

  layer.setParams({ filter: 'historical' });
  assert.equal(layer.getParams().filter, 'historical');
  const historicalControls = layer.getRowControls();
  assert.equal(historicalControls.list.items.length, 0);
  assert.equal(historicalControls.chips[2].active, true);

  layer.setParams({ filter: 'active' });
  assert.equal(layer.getParams().filter, 'active');
  const activeControls = layer.getRowControls();
  assert.equal(activeControls.list.items.length, 1);
  assert.equal(activeControls.chips[1].active, true);

  layer.disable();
  assert.equal(layer.getParams().selectedStationId, null);
  layer.destroy();
});

