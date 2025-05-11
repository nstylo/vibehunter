import type { EntitySprite } from '../objects/EntitySprite';
import { BaseStatusEffect } from './BaseStatusEffect';
import type { IStatusEffectData } from '../interfaces/IStatusEffect';

export class DamageOverTimeEffect extends BaseStatusEffect {
    private damagePerTick: number;

    constructor(data: IStatusEffectData, sourceId?: string) {
        super(data, sourceId);
        // Retrieve damagePerTick from customData, with a fallback
        this.damagePerTick = (this.customData?.damagePerTick as number) || 0;
        if (this.damagePerTick === 0) {
            console.warn(`DamageOverTimeEffect ${this.id} has 0 damagePerTick. Check definition.`);
        }
    }

    onApply(target: EntitySprite): void {
        // console.log(`DamageOverTimeEffect ${this.id} applied to ${target.entityId}. Damage per tick: ${this.damagePerTick}`);
        // No immediate stat change, relies on onTick
    }

    onTick(target: EntitySprite): void {
        if (target.active && target.currentStats.hp > 0) {
            // console.log(`DamageOverTimeEffect ${this.id} ticking on ${target.entityId} for ${this.damagePerTick} damage.`);
            target.takeDamage(this.damagePerTick, this.sourceId || this.id);
            // Note: takeDamage will handle health bar updates and death
        }
    }

    onRemove(target: EntitySprite): void {
        // console.log(`DamageOverTimeEffect ${this.id} removed from ${target.entityId}`);
        // No specific stat restoration needed beyond what recalculateStats handles if any base stats were altered (unlikely for pure DOT).
    }
} 