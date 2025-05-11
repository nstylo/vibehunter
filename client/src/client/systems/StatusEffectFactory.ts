import type { IStatusEffect, IStatusEffectData } from '../interfaces/IStatusEffect';
import { EntitySprite } from '../objects/EntitySprite';
import ProjectileSprite from '../objects/ProjectileSprite';
import STATUS_EFFECT_DEFINITIONS_RAW from '../definitions/statusEffects.json';
import { SlowEffect } from '../effects/SlowEffect';
import { DamageOverTimeEffect } from '../effects/DamageOverTimeEffect';
import { StunEffect } from '../effects/StunEffect';

// Type for the constructor of a status effect class
export type StatusEffectConstructor = new (data: IStatusEffectData, sourceId?: string) => IStatusEffect;

// Using unknown as an intermediary for safer type assertion from JSON import
const STATUS_EFFECT_DEFINITIONS: IStatusEffectData[] = STATUS_EFFECT_DEFINITIONS_RAW as unknown as IStatusEffectData[];

class StatusEffectFactory {
    private effectDefinitions: Map<string, IStatusEffectData> = new Map();
    private effectRegistry: Map<string, StatusEffectConstructor> = new Map();

    constructor() {
        this.loadDefinitions();
    }

    private loadDefinitions(): void {
        for (const definition of STATUS_EFFECT_DEFINITIONS) {
            if (this.effectDefinitions.has(definition.id)) {
                console.warn(`StatusEffectFactory: Duplicate status effect ID "${definition.id}" found in definitions.`);
            }
            // The definition should conform to IStatusEffectData now with customData included in the interface
            this.effectDefinitions.set(definition.id, definition);
        }
        console.log(`StatusEffectFactory: Loaded ${this.effectDefinitions.size} status effect definitions.`);
    }

    public registerEffectType(type: string, EffectCtor: StatusEffectConstructor): void { // Renamed constructor to EffectCtor
        if (this.effectRegistry.has(type)) {
            console.warn(`StatusEffectFactory: Effect type "${type}" is already registered. Overwriting.`);
        }
        this.effectRegistry.set(type, EffectCtor);
    }

    public createEffect(effectId: string, source?: EntitySprite | ProjectileSprite | string): IStatusEffect | undefined {
        const definition = this.effectDefinitions.get(effectId);
        if (!definition) {
            console.warn(`StatusEffectFactory: No definition found for status effect ID "${effectId}".`);
            return undefined;
        }

        const EffectCtor = this.effectRegistry.get(definition.type);
        if (!EffectCtor) {
            console.warn(`StatusEffectFactory: No class registered for effect type "${definition.type}" (ID: "${effectId}").`);
            return undefined;
        }

        let sourceIdString: string | undefined;
        if (typeof source === 'string') {
            sourceIdString = source;
        } else if (source instanceof EntitySprite) { // Check if it's an EntitySprite (which includes PlayerSprite, EnemySprite)
            sourceIdString = source.entityId;
        } else if (source instanceof ProjectileSprite) { // Check if it's a ProjectileSprite
            sourceIdString = source.ownerId; 
        } else if (source) {
            // Fallback for other types if needed, or could be an error
            console.warn('StatusEffectFactory: Unknown source type for effect.', source);
            // sourceIdString = (source as any).id || (source as any).entityId; // Risky, avoid if possible
        }

        const mutableDefinition: IStatusEffectData = {
            ...definition,
            sourceId: sourceIdString,
        };

        try {
            // The constructor of the effect class should handle copying necessary data from mutableDefinition
            const effectInstance = new EffectCtor(mutableDefinition, sourceIdString);
            return effectInstance;
        } catch (error) {
            console.error(`StatusEffectFactory: Error instantiating effect "${effectId}" of type "${definition.type}":`, error);
            return undefined;
        }
    }

    public getDefinition(effectId: string): IStatusEffectData | undefined {
        return this.effectDefinitions.get(effectId);
    }
}

// Export a singleton instance of the factory
const statusEffectFactory = new StatusEffectFactory();

// --- Effect Type Registrations ---
// This would typically be done in your game's initialization sequence, 
// after the factory is created and effect classes are defined.
statusEffectFactory.registerEffectType('SLOW_EFFECT', SlowEffect);
statusEffectFactory.registerEffectType('DAMAGE_OVER_TIME_EFFECT', DamageOverTimeEffect);
statusEffectFactory.registerEffectType('STUN_EFFECT', StunEffect);
// --------------------------------

export default statusEffectFactory; 