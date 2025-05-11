import type { Scene } from 'phaser';
import type { PlayerSprite } from '../objects/PlayerSprite';
import { type IPlayerStats, DEFAULT_PLAYER_STATS, type UpgradeChoice, type UpgradeType } from '../../common/PlayerStats';
import UPGRADE_DEFINITIONS from '../definitions/upgrades.json';

// Define the apply functions for each upgrade type
const UPGRADE_APPLY_FUNCTIONS: Record<string, (stats: IPlayerStats) => IPlayerStats> = {
    ms_1: (stats) => ({ ...stats, movementSpeed: stats.movementSpeed * 1.10 }),
    pd_1: (stats) => ({ ...stats, projectileDamage: stats.projectileDamage + 2 }),
    as_1: (stats) => ({ ...stats, attackSpeed: stats.attackSpeed * 0.85 }),
    psize_1: (stats) => ({ ...stats, projectileSize: stats.projectileSize * 1.20 }),
    def_1: (stats) => ({ ...stats, defense: stats.defense + 1 }),
    pspeed_1: (stats) => ({ ...stats, projectileSpeed: stats.projectileSpeed * 1.15 }),
};

export class ProgressionSystem {
    private scene: Scene;
    private player: PlayerSprite; // Reference to the player if direct modifications are needed
    public currentStats: IPlayerStats;
    private availableUpgrades: UpgradeChoice[];
    
    // XP and level properties
    private currentXP = 0;
    private currentLevel = 1;
    private xpToNextLevel = 100; // Starting XP required for level 2
    private xpScalingFactor = 1.5; // Each level requires this much more XP

    constructor(scene: Scene, player: PlayerSprite) {
        this.scene = scene;
        this.player = player;
        this.currentStats = { ...DEFAULT_PLAYER_STATS }; // Start with default stats
        this.availableUpgrades = this.generateInitialUpgrades();

        // Emit initial stats so player is synced up from the start
        this.scene.events.emit('playerStatsUpdated', this.currentStats);
        
        // XP gain is now handled by GameScene calling addXp directly
    }

    private generateInitialUpgrades(): UpgradeChoice[] {
        // These are examples. We can make them more dynamic or load from a config.
        const upgrades: UpgradeChoice[] = UPGRADE_DEFINITIONS.map(def => ({
            ...def,
            type: def.type as UpgradeType, // Cast to UpgradeType
            apply: UPGRADE_APPLY_FUNCTIONS[def.id] || ((stats) => stats) // Fallback to no-op if apply function not found
        }));
        return upgrades;
    }

    public getUpgradeChoices(count = 3): UpgradeChoice[] {
        // For now, just return a random subset. Later, this could be more sophisticated
        // (e.g., no duplicates, tiered upgrades, based on current stats/level).
        const shuffled = [...this.availableUpgrades].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    public applyUpgrade(upgradeId: string): boolean {
        const upgrade = this.availableUpgrades.find(u => u.id === upgradeId);
        if (upgrade) {
            this.currentStats = upgrade.apply(this.currentStats);
            
            this.scene.events.emit('playerStatsUpdated', this.currentStats);
            
            // Potentially update available upgrades (e.g., remove chosen one, offer next level)
            this.updateAvailableUpgrades(upgrade);
            return true;
        }
        return false;
    }

    private updateAvailableUpgrades(chosenUpgrade: UpgradeChoice): void {
        // Example: For now, just remove the chosen one so it's not offered again immediately.
        // In a more complex system, we might replace it with its next level, or manage a pool.
        this.availableUpgrades = this.availableUpgrades.filter(u => u.id !== chosenUpgrade.id);
        
        // If we want to add leveled upgrades, here is where we could add the next level
        // e.g. if chosenUpgrade.level === 1, add the level 2 version of that upgrade.
    }

    // Renamed from gainXP and parameter changed
    public addXp(amount: number): void {
        // Default XP gain if not specified (can be based on enemy type later)
        // const xpAmount = data.amount || 10; // Old way
        
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
    
    // Check if player has enough XP to level up
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
        }
    }
    
    // Show upgrade options on level up
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

    public destroy(): void {
        // REMOVED: this.scene.events.off('enemyKilled', this.gainXP, this);
    }
} 