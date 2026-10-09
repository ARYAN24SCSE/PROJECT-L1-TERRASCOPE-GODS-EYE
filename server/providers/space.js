/** Satellite and launch-feed middleware for Node development servers. */
export { celestrakProxy } from './space/celestrak.js';
export {
  rocketLaunchesProxy,
  spaceStationsProxy,
  LL2_CACHE_TTL_MS,
  LL2_SPACE_STATIONS_CACHE_TTL_MS,
  launchLibraryRequestHeaders,
} from './space/launch-library.js';
