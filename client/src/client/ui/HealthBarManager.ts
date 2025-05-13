import Phaser from 'phaser';

interface HealthBarData {
    graphics: Phaser.GameObjects.Graphics;
    isVisible: boolean;
    hideTimer: Phaser.Time.TimerEvent | null;
}

export class HealthBarManager {
    private static healthBars = new Map<string, HealthBarData>();
    private static readonly HIDE_DELAY = 5000; // 5 seconds before hiding the health bar

    /**
     * Create a health bar for an entity
     */
    public static createHealthBar(scene: Phaser.Scene, entityId: string): Phaser.GameObjects.Graphics {
        const graphics = scene.add.graphics();
        graphics.visible = false;
        
        this.healthBars.set(entityId, {
            graphics,
            isVisible: false,
            hideTimer: null
        });
        
        return graphics;
    }

    /**
     * Remove a health bar when entity is destroyed
     */
    public static removeHealthBar(entityId: string): void {
        const healthBar = this.healthBars.get(entityId);
        if (healthBar) {
            if (healthBar.hideTimer) {
                healthBar.hideTimer.remove();
            }
            healthBar.graphics.destroy();
            this.healthBars.delete(entityId);
        }
    }

    /**
     * Update health bar appearance based on current/max health
     */
    public static updateHealthBar(
        entityId: string,
        currentHp: number,
        maxHp: number,
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        const healthBar = this.healthBars.get(entityId);
        if (!healthBar || !healthBar.graphics) return;

        const graphics = healthBar.graphics;
        graphics.clear();
        
        if (currentHp <= 0) return;

        const barWidth = width * 0.8;
        const barHeight = 8;
        const barX = x - barWidth / 2;
        const barY = y - height / 2 - barHeight - 5;

        // Draw background
        graphics.fillStyle(0x808080, 0.7);
        graphics.fillRect(barX, barY, barWidth, barHeight);

        // Draw health portion
        const healthPercentage = currentHp / maxHp;
        const currentHealthWidth = barWidth * healthPercentage;
        graphics.fillStyle(0x00ff00, 0.9);
        graphics.fillRect(barX, barY, currentHealthWidth, barHeight);

        // Draw border
        graphics.lineStyle(1, 0x000000, 0.8);
        graphics.strokeRect(barX, barY, barWidth, barHeight);
    }

    /**
     * Show health bar and reset the hide timer
     */
    public static showHealthBar(scene: Phaser.Scene, entityId: string): void {
        const healthBar = this.healthBars.get(entityId);
        if (!healthBar) return;
        
        if (!healthBar.isVisible) {
            healthBar.graphics.visible = true;
            healthBar.isVisible = true;
        }
        
        // Reset or create the timer to hide the health bar
        if (healthBar.hideTimer) {
            healthBar.hideTimer.reset({ delay: this.HIDE_DELAY });
        } else {
            healthBar.hideTimer = scene.time.delayedCall(this.HIDE_DELAY, () => {
                const currentBar = this.healthBars.get(entityId);
                if (currentBar && currentBar.graphics) {
                    currentBar.graphics.visible = false;
                    currentBar.isVisible = false;
                }
            });
        }
    }
} 