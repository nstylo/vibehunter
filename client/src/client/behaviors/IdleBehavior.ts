import type { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import { BehaviorState } from '../interfaces/IBehavior';
import { BaseBehavior } from './BaseBehavior';

export class IdleBehavior extends BaseBehavior {
    public readonly id = BehaviorState.IDLE;
    // Remove hardcoded sight range, will use the one from enemy definition
    // private sightRange = 300; // Example: How far the enemy can see the player to start chasing
    private idleEndTime = 0;
    private idleDurationMin = 1000; // ms
    private idleDurationMax = 3000; // ms

    enter(enemy: EnemySprite, target?: PlayerSprite): void {
        // console.log(`${enemy.enemyType} entering IDLE state`);
        if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
            enemy.body.setVelocity(0, 0);
        }
        // Set a random duration for this idle period
        this.idleEndTime = enemy.scene.time.now + Phaser.Math.Between(this.idleDurationMin, this.idleDurationMax);
        // TODO: Play idle animation if available
    }

    update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null {
        if (!target || !target.active) {
            // If no target, or target is inactive, remain idle or switch to PATROLLING eventually
            if (time > this.idleEndTime) {
                // return BehaviorState.PATROLLING; // Or simply reset idle time
                this.idleEndTime = time + Phaser.Math.Between(this.idleDurationMin, this.idleDurationMax);
            }
            return null; // Stay IDLE
        }

        const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);

        // Check for stun effect
        let isStunned = false;
        for (const statusEffect of enemy.activeStatusEffects.values()) {
            if (statusEffect.behavioralFlags?.isStunned) {
                isStunned = true;
                break;
            }
        }
        if (isStunned) {
            if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
                enemy.body.setVelocity(0, 0);
            }
            return null; // Remain in current state (effectively Idle due to stun)
        }

        // Transition to chasing if player is in sight and active
        // Use the enemy's sightRange from enemy definition
        if (distanceToPlayer <= enemy.sightRange) {
            return BehaviorState.CHASING;
        }

        // If idle time is up, could transition to PATROLLING or just reset idle time
        if (time > this.idleEndTime) {
            // For now, just reset idle time. A PATROLLING state could be added.
            this.idleEndTime = time + Phaser.Math.Between(this.idleDurationMin, this.idleDurationMax);
            // Consider slight random movement or turning animation here for more dynamic idling
        }

        return null; // Stay IDLE
    }

    exit(enemy: EnemySprite): void {
        // console.log(`${enemy.enemyType} exiting IDLE state`);
        // Nothing specific to do when exiting idle usually, unless animations need resetting.
    }
} 