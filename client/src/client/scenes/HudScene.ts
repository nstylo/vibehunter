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
    
    // Enemy indicator related
    private enemyIndicators: Map<string, Phaser.GameObjects.Triangle> = new Map();
    private indicatorPool: Phaser.GameObjects.Triangle[] = [];
    private indicatorY = 20; // Y position for indicators (top of screen)
    
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
        
        // Listen for enemy position updates
        this.game.events.on('updateEnemyIndicators', this.updateEnemyIndicators, this);
        this.game.events.on('enemyRemoved', this.removeEnemyIndicator, this);

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
    
    // Enemy indicator management
    private getOrCreateIndicator(): Phaser.GameObjects.Triangle {
        // Reuse an indicator from the pool if available
        if (this.indicatorPool.length > 0) {
            const indicator = this.indicatorPool.pop();
            if (indicator) {
                indicator.setVisible(true);
                return indicator;
            }
        }
        
        // Create a new triangle indicator (pointing up by default)
        const indicator = this.add.triangle(0, 0, 0, -10, -7, 5, 7, 5, 0xFF0000)
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setDepth(15); // Above other HUD elements
        
        // Add a subtle pulsing effect
        this.tweens.add({
            targets: indicator,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        return indicator;
    }
    
    private updateEnemyIndicators(data: {
        enemies: Array<{id: string, worldX: number, worldY: number}>,
        cameraX: number,
        cameraY: number,
        cameraWidth: number,
        cameraHeight: number
    }) {
        const { enemies, cameraX, cameraY, cameraWidth, cameraHeight } = data;
        const camWidth = this.cameras.main.width;
        const camHeight = this.cameras.main.height;
        
        // Calculate screen edges with padding
        const padding = 20; // Padding from screen edge
        const leftEdge = padding;
        const rightEdge = camWidth - padding;
        const topEdge = padding;
        const bottomEdge = camHeight - padding;
        
        // Track which enemy IDs we've processed
        const processedEnemyIds = new Set<string>();
        
        for (const enemy of enemies) {
            processedEnemyIds.add(enemy.id);
            
            // Calculate if the enemy is on screen
            const isOnScreen = (
                enemy.worldX >= cameraX && 
                enemy.worldX <= cameraX + cameraWidth &&
                enemy.worldY >= cameraY && 
                enemy.worldY <= cameraY + cameraHeight
            );
            
            if (!isOnScreen) {
                // Get or create an indicator for this enemy
                let indicator = this.enemyIndicators.get(enemy.id);
                if (!indicator) {
                    indicator = this.getOrCreateIndicator();
                    this.enemyIndicators.set(enemy.id, indicator);
                }
                
                // Calculate angle from camera center to enemy
                const camCenterX = cameraX + cameraWidth / 2;
                const camCenterY = cameraY + cameraHeight / 2;
                const angle = Phaser.Math.Angle.Between(camCenterX, camCenterY, enemy.worldX, enemy.worldY);
                
                // Calculate the position on the screen edge
                let indicatorX: number;
                let indicatorY: number;
                
                // Convert angle to normalized vector
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                
                // Determine which screen edge to place the indicator on
                // This is based on which edge the angle vector intersects first
                
                // Calculate the intersection with the screen edges
                // Time to hit horizontal edges (top/bottom)
                const topIntersect = (topEdge - camHeight / 2) / dy;
                const bottomIntersect = (bottomEdge - camHeight / 2) / dy;
                
                // Time to hit vertical edges (left/right)
                const leftIntersect = (leftEdge - camWidth / 2) / dx;
                const rightIntersect = (rightEdge - camWidth / 2) / dx;
                
                // Find the first edge that the ray hits
                const intersections = [
                    { t: topIntersect, edge: 'top', valid: dy < 0 && topIntersect > 0 },
                    { t: bottomIntersect, edge: 'bottom', valid: dy > 0 && bottomIntersect > 0 },
                    { t: leftIntersect, edge: 'left', valid: dx < 0 && leftIntersect > 0 },
                    { t: rightIntersect, edge: 'right', valid: dx > 0 && rightIntersect > 0 }
                ].filter(i => i.valid);
                
                // Sort by time to hit (smallest first)
                intersections.sort((a, b) => a.t - b.t);
                
                // Use the first valid intersection
                if (intersections.length > 0) {
                    const intersection = intersections[0];
                    
                    // Calculate the position based on the intersection
                    if (intersection && intersection.edge === 'top') {
                        indicatorX = camWidth / 2 + intersection.t * dx;
                        indicatorY = topEdge;
                        // Rotate to point away from top edge (downward)
                        indicator.setRotation(angle);
                    } else if (intersection && intersection.edge === 'bottom') {
                        indicatorX = camWidth / 2 + intersection.t * dx;
                        indicatorY = bottomEdge;
                        // Rotate to point away from bottom edge (upward)
                        indicator.setRotation(angle + Math.PI);
                    } else if (intersection && intersection.edge === 'left') {
                        indicatorX = leftEdge;
                        indicatorY = camHeight / 2 + intersection.t * dy;
                        // Rotate to point away from left edge (rightward)
                        indicator.setRotation(angle + Math.PI/2);
                    } else if (intersection && intersection.edge === 'right') {
                        indicatorX = rightEdge;
                        indicatorY = camHeight / 2 + intersection.t * dy;
                        // Rotate to point away from right edge (leftward)
                        indicator.setRotation(angle - Math.PI/2);
                    } else {
                        // Fallback if somehow the intersection exists but has an invalid edge
                        indicatorX = camWidth / 2;
                        indicatorY = topEdge;
                        indicator.setRotation(angle);
                    }
                    
                    // Clamp the indicator position to ensure it stays within bounds
                    indicatorX = Phaser.Math.Clamp(indicatorX, leftEdge, rightEdge);
                    indicatorY = Phaser.Math.Clamp(indicatorY, topEdge, bottomEdge);
                    
                    // Set the indicator position
                    indicator.setPosition(indicatorX, indicatorY);
                } else {
                    // Fallback if no valid intersection (shouldn't happen but just in case)
                    indicator.setPosition(camWidth / 2, topEdge);
                    indicator.setRotation(angle);
                }
            } else if (this.enemyIndicators.has(enemy.id)) {
                // Enemy is on screen, hide its indicator
                const indicator = this.enemyIndicators.get(enemy.id);
                if (indicator) {
                    indicator.setVisible(false);
                    this.indicatorPool.push(indicator);
                    this.enemyIndicators.delete(enemy.id);
                }
            }
        }
        
        // Remove indicators for enemies that no longer exist
        for (const [enemyId, indicator] of this.enemyIndicators.entries()) {
            if (!processedEnemyIds.has(enemyId)) {
                indicator.setVisible(false);
                this.indicatorPool.push(indicator);
                this.enemyIndicators.delete(enemyId);
            }
        }
    }
    
    private removeEnemyIndicator(data: { enemyId: string }) {
        const indicator = this.enemyIndicators.get(data.enemyId);
        if (indicator) {
            indicator.setVisible(false);
            this.indicatorPool.push(indicator);
            this.enemyIndicators.delete(data.enemyId);
        }
    }

    shutdown() {
        this.game.events.off('updateHud', this.handleUpdateHud, this);
        this.game.events.off('updateWaveHud', this.handleUpdateWaveHud, this);
        this.game.events.off('newWaveStartedHud', this.handleNewWaveStarted, this);
        this.game.events.off('waveClearHud', this.handleWaveClearHud, this);
        this.game.events.off('allWavesClearedHud', this.handleAllWavesClearedHud, this);
        this.game.events.off('updateEnemyIndicators', this.updateEnemyIndicators, this);
        this.game.events.off('enemyRemoved', this.removeEnemyIndicator, this);
        this.networkSystem?.off('hud', this.updateHudDataFromNetwork, this);
        
        // Clean up indicators
        for (const indicator of this.enemyIndicators.values()) {
            indicator.destroy();
        }
        this.enemyIndicators.clear();
        
        for (const indicator of this.indicatorPool) {
            indicator.destroy();
        }
        this.indicatorPool = [];
    }
} 