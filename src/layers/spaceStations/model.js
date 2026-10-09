/**
 * Normalize space station payload from Launch Library 2
 * Preserves status, orbit, dates, active expeditions, and image credits/license.
 */
export function normalizeSpaceStations(payload) {
  const stations = Array.isArray(payload) ? payload : payload?.results;
  if (!Array.isArray(stations)) return [];

  return stations.map((station) => {
    const rawImage = station.image || null;
    const license = rawImage?.license || null;
    const image = rawImage?.image_url
      ? {
          imageUrl: rawImage.image_url,
          thumbnailUrl: rawImage.thumbnail_url || rawImage.image_url,
          name: rawImage.name || null,
          credit: rawImage.credit || 'Launch Library 2 / The Space Devs',
          license: {
            id: license?.id ?? null,
            name: license?.name || 'Unknown',
            link: license?.link || null,
          },
          singleUse: Boolean(rawImage.single_use),
        }
      : null;

    const rawExpeditions = Array.isArray(station.active_expeditions)
      ? station.active_expeditions
      : [];

    const activeExpeditions = rawExpeditions.map((exp) => ({
      id: exp.id ?? null,
      name: exp.name || 'Unnamed expedition',
      start: exp.start || null,
      end: exp.end || null,
    }));

    const rawOwners = Array.isArray(station.owners) ? station.owners : [];
    const owners = rawOwners.map((owner) => ({
      id: owner.id ?? null,
      name: owner.name || 'Unknown agency',
      abbrev: owner.abbrev || null,
      country: Array.isArray(owner.country)
        ? owner.country.map((c) => c.name || c.alpha_3_code).filter(Boolean)
        : [],
    }));

    const statusObj = station.status || {};
    const statusName = statusObj.name || 'Unknown';
    const active =
      statusName.toLowerCase() === 'active' || Number(statusObj.id) === 1;
    const decommissioned =
      statusName.toLowerCase() === 'decommissioned' ||
      statusName.toLowerCase() === 'de-orbited' ||
      Number(statusObj.id) === 2 ||
      Number(statusObj.id) === 3;

    return {
      id: String(station.id ?? station.name),
      name: station.name || 'Unnamed Station',
      status: statusName,
      active,
      decommissioned,
      orbit: station.orbit || 'Low Earth Orbit',
      founded: station.founded || null,
      deorbited: station.deorbited || null,
      description: station.description || null,
      type: station.type?.name || null,
      owners,
      activeExpeditions,
      image,
      source: 'Launch Library 2',
    };
  });
}
