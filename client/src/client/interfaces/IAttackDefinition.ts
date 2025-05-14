export interface IAreaOfEffect {
    shape: "CIRCLE" | "CONE" | "BOX";
    radius?: number; // For CIRCLE
    width?: number;  // For CONE (base width) or BOX
    height?: number; // For CONE (length) or BOX
}

export interface IStatusEffectApplication {
    effectType: string; // Key from statusEffects.json
    duration: number; // milliseconds
    potency?: number; // e.g., damage per tick, slow percentage (normalized, e.g., 0.3 for 30%)
    // Add other relevant properties for status effects if needed
}

export interface IAttackDefinition {
    id: string;
    name: string;
    type: "MELEE" | "RANGED" | "SUPPORT" | "BUFF_SELF" | "RANGED_AREA_DENIAL" | "MELEE_AREA_CONTINUOUS"; // Expanded types
    damage?: number;
    healAmount?: number; // For SUPPORT type
    attackCooldown: number; // milliseconds
    range: number; // For MELEE: attack radius; For RANGED: projectile travel distance or targetting range
    
    // Ranged specific
    projectileType?: string; // Key from projectiles.json
    projectilesPerShot?: number;
    spreadAngle?: number; // Angle in degrees for spread if projectilesPerShot > 1
    knockbackForce?: number;
    projectileSpeed?: number; // Speed of the projectile

    // Area of Effect
    areaOfEffect?: IAreaOfEffect;
    
    // For area denial or continuous attacks
    duration?: number; // e.g., how long a puddle lasts or a continuous beam is active
    tickRate?: number; // For damage/effects over time, e.g., for continuous or DoT from area denial

    // Status Effects
    statusEffectOnHit?: IStatusEffectApplication;
    statusEffectOnSelf?: IStatusEffectApplication; // For BUFF_SELF type

    // Visuals & Audio (can be overridden from projectile for ranged)
    hitParticleEffect?: string;
    hitSoundKey?: string;

    // Special properties for game logic
    targetType?: "ENEMY" | "ALLY" | "SELF"; // For SUPPORT or BUFF_SELF
    notes?: string; // For developer notes, e.g., special script interactions
    delayBeforeImpact?: number; // For targeted AOE like mortar
} 