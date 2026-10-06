export const REGIONS = ['north', 'south', 'east', 'west', 'central'] as const;
export type Region = typeof REGIONS[number];
export type Reading = { ts: string; region: Region; metric: string; value: number };
