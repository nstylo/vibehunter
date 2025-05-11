import type { PlayerSprite } from '../objects/PlayerSprite';
import type { IBehavior } from '../interfaces/IBehavior';
import { BehaviorState } from '../interfaces/IBehavior';
import type { EnemySprite } from '../objects/EnemySprite';
import { BaseBehavior } from './BaseBehavior';

export class AttackingRangedBehavior extends BaseBehavior implements IBehavior {
  public readonly id: BehaviorState = BehaviorState.ATTACKING_RANGED;

  enter(enemy: EnemySprite, target?: PlayerSprite): void {
    // console.log(\`Enemy \${enemy.enemyId} entering ATTACKING_RANGED for target \${target?.name}\`);
    // Ensure enemy faces target if target exists
    if (target && enemy.body) {
        if (target.x < enemy.x) {
            enemy.setFlipX(true);
        } else {
            enemy.setFlipX(false);
        }
        // Stop movement when entering attack state, let enemy shoot from current position
        if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
            enemy.body.setVelocity(0, 0);
        }
    }
  }

  update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null | undefined {
    const currentTarget = enemy.targetPlayer;

    if (!currentTarget || !currentTarget.active) {
      return BehaviorState.IDLE;
    }

    if (enemy.hasStatusEffect('STUN')) {
      return BehaviorState.IDLE;
    }

    const distanceToTarget = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      currentTarget.x,
      currentTarget.y
    );

    // Face the target
    if (currentTarget.x < enemy.x) {
        enemy.setFlipX(true);
    } else {
        enemy.setFlipX(false);
    }

    // Check if enemy.rangedAttackRange is defined and target is within it
    if (enemy.rangedAttackRange && distanceToTarget <= enemy.rangedAttackRange) {
      enemy.attemptAutoShoot(); // attemptAutoShoot is public and manages its own timing/cooldown
      // Ranged enemies might stop moving to shoot. Ensure velocity is zero.
      if (enemy.body instanceof Phaser.Physics.Arcade.Body) {
        enemy.body.setVelocity(0, 0);
      }
      return null; // Remain in ATTACKING_RANGED state
    }
    
    // If target is out of rangedAttackRange but within sightRange, chase.
    if (distanceToTarget <= enemy.sightRange) {
      return BehaviorState.CHASING;
    }

    // If target is out of sightRange, go IDLE.
    return BehaviorState.IDLE;
  }

  exit(enemy: EnemySprite): void {
    // console.log(\`Enemy \${enemy.enemyId} exiting ATTACKING_RANGED.\`);
    // No specific actions needed on exit for now. 
    // Future: could stop a continuous beam attack or similar.
  }
} 