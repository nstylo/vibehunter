import type { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import { BehaviorState } from '../interfaces/IBehavior';
import { BaseBehavior } from './BaseBehavior';

export class ChaseTargetBehavior extends BaseBehavior {
    public readonly id = BehaviorState.CHASING;

    enter(enemy: EnemySprite, target?: PlayerSprite): void {
        // console.log(`${enemy.enemyType} entering CHASING state towards ${target?.entityId}`);
        // Nothing specific to do on enter, movement is handled in update
    }

    update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null {
        if (!target || !target.active) {
            // console.log(`${enemy.enemyType} lost target or target became inactive.`);
            return BehaviorState.IDLE; // Or PATROLLING
        }

        const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
        const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);

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
            return null; // Remain in current state (stunned, so no chasing)
        }

        // TODO: Implement flee logic/FleeBehavior transitions more robustly
        // if (enemy.shouldFlee && enemy.shouldFlee(target)) { 
        //     return BehaviorState.FLEEING;
        // }

        // If player is too far, lose sight and go back to idle/patrol
        // Use the enemy's sightRange for losing sight of the player
        if (distanceToPlayer > enemy.sightRange * 1.1) {
            // console.log(`${enemy.enemyType} lost sight of target.`);
            return BehaviorState.IDLE; // Or PATROLLING
        }

        // Determine if in attack range (melee or ranged) - transition to ATTACKING states
        if (enemy.isRanged && enemy.rangedAttackRange && distanceToPlayer <= enemy.rangedAttackRange) {
            // TODO: Implement more sophisticated ranged positioning (e.g. maintain distance)
            // For now, basic transition if in range.
            return BehaviorState.ATTACKING_RANGED;
        }
        if (!enemy.isRanged && distanceToPlayer <= enemy.meleeAttackRange) {
            return BehaviorState.ATTACKING_MELEE;
        }

        // Move towards player if not in attack range or if ranged and needs to close distance
        // (More advanced ranged enemies might kite or maintain distance, handled in ATTACKING_RANGED or here)
        if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
            const speed = enemy.currentStats.maxSpeed; // Use current speed after status effects
            enemy.body.setVelocityX(Math.cos(angleToPlayer) * speed);
            enemy.body.setVelocityY(Math.sin(angleToPlayer) * speed);
        }

        // Flip sprite based on player position
        if (target.x < enemy.x) {
            enemy.setFlipX(true);
        } else {
            enemy.setFlipX(false);
        }

        return null; // Stay in CHASING state
    }

    exit(enemy: EnemySprite): void {
        // console.log(`${enemy.enemyType} exiting CHASING state`);
        // Optionally stop movement if not transitioning to another movement state immediately
        // However, the next state's enter() method should typically handle setting initial velocity.
        // if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
        //     enemy.body.setVelocity(0, 0);
        // }
    }
} 