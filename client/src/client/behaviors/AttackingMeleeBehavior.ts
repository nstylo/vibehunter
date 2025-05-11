import type { PlayerSprite } from '../objects/PlayerSprite';
import type { IBehavior } from '../interfaces/IBehavior';
import { BehaviorState } from '../interfaces/IBehavior';
import type { EnemySprite } from '../objects/EnemySprite';
import { BaseBehavior } from './BaseBehavior';

export class AttackingMeleeBehavior extends BaseBehavior implements IBehavior {
  public readonly id: BehaviorState = BehaviorState.ATTACKING_MELEE;

  enter(enemy: EnemySprite, target?: PlayerSprite): void {
    // Ensure enemy faces target if target exists
    if (target && enemy.body) {
        if (target.x < enemy.x) {
            enemy.setFlipX(true);
        } else {
            enemy.setFlipX(false);
        }
    }
  }

  update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null | undefined {
    const currentTarget = enemy.targetPlayer; // Behaviors primarily use enemy.targetPlayer

    if (!currentTarget || !currentTarget.active) {
      return BehaviorState.IDLE;
    }

    // Stun check: If stunned, transition to IDLE. IdleBehavior should handle keeping velocity at 0.
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

    if (distanceToTarget <= enemy.meleeAttackRange) {
      enemy.performMeleeAttack(); // performMeleeAttack is public and handles its own cooldown
      // Stay in ATTACKING_MELEE state to allow continuous attacks if target remains in range.
      // The attack method itself has a cooldown.
      return null; 
    }
    // If not in melee range, check if still in sight to chase
    if (distanceToTarget <= enemy.sightRange) { // Target out of melee but still in sight
      return BehaviorState.CHASING;
    }
    
    // If neither in melee range nor in sight range (for chasing), target is lost or too far.
    return BehaviorState.IDLE;
  }

  exit(enemy: EnemySprite): void {
    // console.log(\`Enemy \${enemy.enemyId} exiting ATTACKING_MELEE.\`);
    // No specific actions needed on exit for now. 
    // For example, stopping attack animations would go here if we had them.
  }
} 