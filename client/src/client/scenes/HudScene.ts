import Phaser from 'phaser';
import type NetworkSystem from '../systems/NetworkSystem';

export default class HudScene extends Phaser.Scene {
    private hpText!: Phaser.GameObjects.Text;
    private xpText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private enemiesRemainingText!: Phaser.GameObjects.Text;
    private pingText!: Phaser.GameObjects.Text;
    private waveStatusText!: Phaser.GameObjects.Text;
    private xpBarBackground!: Phaser.GameObjects.Rectangle;
    private xpBarFill!: Phaser.GameObjects.Rectangle;
    private networkSystem: NetworkSystem | undefined;
    
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

        // Create a translucent background panel for better readability
        const headerPanel = this.add.rectangle(camWidth / 2, padding + 30, camWidth - padding*2, 70, 0x000000, 0.2)
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0);

        // HP display (Top-Left)
        this.hpText = this.add.text(padding, padding, 'HP: 100/100', { 
            fontSize: '16px', 
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setScrollFactor(0);

        // Level display (Top-Left, below HP)
        this.levelText = this.add.text(padding, padding + 20, 'Level: 1', {
            fontSize: '16px', 
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setScrollFactor(0);

        // XP Bar in top left, under level text
        const xpBarWidth = 150; // Smaller width for the top left corner
        const xpBarHeight = 8; // Slightly smaller height
        const xpBarY = padding + 40; // Position below level text
        
        // XP Bar Background
        this.xpBarBackground = this.add.rectangle(
            padding, 
            xpBarY, 
            xpBarWidth, 
            xpBarHeight, 
            0x222222, 
            0.7
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

        // XP Text (displayed next to the bar)
        this.xpText = this.add.text(
            padding + xpBarWidth + 5,
            xpBarY + xpBarHeight / 2, 
            `${this.currentXp}/${this.nextLevelXp}`, 
            { 
                fontSize: '12px', 
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0, 0.5).setScrollFactor(0);

        // Wave display (Top-Right)
        this.waveText = this.add.text(camWidth - padding, padding, 'Wave: 1', { 
            fontSize: '16px', 
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0);

        // Enemies Remaining display (Top-Right)
        this.enemiesRemainingText = this.add.text(camWidth - padding, padding + 20, 'Enemies: --/--', {
            fontSize: '16px', 
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0);
        
        // Ping display (Top-Right, below enemies)
        this.pingText = this.add.text(camWidth - padding, padding + 40, 'Ping: --ms', { 
            fontSize: '16px', 
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0);

        // Wave Status Text (Center Screen) - Initially invisible
        this.waveStatusText = this.add.text(camWidth / 2, camHeight / 2, '', {
            fontSize: '48px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setAlpha(0).setDepth(20); // Initially invisible and high depth

        // Set depths to ensure text is above background
        const textElements = [this.hpText, this.levelText, this.xpText, this.waveText, this.enemiesRemainingText, this.pingText];
        for (const text of textElements) {
            text.setDepth(10);
        }
        // Set XP bar depths
        this.xpBarBackground.setDepth(9);
        this.xpBarFill.setDepth(9);

        // Listen for direct HUD updates from GameScene
        this.game.events.on('updateHud', this.handleUpdateHud, this);
        this.game.events.on('updateWaveHud', this.handleUpdateWaveHud, this);
        this.game.events.on('newWaveStartedHud', this.handleNewWaveStarted, this);
        this.game.events.on('waveClearHud', this.handleWaveClearHud, this);
        this.game.events.on('allWavesClearedHud', this.handleAllWavesClearedHud, this);

        // For backward compatibility - if NetworkSystem is provided, still listen to it
        this.networkSystem?.on('hud', this.updateHudDataFromNetwork, this);

        // Signal that the HUD is ready
        this.game.events.emit('hudReady');
    }

    private handleUpdateHud(data: { hp?: number, maxHp?: number, currentXp?: number, nextLevelXp?: number, level?: number }) {
        if (data.hp !== undefined && data.maxHp !== undefined) {
            this.hpText.setText(`HP: ${data.hp}/${data.maxHp}`);
        }
        
        if (data.currentXp !== undefined && data.nextLevelXp !== undefined) {
            this.currentXp = data.currentXp;
            this.nextLevelXp = data.nextLevelXp;
            this.updateXpBar();
        }

        if (data.level !== undefined) {
            this.currentLevel = data.level;
            this.levelText.setText(`Level: ${this.currentLevel}`);
        }
    }

    private updateXpBar() {
        // Update the XP text
        this.xpText.setText(`${this.currentXp}/${this.nextLevelXp}`);

        // Calculate the width of the XP fill bar based on current/next XP
        const maxWidth = this.xpBarBackground.width;
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

    private updateHudDataFromNetwork(data: { hp?: number, currentXp?: number, nextLevelXp?: number, wave?: number, ping?: number, level?: number }) {
        // This is the legacy method used if NetworkSystem is still providing updates
        if (data.hp !== undefined) {
            this.hpText.setText(`HP: ${data.hp}`);
        }
        
        if (data.currentXp !== undefined && data.nextLevelXp !== undefined) {
            this.currentXp = data.currentXp;
            this.nextLevelXp = data.nextLevelXp;
            this.updateXpBar();
        }
        
        if (data.level !== undefined) {
            this.currentLevel = data.level;
            this.levelText.setText(`Level: ${this.currentLevel}`);
        }
        
        if (data.wave !== undefined) {
            this.waveText.setText(`Wave: ${data.wave}`);
        }
        
        if (data.ping !== undefined) {
            this.pingText.setText(`Ping: ${data.ping}ms`);
        }
    }

    private handleUpdateWaveHud(data: { waveNumber: number, enemiesRemaining: number, totalEnemiesInWave: number }) {
        this.waveText.setText(`Wave: ${data.waveNumber}`);
        this.enemiesRemainingText.setText(`Enemies: ${data.enemiesRemaining}/${data.totalEnemiesInWave}`);
    }

    private handleNewWaveStarted(data: { waveNumber: number }) {
        this.showWaveStatus(`Wave ${data.waveNumber} Started!`, 0x00FFFF);
    }

    private handleWaveClearHud(data: { waveNumber: number }) {
        this.waveText.setText(`Wave ${data.waveNumber} Cleared!`);
        this.enemiesRemainingText.setText('Enemies: 0/0');
        this.showWaveStatus(`Wave ${data.waveNumber} Defeated!`, 0xFFFF00); // Yellow color for defeated
        
        // Flash effect to celebrate wave clear
        this.tweenTextColor(this.waveText, 0xFFFF00, 0xFFFFFF, 1500);
    }

    private handleAllWavesClearedHud() {
        this.waveText.setText('All Waves Cleared!');
        this.enemiesRemainingText.setText('VICTORY!');
        this.showWaveStatus('ALL WAVES DEFEATED!', 0x00FF00, 3000); // Green for overall victory, longer duration
        
        // Victory celebration effect
        this.tweenTextColor(this.waveText, 0x00FF00, 0xFFFFFF, 3000);
        this.tweenTextColor(this.enemiesRemainingText, 0x00FF00, 0xFFFFFF, 3000);
    }
    
    private showWaveStatus(message: string, color: number, duration = 2000) {
        this.waveStatusText.setText(message);
        this.waveStatusText.setTint(color);
        this.waveStatusText.setAlpha(0); // Start fully transparent
        this.waveStatusText.setScale(0.5); // Start small

        // Stop any existing tweens on this object
        this.tweens.killTweensOf(this.waveStatusText);

        // Tween a) Fade in and scale up
        this.tweens.add({
            targets: this.waveStatusText,
            alpha: 1,
            scale: 1,
            ease: 'Power2',
            duration: duration * 0.25,
            onComplete: () => {
                // Tween b) Hold visible
                this.tweens.add({
                    targets: this.waveStatusText,
                    alpha: 1, // Keep alpha at 1
                    scale: 1, // Keep scale at 1
                    ease: 'Linear',
                    duration: duration * 0.5,
                    onComplete: () => {
                        // Tween c) Fade out and slightly shrink
                        this.tweens.add({
                            targets: this.waveStatusText,
                            alpha: 0,
                            scale: 0.75,
                            ease: 'Power2',
                            duration: duration * 0.25,
                            onComplete: () => {
                                this.waveStatusText.setText(''); // Clear text after fade out
                            }
                        });
                    }
                });
            }
        });
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

    shutdown() {
        this.game.events.off('updateHud', this.handleUpdateHud, this);
        this.game.events.off('updateWaveHud', this.handleUpdateWaveHud, this);
        this.game.events.off('newWaveStartedHud', this.handleNewWaveStarted, this);
        this.game.events.off('waveClearHud', this.handleWaveClearHud, this);
        this.game.events.off('allWavesClearedHud', this.handleAllWavesClearedHud, this);
        this.networkSystem?.off('hud', this.updateHudDataFromNetwork, this);
    }
} 