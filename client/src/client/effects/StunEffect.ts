import type { EntitySprite } from '../objects/EntitySprite';
import { BaseStatusEffect } from './BaseStatusEffect';
import type { IStatusEffectData } from '../interfaces/IStatusEffect';

export class StunEffect extends BaseStatusEffect {
    // No specific properties needed for StunEffect if all logic is via behavioralFlags

    // Constructor can be omitted if it only calls super() and does nothing else

    onApply(target: EntitySprite): void {
        // console.log(`StunEffect ${this.id} applied to ${target.entityId}`);
        // The behavioral change (isStunned: true) will be picked up by the entity's
        // movement/action logic when it checks behavioralFlags from active status effects.
        // EntitySprite.recalculateStats() will also be called, though stun might not change numerical stats.
        if (target.body instanceof Phaser.Physics.Arcade.Body) {
            target.body.setVelocity(0, 0); // Immediately stop movement
        }
        // Potentially interrupt current actions here if EntitySprite has an action queue or similar
    }

    onRemove(target: EntitySprite): void {
        // console.log(`StunEffect ${this.id} removed from ${target.entityId}`);
        // Entity will no longer have the 'isStunned' behavioralFlag after recalculateStats
        // and removal from activeStatusEffects.
    }

    // onUpdate could be used to reinforce the stun, e.g., ensure velocity remains zero
    // if other systems might try to move the entity.
    onUpdate(target: EntitySprite, delta: number): void {
        if (target.active && target.body instanceof Phaser.Physics.Arcade.Body) {
            if (target.body.velocity.x !== 0 || target.body.velocity.y !== 0) {
                target.body.setVelocity(0, 0);
            }
        }
    }
} 