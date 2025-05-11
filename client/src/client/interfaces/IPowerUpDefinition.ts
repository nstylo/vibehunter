export interface IPowerUpDefinition {
    id: string; // e.g., "HEALTH_PACK_SMALL"
    name: string; // "Small Health Pack"
    description: string; // "Restores 25 HP."
    textureKey: string; // Asset key for its sprite
    duration?: number; // Optional: for temporary power-ups (ms)

    effects: Array<{
        type: 'APPLY_STATUS_EFFECT';
        statusEffectId: string; // ID of an IStatusEffect to apply
    } | {
        type: 'INSTANT_STAT_CHANGE';
        stat: string; // e.g., 'currentHp'
        value: number; // Amount to add (can be negative)
        isPercentage?: boolean;
    } | {
        type: 'GRANT_TEMPORARY_ABILITY';
        abilityId: string;
    } | {
        type: 'ADD_SCORE' | 'ADD_CURRENCY';
        amount: number;
    }>;
} 