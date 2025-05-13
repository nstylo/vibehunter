import type { IAttackDefinition } from './IAttackDefinition';

/**
 * Represents a runtime instance of an attack that an entity has.
 * It holds a reference to the base attack definition and any runtime state,
 * such as current cooldown and modifications from upgrades.
 */
export interface IAttackInstance {
    definition: IAttackDefinition;
    currentCooldown: number; // Time in ms remaining until this attack can be used again
    
    // Optional: Store runtime modifications to stats if upgrades modify specific attack instances
    // These would be calculated by applying player's global stats and specific attack upgrades
    // to the definition's base values.
    effectiveDamage?: number;
    effectiveAttackCooldown?: number;
    effectiveRange?: number;
    effectiveProjectilesPerShot?: number;
    effectiveKnockbackForce?: number;
    effectiveAoeRadius?: number;
    effectiveAoeWidth?: number;
    effectiveAoeHeight?: number;
    effectiveDuration?: number;
    effectiveTickRate?: number;
    
    // Optional: lastFiredTimestamp to help manage cooldown logic
    lastFiredTimestamp?: number;
} 