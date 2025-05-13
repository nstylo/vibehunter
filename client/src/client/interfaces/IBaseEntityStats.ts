/**
 * Common base stats for all entities.
 */
export interface IBaseEntityStats {
    maxHp: number;
    currentHp: number; // Runtime value, but good to have defined
    maxSpeed: number;
    defense: number;
    attackCooldownModifier: number; // Multiplier, e.g., 1.0 is normal, 0.8 is 20% faster
    damageModifier: number;         // Multiplier, e.g., 1.0 is normal, 1.2 is 20% more damage
    projectileSpeedModifier: number; // Multiplier
    projectileSizeModifier: number;  // Multiplier
    areaOfEffectModifier: number;    // Multiplier for AoE sizes
    effectDurationModifier: number;  // Multiplier for status effect durations

    // Newly added base stats
    meleeDamage?: number;             // Base damage for melee actions if not specified by a particular attack
    attackCooldown?: number;          // Base cooldown for primary actions/attacks in ms (e.g. for auto-attacks or abilities)
    projectileDamage?: number;        // Base damage for projectiles if not specified by a particular attack
    projectileSpeed?: number;         // Base speed for projectiles
} 