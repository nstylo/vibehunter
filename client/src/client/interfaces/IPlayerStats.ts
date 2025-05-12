import type { IBaseEntityStats } from './IBaseEntityStats';

/**
 * Stats specific to the player, extending base entity stats.
 */
export interface IPlayerStats extends IBaseEntityStats {
    xpGainModifier: number;       // Multiplier, e.g., 1.0 is normal, 1.1 is 10% more XP
    pickupRadiusModifier: number; // Multiplier for XP orb pickup range
    luck: number;                 // Affects drop rates, critical chance, etc. (0-100 or similar scale)
    // Add other player-specific stats as needed
    // e.g., healthRegen: number;
}

// Default values for player stats, aligned with IPlayerStats
export const DEFAULT_PLAYER_BASE_STATS: IPlayerStats = {
    maxHp: 100,
    currentHp: 100,
    maxSpeed: 200,
    defense: 0,
    attackCooldownModifier: 1.0,
    damageModifier: 1.0,
    projectileSpeedModifier: 1.0,
    projectileSizeModifier: 1.0,
    areaOfEffectModifier: 1.0,
    effectDurationModifier: 1.0,
    xpGainModifier: 1.0,
    pickupRadiusModifier: 1.0,
    luck: 10, // Example luck value
}; 