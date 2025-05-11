import type { EntitySprite } from '../objects/EntitySprite';
import { BaseStatusEffect } from './BaseStatusEffect';
import type { IStatusEffectData } from '../interfaces/IStatusEffect';

export class SlowEffect extends BaseStatusEffect {
    private originalMaxSpeed: number | undefined;

    onApply(target: EntitySprite): void {
        // console.log(`SlowEffect ${this.id} applied to ${target.entityId}`);
        // The actual stat modification is handled by EntitySprite.recalculateStats()
        // based on this.statModifiers. This onApply can be used for immediate,
        // one-off changes or to store pre-effect state if needed for onRemove.
        
        // Example: If we weren't using a central recalculateStats for multipliers,
        // we might do something like this:
        // this.originalMaxSpeed = target.currentStats.maxSpeed;
        // if (this.statModifiers?.maxSpeed) { // Should be a multiplier e.g., 0.7
        //     target.currentStats.maxSpeed *= this.statModifiers.maxSpeed as number;
        // }
    }

    onRemove(target: EntitySprite): void {
        // console.log(`SlowEffect ${this.id} removed from ${target.entityId}`);
        // If we had stored originalMaxSpeed and modified directly:
        // if (this.originalMaxSpeed !== undefined) {
        //     target.currentStats.maxSpeed = this.originalMaxSpeed;
        // }
        // With recalculateStats, removal from activeEffects and recalculation handles restoration.
    }
} 