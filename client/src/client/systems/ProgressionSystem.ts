import type { Scene } from 'phaser';
import type { PlayerSprite } from '../objects/PlayerSprite';
import { type IPlayerStats, DEFAULT_PLAYER_BASE_STATS } from '../interfaces/IPlayerStats';
import type { IUpgradeDefinitions, IUpgradeEffect, 
    IGeneralUpgradeDefinition, IAttackUnlockUpgradeDefinition, 
    IAttackModifyUpgradeDefinition, IGlobalAttackModifyUpgradeDefinition } from '../interfaces/IUpgradeDefinition';
import { DataManager } from '../systems/DataManager';

/**
 * Represents an upgrade choice presented to the player
 */
export interface UpgradeChoice {
    id: string;
    name: string;
    description: string;
    type: 'GENERAL' | 'UNLOCK_ATTACK' | 'MODIFY_ATTACK' | 'MODIFY_ALL_PLAYER_ATTACKS';
    effects?: IUpgradeEffect[];
    attackId?: string;
    targetAttackId?: string;
    maxLevel?: number;
    currentLevel?: number;
}

export class ProgressionSystem {
    private scene: Scene;
    private player: PlayerSprite; // Reference to the player for direct modifications
    public currentStats: IPlayerStats;
    private availableUpgrades: UpgradeChoice[] = [];
    private appliedUpgrades: Map<string, number> = new Map(); // Track upgrades and their levels
    
    // XP and level properties
    private currentXP = 0;
    private currentLevel = 1;
    private xpToNextLevel = 100; // Starting XP required for level 2
    private xpScalingFactor = 1.5; // Each level requires this much more XP

    constructor(scene: Scene, player: PlayerSprite) {
        this.scene = scene;
        this.player = player;
        this.currentStats = { ...DEFAULT_PLAYER_BASE_STATS }; // Start with default stats
        
        // Initialize available upgrades from DataManager
        this.initializeAvailableUpgrades();

        // Emit initial stats so player is synced up from the start
        this.scene.events.emit('playerStatsUpdated', this.currentStats);
    }

    /**
     * Initialize the list of available upgrades from DataManager
     */
    private initializeAvailableUpgrades(): void {
        // Get all upgrades from DataManager
        const dataManager = DataManager.getInstance();
        const upgradeDefinitions = dataManager.getUpgradeDefinitions();
        
        // Transform general upgrades into UpgradeChoice objects
        const generalUpgrades: UpgradeChoice[] = upgradeDefinitions.general_upgrades.map((upgrade: IGeneralUpgradeDefinition) => ({
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description,
            type: 'GENERAL',
            effects: upgrade.effects,
            maxLevel: upgrade.maxLevel || 1,
            currentLevel: 0
        }));
        
        // Transform attack upgrades into UpgradeChoice objects
        const attackUpgrades: UpgradeChoice[] = upgradeDefinitions.attack_upgrades.map((upgrade: any) => {
            // First, check the upgrade type explicitly
            const upgradeType = upgrade.type;
            
            if (upgradeType === 'UNLOCK_ATTACK') {
                // Attack unlock upgrade - check for required properties
                if (!upgrade.attackId) {
                    console.warn(`Attack unlock upgrade ${upgrade.id} missing required attackId property`);
                }
                
                return {
                    id: upgrade.id,
                    name: upgrade.name,
                    description: upgrade.description,
                    type: 'UNLOCK_ATTACK',
                    attackId: upgrade.attackId,
                    maxLevel: upgrade.maxLevel || 1,
                    currentLevel: 0
                };
            } else if (upgradeType === 'MODIFY_ATTACK') {
                // Attack modify upgrade
                if (!upgrade.targetAttackId) {
                    console.warn(`Attack modify upgrade ${upgrade.id} missing required targetAttackId property`);
                }
                
                return {
                    id: upgrade.id,
                    name: upgrade.name,
                    description: upgrade.description,
                    type: 'MODIFY_ATTACK',
                    targetAttackId: upgrade.targetAttackId,
                    effects: upgrade.effects,
                    maxLevel: upgrade.maxLevel || 1,
                    currentLevel: 0
                };
            } else if (upgradeType === 'MODIFY_ALL_ATTACKS' || upgradeType === 'MODIFY_ALL_PROJECTILES' || upgradeType === 'MODIFY_ALL_PLAYER_ATTACKS') {
                // Global attack modify upgrade - handle different type names
                return {
                    id: upgrade.id,
                    name: upgrade.name,
                    description: upgrade.description,
                    type: 'MODIFY_ALL_PLAYER_ATTACKS', // Standardize to the type expected by the application
                    effects: upgrade.effects,
                    maxLevel: upgrade.maxLevel || 1,
                    currentLevel: 0
                };
            } else {
                console.warn(`Unknown attack upgrade type for ${upgrade.id}: ${upgradeType}`);
                // Default to a safe type
                return {
                    id: upgrade.id,
                    name: upgrade.name,
                    description: upgrade.description,
                    type: 'GENERAL',
                    effects: upgrade.effects,
                    maxLevel: upgrade.maxLevel || 1,
                    currentLevel: 0
                };
            }
        });
        
        // Combine all upgrades
        this.availableUpgrades = [...generalUpgrades, ...attackUpgrades];
    }

    /**
     * Get a selection of upgrade choices for the player to choose from
     */
    public getUpgradeChoices(count = 3): UpgradeChoice[] {
        // Get the player's active attack IDs
        const activeAttackIds = this.player.activeAttacks.map(attack => attack.definition.id);
        
        // Filter out upgrades that are at max level
        const eligibleUpgrades = this.availableUpgrades.filter(upgrade => {
            const currentLevel = this.appliedUpgrades.get(upgrade.id) || 0;
            
            // Only include upgrade if below max level
            if (currentLevel >= (upgrade.maxLevel || 1)) {
                return false;
            }
            
            // For attack-specific upgrades, check if player has the required attack
            if (upgrade.type === 'MODIFY_ATTACK' && upgrade.targetAttackId) {
                return activeAttackIds.includes(upgrade.targetAttackId);
            }
            
            // For unlock attack upgrades, make sure the player doesn't already have this attack
            if (upgrade.type === 'UNLOCK_ATTACK' && upgrade.attackId) {
                return !activeAttackIds.includes(upgrade.attackId);
            }
            
            // Include general upgrades and unlock upgrades by default
            return true;
        });
        
        if (eligibleUpgrades.length === 0) {
            console.warn('No eligible upgrades available!');
            return [];
        }
        
        // Split upgrades into categories
        const generalUpgrades = eligibleUpgrades.filter(u => u.type === 'GENERAL');
        const unlockUpgrades = eligibleUpgrades.filter(u => u.type === 'UNLOCK_ATTACK');
        const modifyAttackUpgrades = eligibleUpgrades.filter(u => 
            u.type === 'MODIFY_ATTACK' || u.type === 'MODIFY_ALL_PLAYER_ATTACKS'
        );
        
        // Prioritize unlock upgrades if available
        const prioritizedUpgrades = [];
        
        // Add unlock upgrades first (if any)
        if (unlockUpgrades.length > 0) {
            const shuffledUnlocks = [...unlockUpgrades].sort(() => 0.5 - Math.random());
            prioritizedUpgrades.push(...shuffledUnlocks);
        }
        
        // Then add weapon upgrades and general upgrades
        const otherUpgrades = [...generalUpgrades, ...modifyAttackUpgrades].sort(() => 0.5 - Math.random());
        prioritizedUpgrades.push(...otherUpgrades);
        
        // Return the first 'count' upgrades from the prioritized list
        return prioritizedUpgrades.slice(0, Math.min(count, prioritizedUpgrades.length));
    }

    /**
     * Apply an upgrade to the player
     */
    public applyUpgrade(upgradeId: string): boolean {
        // Find the upgrade
        const upgrade = this.availableUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) {
            console.warn(`Upgrade with ID ${upgradeId} not found`);
            return false;
        }
        
        // Check if already at max level
        const currentLevel = this.appliedUpgrades.get(upgradeId) || 0;
        if (currentLevel >= (upgrade.maxLevel || 1)) {
            console.warn(`Upgrade ${upgradeId} already at max level`);
            return false;
        }
        
        // Apply the upgrade based on its type
        let success = false;
        switch (upgrade.type) {
            case 'GENERAL':
                success = this.applyGeneralUpgrade(upgrade);
                break;
            case 'UNLOCK_ATTACK':
                success = this.applyAttackUnlockUpgrade(upgrade);
                break;
            case 'MODIFY_ATTACK':
                success = this.applyAttackModifyUpgrade(upgrade);
                break;
            case 'MODIFY_ALL_PLAYER_ATTACKS':
                success = this.applyGlobalAttackModifyUpgrade(upgrade);
                break;
            default:
                console.error(`Unknown upgrade type: ${upgrade.type} for upgrade ${upgrade.id}`);
                return false;
        }
        
        if (success) {
            // Update the applied upgrades map
            this.appliedUpgrades.set(upgradeId, currentLevel + 1);
            
            // Update currentLevel on the upgrade object
            upgrade.currentLevel = (upgrade.currentLevel || 0) + 1;
            
            // Notify UI
            this.scene.events.emit('upgradeApplied', {
                upgradeId,
                level: currentLevel + 1
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Apply a general upgrade that affects player stats
     */
    private applyGeneralUpgrade(upgrade: UpgradeChoice): boolean {
        if (!upgrade.effects) {
            console.warn(`General upgrade ${upgrade.id} has no effects`);
            return false;
        }
        
        // Apply each effect to the player's stats
        for (const effect of upgrade.effects) {
            this.applyStatEffect(effect);
        }
        
        // Update player with new stats
        this.scene.events.emit('playerStatsUpdated', this.currentStats);
        
        return true;
    }

    /**
     * Apply an upgrade that unlocks a new attack
     */
    private applyAttackUnlockUpgrade(upgrade: UpgradeChoice): boolean {
        // Ensure this is actually an unlock upgrade with a valid attackId
        if (upgrade.type !== 'UNLOCK_ATTACK') {
            console.error(`Received wrong upgrade type in applyAttackUnlockUpgrade: ${upgrade.type} for upgrade ${upgrade.id}`);
            return false;
        }
        
        if (!upgrade.attackId) {
            console.warn(`Attack unlock upgrade ${upgrade.id} has no attackId`);
            return false;
        }
        
        // Check if attack definition exists - use getInstance() to access the singleton
        const dataManager = DataManager.getInstance();
        const attackDef = dataManager.getAttackDefinition(upgrade.attackId);
        
        if (!attackDef) {
            console.warn(`Attack definition not found for ID: ${upgrade.attackId}`);
            return false;
        }
        
        // Add the attack to the player
        const success = this.player.addAttack(upgrade.attackId);
        
        return success;
    }

    /**
     * Apply an upgrade that modifies a specific attack
     */
    private applyAttackModifyUpgrade(upgrade: UpgradeChoice): boolean {
        if (!upgrade.targetAttackId || !upgrade.effects) {
            console.warn(`Attack modify upgrade ${upgrade.id} is missing targetAttackId or effects`);
            return false;
        }
        
        // Apply each effect to the specific attack
        let allEffectsApplied = true;
        for (const effect of upgrade.effects) {
            const success = this.player.upgradeAttack(
                upgrade.targetAttackId,
                effect.modifier,
                effect.stat,
                effect.value
            );
            
            if (!success) {
                allEffectsApplied = false;
                console.warn(`Failed to apply effect to attack ${upgrade.targetAttackId}:`, effect);
            }
        }
        
        return allEffectsApplied;
    }

    /**
     * Apply an upgrade that modifies all player attacks
     */
    private applyGlobalAttackModifyUpgrade(upgrade: UpgradeChoice): boolean {
        if (!upgrade.effects) {
            console.warn(`Global attack modify upgrade ${upgrade.id} has no effects`);
            return false;
        }
        
        // Get all player attacks
        const attackIds = this.player.activeAttacks.map(attack => attack.definition.id);
        
        if (attackIds.length === 0) {
            console.warn(`Global attack modify upgrade ${upgrade.id} not applied - player has no active attacks`);
            return false;
        }
        
        // Apply each effect to all attacks
        let allEffectsApplied = true;
        for (const attackId of attackIds) {
            for (const effect of upgrade.effects) {
                const success = this.player.upgradeAttack(
                    attackId,
                    effect.modifier,
                    effect.stat,
                    effect.value
                );
                
                if (!success) {
                    allEffectsApplied = false;
                    console.warn(`Failed to apply global effect to attack ${attackId}:`, effect);
                }
            }
        }
        
        return allEffectsApplied;
    }

    /**
     * Apply a single stat effect to the player's stats
     */
    private applyStatEffect(effect: IUpgradeEffect): void {
        const stat = effect.stat as keyof IPlayerStats;
        
        // Skip if not a valid player stat
        if (!(stat in this.currentStats)) {
            console.warn(`Stat ${stat} is not a valid player stat`);
            return;
        }
        
        // Apply the effect based on modifier type
        switch (effect.modifier) {
            case 'FLAT_SET':
                this.currentStats[stat] = effect.value as never;
                break;
            case 'FLAT_ADD':
                this.currentStats[stat] = (this.currentStats[stat] as number + effect.value) as never;
                break;
            case 'PERCENTAGE_MULTIPLY':
                this.currentStats[stat] = (this.currentStats[stat] as number * effect.value) as never;
                break;
            default:
                console.warn(`Unknown modifier type: ${effect.modifier}`);
                break;
        }
    }

    /**
     * Add XP to the player
     */
    public addXp(amount: number): void {
        this.currentXP += amount;
        
        // Check if leveled up
        this.checkLevelUp();
        
        // Emit XP update event for UI
        this.scene.events.emit('xpUpdated', {
            currentXP: this.currentXP,
            currentLevel: this.currentLevel,
            xpToNextLevel: this.xpToNextLevel
        });
    }
    
    /**
     * Check if player has enough XP to level up
     */
    private checkLevelUp(): void {
        if (this.currentXP >= this.xpToNextLevel) {
            // Level up!
            this.currentXP -= this.xpToNextLevel;
            this.currentLevel++;
            
            // Calculate XP needed for next level
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * this.xpScalingFactor);
            
            // Emit level up event
            this.scene.events.emit('playerLevelUp', {
                newLevel: this.currentLevel
            });
            
            // Show upgrade options
            this.showLevelUpUpgrades();
            
            // Check for additional level-ups if we have overflow XP
            this.checkLevelUp();
        }
    }
    
    /**
     * Show upgrade options on level up
     */
    private showLevelUpUpgrades(): void {
        const choices = this.getUpgradeChoices(3);
        if (choices.length > 0) {
            // Launch the Upgrade UI Scene, passing the choices, level, and a reference to this system
            this.scene.scene.launch('UpgradeUIScene', { 
                choices: choices, 
                progressionSystem: this,
                level: this.currentLevel
            });
            
            // We want to bring the upgrade UI to the top to ensure it's visible
            this.scene.scene.bringToTop('UpgradeUIScene');
            
            // Also keep HUD on top if it exists
            if (this.scene.scene.isActive('HudScene')) {
                this.scene.scene.bringToTop('HudScene');
            }
        } else {
            this.resumeGameAfterUpgrade(); 
        }
    }

    /**
     * Resume the game after an upgrade
     */
    public resumeGameAfterUpgrade(): void {
        // Just stop the UI scene since we're no longer pausing the game
        this.scene.scene.stop('UpgradeUIScene');
    }
    
    // Getters for XP and level information
    public getLevel(): number {
        return this.currentLevel;
    }
    
    public getXP(): number {
        return this.currentXP;
    }
    
    public getXPToNextLevel(): number {
        return this.xpToNextLevel;
    }
    
    public getXPPercentage(): number {
        return this.currentXP / this.xpToNextLevel;
    }

    /**
     * Get the count of levels for a specific upgrade
     */
    public getUpgradeLevel(upgradeId: string): number {
        return this.appliedUpgrades.get(upgradeId) || 0;
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        // Clean up any event listeners or timers
    }
} 