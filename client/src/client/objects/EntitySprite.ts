import Phaser from 'phaser';
import {
    EVENT_ENTITY_TAKE_DAMAGE,
    EVENT_ENTITY_DIED,
    EVENT_ENTITY_SHOOT_PROJECTILE
} from '../../common/events';
import type ProjectileSprite from './ProjectileSprite';

export abstract class EntitySprite extends Phaser.GameObjects.Sprite {
    public entityId: string;
    public hp: number;
    public maxHp: number;
    public maxSpeed: number;
    public defense: number; // Added defense property
    protected healthBarGraphics: Phaser.GameObjects.Graphics;

    public projectileType = 'BULLET';
    public projectileDamage = 10;
    public projectileSpeed = 300;
    public projectileLifespan = 1000;
    public shootCooldown = 500;
    public lastShotTime = 0;

    // Wobble animation properties
    protected wobbleAngleMagnitude = 3; // Max angle in degrees for wobble
    protected wobbleAngleSpeed = 0.015; // Speed of wobble oscillation (radians per ms)
    private wobbleAngleAccumulator = 0; // Accumulator for the sine wave

    constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, entityId: string, hp: number, maxHp: number, maxSpeed: number) {
        super(scene, x, y, textureKey);
        this.entityId = entityId;
        this.hp = hp;
        this.maxHp = maxHp;
        this.maxSpeed = maxSpeed;
        this.defense = 0; // Default defense to 0

        this.healthBarGraphics = scene.add.graphics();
        this.updateHealthBar();

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Basic physics body properties - can be overridden by subclasses
        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.setCollideWorldBounds(true); // Common for most entities
            // Subclasses can set specific body size, offsets, etc.
        }
    }

    // Abstract method for texture generation, to be implemented by subclasses
    // static abstract generateTexture(scene: Phaser.Scene, key: string, ...args: any[]): void;

    // Common methods can be added here, e.g.:
    public takeDamage(amount: number, source?: EntitySprite | ProjectileSprite | string): void {
        const damageAfterDefense = Math.max(1, amount - this.defense); // Ensure at least 1 damage if amount > 0
        const actualDamage = Math.min(this.hp, damageAfterDefense);
        this.hp -= actualDamage;

        this.displayDamageNumber(actualDamage);

        // Emit take damage event AFTER health is updated
        this.scene.events.emit(EVENT_ENTITY_TAKE_DAMAGE, {
            target: this,
            damage: actualDamage,
            newHp: this.hp,
            source: source
        });

        if (this.hp <= 0) {
            this.hp = 0;
            this.die(source);
        } else {
            this.updateHealthBar();
            this.scene.tweens.add({
                targets: this,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
                onStart: () => {
                    if (this.setTint) this.setTint(0xff0000);
                },
                onComplete: () => {
                    if (this.clearTint) this.clearTint();
                    this.alpha = 1.0;
                }
            });
        }
    }

    protected die(killer?: EntitySprite | ProjectileSprite | string): void {
        this.healthBarGraphics.destroy();

        // Emit died event before deactivating/destroying
        this.scene.events.emit(EVENT_ENTITY_DIED, { entity: this, killer: killer });

        this.setActive(false);
        this.setVisible(false);
        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            (this.body as Phaser.Physics.Arcade.Body).destroy();
        }
    }

    // Placeholder for update logic, to be potentially overridden or extended by subclasses
    // update(time: number, delta: number): void {
    //     // Common update logic if any
    // }

    // Method to update the health bar's appearance
    private updateHealthBar(): void {
        this.healthBarGraphics.clear();
        if (!this.active || this.hp <= 0) return;

        const barWidth = this.width * 0.8;
        const barHeight = 8;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.height / 2 - barHeight - 5; 

        this.healthBarGraphics.fillStyle(0x808080, 0.7);
        this.healthBarGraphics.fillRect(barX, barY, barWidth, barHeight);

        const healthPercentage = this.hp / this.maxHp;
        const currentHealthWidth = barWidth * healthPercentage;
        this.healthBarGraphics.fillStyle(0x00ff00, 0.9);
        this.healthBarGraphics.fillRect(barX, barY, currentHealthWidth, barHeight);

        this.healthBarGraphics.lineStyle(1, 0x000000, 0.8);
        this.healthBarGraphics.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Method to display floating damage numbers
    private displayDamageNumber(amount: number): void {
        if (amount <= 0) return;

        const damageText = this.scene.add.text(
            this.x,
            this.y - this.height / 2,
            amount.toString(),
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        damageText.setOrigin(0.5, 0.5);

        this.scene.tweens.add({
            targets: damageText,
            y: damageText.y - 50,
            alpha: { start: 1, to: 0 },
            duration: 1000,
            ease: 'Power1',
            onComplete: () => {
                damageText.destroy();
            }
        });
    }

    // Ensure health bar follows the sprite
    // This should be called in the sprite's main update loop if it has one,
    // or directly after the sprite's position is updated by the scene/system.
    // For simplicity, we'll call it in an overridden `set x y` or in a postUpdate if available.
    // Phaser sprites don't have a 'postUpdate' by default in the same way components might.
    // We'll rely on calling updateHealthBar explicitly for now when position changes or create a small update method.

    protected updateWobble(time: number, delta: number): void {
        if (!this.body || !this.active) {
            // If not active or no body, smoothly return angle to 0 if it's not already there
            if (Math.abs(this.angle) > 0.1) {
                this.angle = Phaser.Math.Linear(this.angle, 0, 0.2); // Adjust 0.2 for smoothness
                if (Math.abs(this.angle) < 0.5) { // Snap to 0 if very close
                    this.angle = 0;
                }
            } else if (this.angle !== 0) { // If it's already small but not zero, snap it.
                this.angle = 0;
            }
            return;
        }

        const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        // Ensure velocity exists on the body (it should for Arcade.Body)
        if (!arcadeBody.velocity) {
            if (Math.abs(this.angle) > 0.1) {
                 this.angle = Phaser.Math.Linear(this.angle, 0, 0.2);
                 if (Math.abs(this.angle) < 0.5) this.angle = 0;
            } else if (this.angle !== 0) {
                this.angle = 0;
            }
            return;
        }

        const isCurrentlyMoving = arcadeBody.velocity.x !== 0 || arcadeBody.velocity.y !== 0;

        if (isCurrentlyMoving) {
            this.wobbleAngleAccumulator += this.wobbleAngleSpeed * delta;
            // Optional: Keep accumulator from growing excessively large to prevent potential precision loss over extreme durations
            if (this.wobbleAngleAccumulator > Math.PI * 20) { // Reset periodically (e.g., every 10 cycles)
                this.wobbleAngleAccumulator -= Math.PI * 20;
            }
            this.angle = Math.sin(this.wobbleAngleAccumulator) * this.wobbleAngleMagnitude;
        } else {
            // If stopped, smoothly return angle to 0
            if (this.angle !== 0) { // Only tween if not already at 0
                this.angle = Phaser.Math.Linear(this.angle, 0, 0.2); // Adjust 0.2 for desired smoothness
                // Snap to 0 if very close to prevent tiny oscillations
                if (Math.abs(this.angle) < 0.5) { // Threshold for snapping
                    this.angle = 0;
                    // No need to reset wobbleAngleAccumulator here, allows smooth resume of wobble
                }
            }
        }
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        this.updateWobble(time, delta); // Add wobble update
        if (this.active && this.hp > 0) {
            this.updateHealthBar();
        } else {
            this.healthBarGraphics.clear();
        }
    }

    // Method to attempt shooting
    public attemptShoot(targetPosition?: Phaser.Math.Vector2, direction?: Phaser.Math.Vector2): boolean {
        let shootDirection: Phaser.Math.Vector2;
        if (targetPosition) {
            shootDirection = new Phaser.Math.Vector2(targetPosition.x - this.x, targetPosition.y - this.y).normalize();
        } else if (direction) {
            shootDirection = new Phaser.Math.Vector2(direction.x, direction.y).normalize();
        } else {
            const angle = this.angle;
            const angleRad = Phaser.Math.DegToRad(angle);
            shootDirection = new Phaser.Math.Vector2(Math.cos(angleRad), Math.sin(angleRad));
        }

        this.scene.events.emit(EVENT_ENTITY_SHOOT_PROJECTILE, {
            shooter: this,
            ownerId: this.entityId,
            projectileType: this.projectileType,
            targetPosition: targetPosition,
            direction: shootDirection
        });
        return true;
    }
} 