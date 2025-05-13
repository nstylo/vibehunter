import type { EntitySprite } from '../objects/EntitySprite';

export interface IStatusEffectData {
    id: string;
    name: string;
    type: string;
    duration: number;
    potency?: number;
    customData?: Record<string, any>;
    sourceId?: string;
}

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
    duration: number;
    tickRate?: number;
    canStack?: boolean;
    maxStacks?: number;
    currentStacks?: number;
    potency?: number;
    visualEffect?: string;
    soundEffect?: string;
    statModifiers?: { [key: string]: any }; // Can be number or { add?: number, multiply?: number }
    behavioralFlags?: {
        isStunned?: boolean;
        isRooted?: boolean;
        // Add other behavioral flags as needed (e.g., isSilenced, isDisarmed)
    };
    
    // Lifecycle methods
    onApply: (target: EntitySprite) => void;
    onRemove: (target: EntitySprite) => void;
    onUpdate?: (target: EntitySprite, delta: number) => void;
    onTick?: (target: EntitySprite) => void;
    
    // Optional custom data
    customData?: Record<string, any>;
}

// It might be useful to have a simpler data structure for defining status effects in JSON
// which can then be used to instantiate the actual IStatusEffect classes.
export interface IStatusEffectData extends Omit<IStatusEffect, 'onApply' | 'onUpdate' | 'onTick' | 'onRemove'> {
    type: string; // e.g., "SLOW_EFFECT", "DOT_EFFECT" - used to map to a specific class constructor
    // Any additional properties specific to this type of effect, e.g.:
    // For DOT: tickDamage?: number;
    // For Slow: speedMultiplier?: number;
    customData?: Record<string, any>; // Changed to Record<string, any>
} 