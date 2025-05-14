import type { EntitySprite } from '../objects/EntitySprite';
import type ProjectileSprite from '../objects/ProjectileSprite';

/**
 * Defines a status effect definition as loaded from JSON
 */
export interface IStatusEffectDefinition {
    id: string;
    name: string;
    description: string;
    type: string;
    durationMs?: number;
    defaultPotency?: number;
    isPeriodic?: boolean;
    defaultTickRateMs?: number;
    visualEffect?: string;
    soundEffect?: string;
}

/**
 * Defines a runtime status effect that can be applied to an entity
 */
export interface IStatusEffect {
    id: string;
    name: string;
    description?: string;
    type: string;
    duration: number; // Duration in milliseconds
    tickRate?: number; // Tick rate in milliseconds for periodic effects
    canStack?: boolean;
    maxStacks?: number;
    currentStacks?: number;
    potency?: number;
    refreshable?: boolean; // Added refreshable property
    visualEffect?: string;
    soundEffect?: string;
    statModifiers?: { [key: string]: number | { add?: number; multiply?: number } }; // Updated type
    behavioralFlags?: {
        isStunned?: boolean;
        isRooted?: boolean;
        // Add other behavioral flags as needed (e.g., isSilenced, isDisarmed)
    };
    
    // Lifecycle methods
    onApply: (target: EntitySprite, source?: EntitySprite | ProjectileSprite | string) => void; // Updated signature
    onRemove: (target: EntitySprite) => void;
    onUpdate?: (target: EntitySprite, delta: number) => void;
    onTick?: (target: EntitySprite) => void;
    
    // Optional custom data
    customData?: Record<string, unknown>; // Updated type
}

export interface IStatusEffectData extends Omit<IStatusEffect, 'onApply' | 'onUpdate' | 'onTick' | 'onRemove'> {
    type: string; // e.g., "SLOW_EFFECT", "DOT_EFFECT" - used to map to a specific class constructor
    // Any additional properties specific to this type of effect, e.g.:
    // For DOT: tickDamage?: number;
    // For Slow: speedMultiplier?: number;
    customData?: Record<string, unknown>; // Updated type, ensures consistency with IStatusEffect
} 