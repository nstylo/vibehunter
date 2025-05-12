// Defines stats that can be directly modified by general player upgrades
export type PlayerStatType = 
    | 'maxHp' 
    | 'maxSpeed' 
    | 'defense' 
    | 'attackCooldownModifier' 
    | 'damageModifier' 
    | 'projectileSpeedModifier'
    | 'projectileSizeModifier'
    | 'areaOfEffectModifier'
    | 'effectDurationModifier'
    | 'xpGainModifier'
    | 'pickupRadiusModifier'
    | 'luck';

// Defines attack properties that can be modified by attack-specific upgrades
export type AttackStatType = 
    | 'damage'
    | 'attackCooldown'
    | 'range'
    | 'projectilesPerShot'
    | 'spreadAngle'
    | 'knockbackForce'
    | 'duration' // For AoE or continuous attacks
    | 'tickRate' // For DoT effects
    | 'areaOfEffect.radius' // Example for nested AoE modification
    | 'areaOfEffect.width'
    | 'areaOfEffect.height';

export type UpgradeableStatType = PlayerStatType | AttackStatType;

export interface IUpgradeEffect {
    stat: UpgradeableStatType;
    modifier: "FLAT_SET" | "FLAT_ADD" | "PERCENTAGE_MULTIPLY"; // Refined modifiers
    value: number;
    // For PERCENTAGE_MULTIPLY: 1.1 means +10%, 0.9 means -10%
    // For FLAT_SET: sets the value directly
    // For FLAT_ADD: adds to the existing value
}

export interface IBaseUpgradeDefinition {
    id: string;
    name: string;
    description: string;
    maxLevel?: number;
    // icon?: string; // Optional: if you have icons for upgrades
}

export interface IGeneralUpgradeDefinition extends IBaseUpgradeDefinition {
    effects: IUpgradeEffect[]; // These will target PlayerStatType
}

export interface IAttackUnlockUpgradeDefinition extends IBaseUpgradeDefinition {
    type: "UNLOCK_ATTACK";
    attackId: string; // ID of the attack to unlock from attacks.json
}

export interface IAttackModifyUpgradeDefinition extends IBaseUpgradeDefinition {
    type: "MODIFY_ATTACK";
    targetAttackId: string; // ID of the attack to modify
    effects: IUpgradeEffect[]; // These will target AttackStatType
}

export interface IGlobalAttackModifyUpgradeDefinition extends IBaseUpgradeDefinition {
    type: "MODIFY_ALL_PLAYER_ATTACKS"; // More specific type
    effects: IUpgradeEffect[]; // These will target AttackStatType for all player attacks
}

// A union type for any kind of attack-related upgrade
export type AttackUpgradeDefinition =
    | IAttackUnlockUpgradeDefinition
    | IAttackModifyUpgradeDefinition
    | IGlobalAttackModifyUpgradeDefinition;

// Main structure for upgrades.json
export interface IUpgradeDefinitions {
    general_upgrades: IGeneralUpgradeDefinition[];
    attack_upgrades: AttackUpgradeDefinition[];
} 