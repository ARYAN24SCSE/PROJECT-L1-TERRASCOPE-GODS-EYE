/**
 * Space Stations Layer Policy and Constants
 */

export const SPACE_STATION_OVERLAY_SOURCE_ID = 'space-stations';

export const SPACE_STATION_SELECTED_OVERLAY_SOURCE_ID =
  'space-stations-selected';

export const SPACE_STATION_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 32,
  collisionCapacity: 16,
  moving: false,
});

export const SPACE_STATION_SELECTED_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 8,
  collisionCapacity: 0,
  moving: false,
});
