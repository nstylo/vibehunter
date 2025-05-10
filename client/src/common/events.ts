// src/common/events.ts

// Emitted when an entity (player or enemy) attempts to shoot.
// Scene will listen to this to spawn the actual projectile.
export const EVENT_ENTITY_SHOOT_PROJECTILE = 'entity_shoot_projectile';
// { shooter: EntitySprite, projectileType: string, targetPosition?: Phaser.Math.Vector2, direction?: Phaser.Math.Vector2, ownerId: string }

// Emitted after a projectile is created and added to the scene.
export const EVENT_PROJECTILE_SPAWNED = 'projectile_spawned';
// { projectile: ProjectileSprite, ownerId: string }

// Emitted when an entity's takeDamage method is successfully called and health is reduced.
export const EVENT_ENTITY_TAKE_DAMAGE = 'entity_take_damage';
// { target: EntitySprite, damage: number, source: EntitySprite | ProjectileSprite | string, newHp: number }

// Emitted when a projectile collides with a damageable entity and damage is about to be applied.
export const EVENT_PROJECTILE_HIT_ENTITY = 'projectile_hit_entity';
// { projectile: ProjectileSprite, target: EntitySprite }

// Emitted when an entity's HP reaches zero.
export const EVENT_ENTITY_DIED = 'entity_died';
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