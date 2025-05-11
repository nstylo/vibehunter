import type { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import { BaseBehavior } from './BaseBehavior';
import { BehaviorState } from '../interfaces/IBehavior';
import Phaser from 'phaser';

const FLEE_DURATION_MS = 3000; // Flee for 3 seconds
const FLEE_SPEED_MULTIPLIER = 1.2; // Flee slightly faster than normal

export class FleeBehavior extends BaseBehavior {
    public id = BehaviorState.FLEEING;
    private fleeEndTime: number = 0;

    enter(enemy: EnemySprite, target?: PlayerSprite): void {
        // enemy.isFleeing = true; // This will be handled by EnemySprite property
        this.fleeEndTime = enemy.scene.time.now + FLEE_DURATION_MS;
        // Optional: Play a "scared" animation or sound effect
        console.log(`${enemy.enemyType} is fleeing from ${target?.playerId ?? 'danger'}!`);
    }

    update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null | undefined {
        if (!enemy.active || !target || !target.active) {
            if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
                enemy.body.setVelocity(0, 0);
            }
            return BehaviorState.IDLE; // No target or target inactive, go idle
        }

        if (time > this.fleeEndTime) {
            return BehaviorState.IDLE; // Flee duration ended
        }
        
        // Check for stun, similar to other behaviors
        if (enemy.hasStatusEffect('STUN')) {
            if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
                enemy.body.setVelocity(0, 0);
            }
            return null; // Stay in Fleeing state but don't move
        }

        const directionAwayFromTarget = new Phaser.Math.Vector2(enemy.x - target.x, enemy.y - target.y).normalize();
        const fleeSpeed = (enemy.currentStats.maxSpeed ?? 100) * FLEE_SPEED_MULTIPLIER;
        
        if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
            enemy.body.setVelocity(directionAwayFromTarget.x * fleeSpeed, directionAwayFromTarget.y * fleeSpeed);

            // Update facing direction (optional, but good for visuals)
            if (Math.abs(directionAwayFromTarget.x) > Math.abs(directionAwayFromTarget.y)) {
                enemy.setFlipX(directionAwayFromTarget.x < 0);
            }
        }
        
        return null; // Continue fleeing
    }

    exit(enemy: EnemySprite): void {
        // enemy.isFleeing = false; // This will be handled by EnemySprite property
        if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
            // Stop movement if it wasn't already handled by a state transition
            // enemy.body.setVelocity(0, 0); 
        }
        // Optional: Stop "scared" animation or sound effect
        console.log(`${enemy.enemyType} stopped fleeing.`);
    }
} 