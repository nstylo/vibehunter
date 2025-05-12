// src/common/events.ts

// Define an enum for all game events
export enum GameEvent {
    // Scene/Entity Interaction Events
    ENTITY_SHOOT_PROJECTILE = 'entity_shoot_projectile', // Emitted when an entity (player or enemy) attempts to shoot. Scene listens to spawn projectile.
    PROJECTILE_SPAWNED = 'projectile_spawned',           // Emitted after a projectile is created and added to the scene.
    ENTITY_TAKE_DAMAGE = 'entity_take_damage',           // Emitted when an entity's takeDamage method is successful and health is reduced.
    PROJECTILE_HIT_ENTITY = 'projectile_hit_entity',     // Emitted when a projectile collides with a damageable entity before damage.
    ENTITY_DIED = 'entity_died',                         // Emitted when an entity's HP reaches zero.
    XP_ORB_COLLECTED = 'xpOrbCollected',                 // Emitted when a player collects an XP orb.

    // Progression/Stat Events
    PLAYER_STATS_UPDATED = 'playerStatsUpdated',         // Emitted when player base stats are updated (e.g., after level up).
    XP_UPDATED = 'xpUpdated',                           // Emitted when the player gains XP.
    PLAYER_LEVEL_UP = 'playerLevelUp',                   // Emitted when the player levels up.

    // Wave/Spawner Events
    WAVE_START = 'waveStart',                           // Emitted when a new wave starts.
    ENEMY_DEFEATED_IN_WAVE = 'enemyDefeatedInWave',     // Emitted when an enemy belonging to the current wave is defeated.
    WAVE_CLEAR = 'waveClear',                           // Emitted when all enemies in the current wave are defeated.
    ALL_WAVES_CLEARED = 'allWavesCleared',               // Emitted when all defined waves are cleared.

    // HUD Update Events
    HUD_READY = 'hudReady',                             // Emitted by the HUD scene when it's ready.
    UPDATE_HUD = 'updateHud',                           // Emitted to update general HUD elements (HP, XP, Level, Kills).
    UPDATE_WAVE_HUD = 'updateWaveHud',                   // Emitted to update wave-specific HUD elements (Wave #, Enemies Remaining).
    NEW_WAVE_STARTED_HUD = 'newWaveStartedHud',           // Emitted specifically to show the "Wave X Started" message.
    WAVE_CLEAR_HUD = 'waveClearHud',                     // Emitted specifically to show the "Wave Cleared" message.
    ALL_WAVES_CLEARED_HUD = 'allWavesClearedHud',         // Emitted specifically to show the "All Waves Cleared" message.

    // Network Events (Potentially move to a network-specific enum if needed)
    NETWORK_CONNECTED = 'connected',                     // Emitted by NetworkSystem on successful connection.
    NETWORK_MESSAGE_RECEIVED = 'messageReceived',         // Emitted by NetworkSystem when a message arrives.
    NETWORK_DISCONNECTED = 'disconnected',                 // Emitted by NetworkSystem on disconnection.

    // Scene Management Events (Example, adjust as needed)
    GAME_OVER = 'gameOver',                              // Could be emitted when the player dies to signal game over sequence.

    // Input System Events (Example)
    // DEBUG_TOGGLE_PRESSED = 'debugTogglePressed',      // Example if InputController emitted events instead of direct checks.
}

// --- Example Payloads (Keep for reference, but don't export constants) ---
// Emitted when an entity (player or enemy) attempts to shoot.
// Scene will listen to this to spawn the actual projectile.
// export const EVENT_ENTITY_SHOOT_PROJECTILE = 'entity_shoot_projectile';
// { shooter: EntitySprite, projectileType: string, targetPosition?: Phaser.Math.Vector2, direction?: Phaser.Math.Vector2, ownerId: string }

// Emitted after a projectile is created and added to the scene.
// export const EVENT_PROJECTILE_SPAWNED = 'projectile_spawned';
// { projectile: ProjectileSprite, ownerId: string }

// Emitted when an entity's takeDamage method is successfully called and health is reduced.
// export const EVENT_ENTITY_TAKE_DAMAGE = 'entity_take_damage';
// { target: EntitySprite, damage: number, source: EntitySprite | ProjectileSprite | string, newHp: number }

// Emitted when a projectile collides with a damageable entity and damage is about to be applied.
// export const EVENT_PROJECTILE_HIT_ENTITY = 'projectile_hit_entity';
// { projectile: ProjectileSprite, target: EntitySprite }

// Emitted when an entity's HP reaches zero.
// export const EVENT_ENTITY_DIED = 'entity_died';
// { entity: EntitySprite, killer?: EntitySprite | ProjectileSprite }

// --- Example Payloads (for reference, not part of this file) ---
/*
Interface for EVENT_ENTITY_SHOOT_PROJECTILE payload:
interface EntityShootProjectilePayload {
    shooter: any; // Typically PlayerSprite or EnemySprite
    projectileType: string; // e.g., 'bullet', 'laser'
    ownerId: string; // Entity ID of the shooter
    targetPosition?: { x: number, y: number }; // Optional target position
    direction?: { x: number, y: number }; // Optional direction vector
}

Interface for EVENT_PROJECTILE_SPAWNED payload:
interface ProjectileSpawnedPayload {
    projectile: any; // ProjectileSprite instance
    ownerId: string; // Entity ID of the shooter
}

Interface for EVENT_ENTITY_TAKE_DAMAGE payload:
interface EntityTakeDamagePayload {
    target: any; // PlayerSprite or EnemySprite instance that took damage
    damage: number;
    newHp: number;
    source: any | string; // The projectile, entity, or cause of damage (e.g., 'trap')
}

Interface for EVENT_PROJECTILE_HIT_ENTITY payload:
interface ProjectileHitEntityPayload {
    projectile: any; // ProjectileSprite instance
    target: any; // PlayerSprite or EnemySprite instance that was hit
}

Interface for EVENT_ENTITY_DIED payload:
interface EntityDiedPayload {
    entity: any; // PlayerSprite or EnemySprite instance that died
    killer?: any; // The projectile or entity that caused the death
}
*/ 