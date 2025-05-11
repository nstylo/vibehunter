import type { EntitySprite } from '../objects/EntitySprite';

export interface IStatusEffect {
    id: string; // Unique ID, e.g., "SLOW_MOVEMENT_TIER_1"
    name: string; // Display name, e.g., "Slowed"
    description: string; // "Reduces movement speed by 30%."
    duration: number; // Milliseconds; -1 for indefinite or until manually removed
    tickRate?: number; // Optional: how often onTick is called (ms)
    _lastTickTime?: number; // Internal: tracks the last time onTick was called
    isPersistent?: boolean; // Does it last across game sessions/levels?
    canStack: boolean; // Can multiple instances of this exact effect apply?
    maxStacks?: number;
    currentStacks?: number;
    iconAssetKey?: string; // For UI display
    sourceId?: string; // ID of the entity or item that applied it

    // --- Core Logic ---
    onApply(target: EntitySprite): void; // Called when the effect is first applied
    onUpdate?(target: EntitySprite, delta: number): void; // Called every frame (use sparingly)
    onTick?(target: EntitySprite): void; // Called if tickRate is defined
    onRemove(target: EntitySprite): void; // Called when duration ends or effect is dispelled

    // --- Stat Modification ---
    // Defines how this effect modifies the target's base stats
    statModifiers?: {
        // Example: speedMultiplier: 0.7, damageTakenMultiplier: 1.2
        [statKey: string]: number | { add?: number; multiply?: number; };
    };

    // --- Behavior Modification (Optional) ---
    // E.g., forceFlee?: boolean; stun?: boolean;
    behavioralFlags?: { [flag: string]: boolean };
}

// It might be useful to have a simpler data structure for defining status effects in JSON
// which can then be used to instantiate the actual IStatusEffect classes.
export interface IStatusEffectData extends Omit<IStatusEffect, 'onApply' | 'onUpdate' | 'onTick' | 'onRemove'> {
    type: string; // e.g., "SLOW_EFFECT", "DOT_EFFECT" - used to map to a specific class constructor
    // Any additional properties specific to this type of effect, e.g.:
    // For DOT: tickDamage?: number;
    // For Slow: speedMultiplier?: number;
    customData?: { [key: string]: unknown }; // Changed to unknown
} 