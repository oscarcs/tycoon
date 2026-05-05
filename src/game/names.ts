import { Rng } from './random';
import type { Zone } from './types';

const stationPrefixes = ['Aoba', 'Higashi', 'Nishi', 'Minami', 'Kita', 'Sakura', 'Shin', 'Midorigaoka', 'Harumi', 'Takanawa'];
const stationSuffixes = ['Central', 'Heights', 'Harbor', 'Crossing', 'Park', 'Town', 'Market', 'Terminal', 'Gardens', 'Depot'];
const residential = ['Maple Court', 'Sakura House', 'Greenview Mansions', 'Kawase Flats', 'North Terrace', 'Riverbend Homes'];
const commercial = ['Maruzen Arcade', 'Blue Lantern Cafe', 'Kita Books', 'Harbor Clinic', 'Sunline Offices', 'Station Plaza'];
const industrial = ['Yamato Logistics', 'Kosei Foundry', 'Aoba Cold Storage', 'Minato Containers', 'Takara Works', 'East Freight Co.'];

export function stationName(rng: Rng): string {
  return `${rng.pick(stationPrefixes)} ${rng.pick(stationSuffixes)}`;
}

export function buildingName(rng: Rng, zone: Zone): string {
  if (zone === 'commercial') return rng.pick(commercial);
  if (zone === 'industrial') return rng.pick(industrial);
  return rng.pick(residential);
}
