import type { IStatusEffect, IStatusEffectData } from '../interfaces/IStatusEffect';
import type { EntitySprite } from '../objects/EntitySprite';

export abstract class BaseStatusEffect implements IStatusEffect {
    public id: string;
    public type: string; // From IStatusEffectData, indicates the specific type like 'SLOW_EFFECT'
    public name: string;
    public description: string = '';
    public duration: number;
    public tickRate?: number;
    public _lastTickTime?: number;
    public isPersistent?: boolean;
    public canStack: boolean = false;
    public maxStacks?: number;
    public currentStacks?: number;
    public iconAssetKey?: string;
    public sourceId?: string;
    public statModifiers?: { [statKey: string]: number | { add?: number; multiply?: number; }; };
    public behavioralFlags?: { [flag: string]: boolean };
    public customData?: { [key: string]: unknown };
    public potency?: number;
    public visualEffect?: string;
    public soundEffect?: string;

    constructor(data: IStatusEffectData, sourceId?: string) {
        this.id = data.id;
        this.type = data.type;
        this.name = data.name;
        this.description = data.description || '';
        this.duration = data.duration;
        this.tickRate = data.tickRate;
        this._lastTickTime = 0; // Initialize to 0 or based on current time if needed immediately
        this.isPersistent = false; // Using default value since it's not in IStatusEffectData
        this.canStack = data.canStack || false;
        this.maxStacks = data.maxStacks || 1;
        this.currentStacks = data.currentStacks || 1;
        this.iconAssetKey = undefined; // Using default since it's not in IStatusEffectData
        this.sourceId = sourceId || data.sourceId;
        this.statModifiers = data.statModifiers ? { ...data.statModifiers } : undefined;
        this.behavioralFlags = data.behavioralFlags ? { ...data.behavioralFlags } : undefined;
        this.customData = data.customData || undefined;
        this.potency = data.potency;
        this.visualEffect = data.visualEffect;
        this.soundEffect = data.soundEffect;
    }

    // These methods are to be implemented by concrete effect classes
    abstract onApply(target: EntitySprite): void;
    // onUpdate is optional in IStatusEffect, so not abstract here unless all base effects must have it
    // onTick is optional, similar to onUpdate
    abstract onRemove(target: EntitySprite): void;

    // Optional onUpdate and onTick can be provided here if there's common logic,
    // or left for subclasses to implement if they need them.
    onUpdate?(target: EntitySprite, delta: number): void {
        // Base implementation (optional)
    }

    onTick?(target: EntitySprite): void {
        // Base implementation (optional)
    }
} 