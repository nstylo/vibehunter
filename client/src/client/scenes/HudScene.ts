import Phaser from 'phaser';
import type NetworkSystem from '../systems/NetworkSystem';

export default class HudScene extends Phaser.Scene {
    private xpText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private killCountText!: Phaser.GameObjects.Text;
    private xpBarBackground!: Phaser.GameObjects.Rectangle;
    private xpBarFill!: Phaser.GameObjects.Rectangle;
    private networkSystem: NetworkSystem | undefined;
    private xpBarMaxWidth: number = 0; // To store max width for the XP bar fill
    
    // XP tracking
    private currentXp = 0;
    private nextLevelXp = 100;
    private currentLevel = 1;

    constructor() {
        super({ key: 'HudScene' });
    }

    init(data: { networkSystem?: NetworkSystem }) {
        this.networkSystem = data.networkSystem;
    }

    create() {
        const padding = 10;
        const G = this.game.config; // Get game config for width/height as fallback
        const camWidth = this.cameras.main.width !== 0 ? this.cameras.main.width : Number.parseInt(G.width as string, 10);
        const camHeight = this.cameras.main.height !== 0 ? this.cameras.main.height : Number.parseInt(G.height as string, 10);

        // XP Bar (Top of screen, large)
        const xpBarHeight = 20; 
        const xpBarY = padding; // Positioned at the top
        this.xpBarMaxWidth = camWidth - padding * 2; // Nearly full width, stored for updates
        
        // XP Bar Background - RE-ADDED
        this.xpBarBackground = this.add.rectangle(
            padding, 
            xpBarY, 
            this.xpBarMaxWidth, 
            xpBarHeight, 
            0x222222, // Dark background color
            0.7       // Semi-transparent
        ).setOrigin(0, 0).setScrollFactor(0);

        // XP Bar Fill (starts empty)
        this.xpBarFill = this.add.rectangle(
            padding, 
            xpBarY, 
            0, // Will be updated in updateXpBar method
            xpBarHeight, 
            0x00ffff, // Cyan color for XP
            1
        ).setOrigin(0, 0).setScrollFactor(0);

        // XP Text (Displayed on the XP bar, centered)
        this.xpText = this.add.text(
            camWidth / 2, // Centered on the screen width
            xpBarY + xpBarHeight / 2, 
            `${this.currentXp}/${this.nextLevelXp}`,
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#000000', // Darker color for better visibility on a light bar
                stroke: '#ffffff',
                strokeThickness: 1
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);
        
        // Level Text (Right of XP bar)
        this.levelText = this.add.text(
            padding + this.xpBarMaxWidth - padding, // Positioned to the right end of the bar space
            xpBarY + xpBarHeight / 2,
            `Level: ${this.currentLevel}`,
            {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(1, 0.5).setScrollFactor(0); 
        
        // Kill Count display (Under XP Bar, Centered)
        const killCountY = xpBarY + xpBarHeight + padding / 2;
        this.killCountText = this.add.text(camWidth / 2, killCountY, 'Kills: 0', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0).setScrollFactor(0);

        // Set depths to ensure text is above background
        const textElements = [this.levelText, this.xpText, this.killCountText]; // Adjusted list
        for (const text of textElements) {
            text.setDepth(10);
        }
        // Set XP bar depths (background and fill)
        this.xpBarBackground.setDepth(8); // Background behind fill
        this.xpBarFill.setDepth(9);

        // Listen for direct HUD updates from GameScene
        this.game.events.on('updateHud', this.handleUpdateHud, this);
        this.game.events.on('updateKillCount', this.handleUpdateKillCount, this);

        // For backward compatibility - if NetworkSystem is provided, still listen to it
        this.networkSystem?.on('hud', this.updateHudDataFromNetwork, this);

        // Signal that the HUD is ready
        this.game.events.emit('hudReady');
    }

    private handleUpdateHud(data: { hp?: number, maxHp?: number, currentXp?: number, nextLevelXp?: number, level?: number, killCount?: number }) {
        if (data.currentXp !== undefined && data.nextLevelXp !== undefined) {
            this.currentXp = data.currentXp;
            this.nextLevelXp = data.nextLevelXp;
            this.updateXpBar();
        }

        if (data.level !== undefined) {
            this.currentLevel = data.level;
            this.levelText.setText(`Level: ${this.currentLevel}`);
        }

        if (data.killCount !== undefined) {
            this.killCountText.setText(`Kills: ${data.killCount}`);
        }
    }

    private updateXpBar() {
        // Update the XP text
        this.xpText.setText(`${this.currentXp}/${this.nextLevelXp}`);

        // Calculate the width of the XP fill bar based on current/next XP
        const maxWidth = this.xpBarMaxWidth; // Use stored max width
        const fillWidth = (this.currentXp / this.nextLevelXp) * maxWidth;
        
        // Animate the XP bar fill
        this.tweens.killTweensOf(this.xpBarFill);
        this.tweens.add({
            targets: this.xpBarFill,
            width: fillWidth,
            duration: 300,
            ease: 'Power2'
        });
    }

    private updateHudDataFromNetwork(data: { hp?: number, currentXp?: number, nextLevelXp?: number, ping?: number, level?: number, killCount?: number }) {
        // This is the legacy method used if NetworkSystem is still providing updates
        if (data.currentXp !== undefined && data.nextLevelXp !== undefined) {
            this.currentXp = data.currentXp;
            this.nextLevelXp = data.nextLevelXp;
            this.updateXpBar();
        }
        
        if (data.level !== undefined) {
            this.currentLevel = data.level;
            this.levelText.setText(`Level: ${this.currentLevel}`);
        }

        if (data.killCount !== undefined) {
            this.killCountText.setText(`Kills: ${data.killCount}`);
        }
    }

    private tweenTextColor(textObj: Phaser.GameObjects.Text, startColor: number, endColor: number, duration: number) {
        // Visual effect - flash text between colors
        this.tweens.addCounter({
            from: 0,
            to: 100,
            duration: duration,
            yoyo: true,
            repeat: 2,
            onUpdate: (tween) => {
                const value = tween.getValue();
                const colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.ValueToColor(startColor),
                    Phaser.Display.Color.ValueToColor(endColor),
                    100,
                    value
                );
                const color = Phaser.Display.Color.GetColor(
                    colorObj.r, colorObj.g, colorObj.b
                );
                textObj.setTint(color);
            },
            onComplete: () => {
                textObj.clearTint();
            }
        });
    }

    private handleUpdateKillCount(data: { killCount: number }) {
        this.killCountText.setText(`Kills: ${data.killCount}`);
    }

    shutdown() {
        this.game.events.off('updateHud', this.handleUpdateHud, this);
        this.game.events.off('updateKillCount', this.handleUpdateKillCount, this);
        this.networkSystem?.off('hud', this.updateHudDataFromNetwork, this);
    }
} 