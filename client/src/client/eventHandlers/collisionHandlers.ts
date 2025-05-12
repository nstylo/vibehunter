import Phaser from 'phaser';
import { PlayerSprite } from '../objects/PlayerSprite';
import { EnemySprite } from '../objects/EnemySprite';
import ProjectileSprite from '../objects/ProjectileSprite';
import { XpOrb } from '../objects/XpOrb';
import { EntitySprite } from '../objects/EntitySprite';
import { GameEvent } from '../../common/events';
import { FloatingTextManager } from '../ui/FloatingTextManager';


/**
 * Handle collision between projectile and enemy
 */
export function handleProjectileHitEnemy(
    scene: Phaser.Scene,
    obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, 
    obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    player: PlayerSprite | undefined
): void {
    const projectile = obj1 as unknown as ProjectileSprite;
    const enemy = obj2 as unknown as EnemySprite;

    if (!projectile.active || !enemy.active || !projectile.ownerId) return;
    if (player && projectile.ownerId === player.entityId) {
        scene.events.emit(GameEvent.PROJECTILE_HIT_ENTITY, { projectile, target: enemy });
        enemy.takeDamage(projectile.damageAmount, projectile);
        projectile.impact();
    }
}

/**
 * Handle collision between projectile and player
 */
export function handleProjectileHitPlayer(
    scene: Phaser.Scene,
    obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, 
    obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    player: PlayerSprite | undefined,
    enemies: Phaser.Physics.Arcade.Group
): void {
    let projectile: ProjectileSprite | undefined;
    let player_obj: PlayerSprite | undefined;

    // Need to cast to GameObject first to be able to use instanceof
    const gameObj1 = obj1 as unknown as Phaser.GameObjects.GameObject;
    const gameObj2 = obj2 as unknown as Phaser.GameObjects.GameObject;

    if (gameObj1 instanceof ProjectileSprite && gameObj2 instanceof PlayerSprite) {
        projectile = gameObj1;
        player_obj = gameObj2;
    } else if (gameObj2 instanceof ProjectileSprite && gameObj1 instanceof PlayerSprite) {
        projectile = gameObj2;
        player_obj = gameObj1;
    } else {
        // Not a collision between a projectile and a player we are interested in
        return;
    }

    if (!projectile || !player_obj || !projectile.active || !player_obj.active || !projectile.ownerId) return;
    if (projectile.ownerId === player_obj.entityId) return; // Player can't shoot self

    // If projectile owner is one of the enemies, it can damage player
    let isEnemyProjectile = false;
    for (const enemyChild of enemies.getChildren()) {
        const enemyEntity = enemyChild as EntitySprite; // Cast to access entityId
        if (enemyEntity.entityId === projectile.ownerId) {
            isEnemyProjectile = true;
            break;
        }
    }

    if (isEnemyProjectile) {
        scene.events.emit(GameEvent.PROJECTILE_HIT_ENTITY, { projectile, target: player_obj });
        player_obj.takeDamage(projectile.damageAmount, projectile);
        projectile.impact();
    }
}

/**
 * Handle player collecting XP orb
 */
export function handlePlayerCollectXpOrb(
    scene: Phaser.Scene,
    obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
): void {
    const player = obj1 as unknown as PlayerSprite; 
    const orb = obj2 as unknown as XpOrb; // Cast to XpOrb

    if (!orb.active || !orb.body) return; // Orb already collected or no body

    const xpValue = orb.xpValue; // Access directly from XpOrb property

    if (typeof xpValue === 'number' && xpValue > 0) { // Only process if there is XP to gain
        scene.events.emit(GameEvent.XP_ORB_COLLECTED, { amount: xpValue });

        // Display floating XP text
        FloatingTextManager.showFloatingText(
            scene, 
            `+${xpValue} XP`, 
            player.x, 
            player.y - player.displayHeight / 2, 
            '#FFD700'
        ); // Gold color for XP

        // Particle effect if available
        // if (particleSystem) {
        //     particleSystem.playXpOrbCollect(orb.x, orb.y);
        // }
        orb.destroy();
    } else {
        if (xpValue === 0) {
            // Silently destroy 0-value orbs if they somehow get created and collected
            orb.destroy();
        } else {
            console.warn('XP Orb collected without xpValue data or invalid data.');
            orb.destroy(); // Still remove it
        }
    }
}

/**
 * Handle collision between enemies to prevent clumping
 */
export function handleEnemyCollideEnemy(
    obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, 
    obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
): void {
    // Cast to GameObjects 
    const enemy1 = obj1 as unknown as Phaser.GameObjects.GameObject;
    const enemy2 = obj2 as unknown as Phaser.GameObjects.GameObject;
    
    // Dynamic force adjustment to separate overlapping enemies
    if (enemy1 instanceof EnemySprite && enemy2 instanceof EnemySprite) {
        // Skip collision processing if either enemy is inactive or fleeing
        if (!enemy1.active || !enemy2.active || enemy1.isFleeing || enemy2.isFleeing) {
            return;
        }
        
        // Calculate vector between enemies
        const dx = enemy2.x - enemy1.x;
        const dy = enemy2.y - enemy1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if they're too far apart (shouldn't happen with collision)
        if (distance <= 0) return;
        
        // Normalize direction vector
        const nx = dx / distance;
        const ny = dy / distance;
        
        // Calculate separation force based on overlap
        const minSeparation = (enemy1.displayWidth + enemy2.displayWidth) / 3;
        if (distance < minSeparation) {
            const separationForce = (minSeparation - distance) * 8; // Adjust multiplier for stronger effect
            
            // Apply opposing forces to separate them
            if (enemy1.body instanceof Phaser.Physics.Arcade.Body) {
                enemy1.body.velocity.x -= nx * separationForce;
                enemy1.body.velocity.y -= ny * separationForce;
            }
            
            if (enemy2.body instanceof Phaser.Physics.Arcade.Body) {
                enemy2.body.velocity.x += nx * separationForce;
                enemy2.body.velocity.y += ny * separationForce;
            }
        }
    }
} 