/**
 * Defines a projectile type from projectiles.json
 */
export interface IProjectileDefinition {
    // Required properties
    key: string;               // Unique identifier for the projectile type
    displayName: string;       // Human-readable name
    spriteKey: string;         // Key for the sprite/texture to use
    
    // Physics/gameplay properties
    width: number;             // Visual width
    height: number;            // Visual height
    hitboxWidth?: number;      // Physics hitbox width (defaults to width if not specified)
    hitboxHeight?: number;     // Physics hitbox height (defaults to height if not specified)
    
    // Visual effects
    animationKey?: string;     // Key for animation to play (if any)
    tint?: number;             // Color tint (e.g., 0xff0000 for red)
    alpha?: number;            // Transparency (0-1)
    scaleX?: number;           // X scale factor
    scaleY?: number;           // Y scale factor
    rotationSpeed?: number;    // How fast the projectile rotates
    
    // Particle effects
    trailEmitter?: string;     // Key for particle effect to emit while moving
    impactEmitter?: string;    // Key for particle effect on impact
    
    // Audio
    launchSoundKey?: string;   // Sound to play when fired
    impactSoundKey?: string;   // Sound to play on impact
    
    // Game behavior
    piercing?: boolean;        // Can hit multiple enemies
    maxPierceCount?: number;   // Max number of enemies to pierce (if piercing is true)
    bouncing?: boolean;        // Bounces off walls/obstacles
    maxBounceCount?: number;   // Max number of bounces (if bouncing is true)
    
    // Special effects
    statusEffectKey?: string;  // Key from statusEffects.json to apply on hit
    statusEffectChance?: number; // Chance (0-1) to apply status effect
} 