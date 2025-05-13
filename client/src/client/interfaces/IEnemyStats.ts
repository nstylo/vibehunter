import type { IBaseEntityStats } from './IBaseEntityStats';

/**
 * Stats specific to enemies, extending base entity stats.
 */
export interface IEnemyStats extends IBaseEntityStats {
    xpValue: number; // Experience points granted when defeated
    // Add other enemy-specific stats as needed
    // e.g., specific resistances, aggro range modifier
} 