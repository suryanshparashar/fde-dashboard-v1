/**
 * Number of certification levels per HyperScaler: the single place to change it.
 *
 * Every HyperScaler has DEFAULT_LEVELS levels unless it is listed in LEVELS_BY_HYPERSCALER,
 * e.g. { Azure: 3 } gives Azure learners 3 levels (Completed = L3 done).
 * Rows above a HyperScaler's count (e.g. an L5 row when it has 4) are not counted and are flagged.
 * Levels are fixed (not taken from the data). The snapshot files are not changed by this setting,
 * so a new value also applies when viewing past months.
 */
export interface LevelConfig {
  default: number;
  byHyperscaler: Record<string, number>;
}

export const DEFAULT_LEVELS = 4;

/** Overrides per HyperScaler (canonical names, e.g. 'Azure', 'Red Hat OpenShift'). Empty = all use DEFAULT_LEVELS. */
export const LEVELS_BY_HYPERSCALER: Record<string, number> = {};

export const LEVEL_CONFIG: LevelConfig = { default: DEFAULT_LEVELS, byHyperscaler: LEVELS_BY_HYPERSCALER };

/** Levels for one HyperScaler. */
export const levelsFor = (hyperscaler: string, cfg: LevelConfig = LEVEL_CONFIG): number => cfg.byHyperscaler[hyperscaler] ?? cfg.default;
