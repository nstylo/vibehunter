import Phaser from 'phaser';
import {
    EVENT_ENTITY_TAKE_DAMAGE,
    EVENT_ENTITY_DIED,
    EVENT_ENTITY_SHOOT_PROJECTILE
} from '../../common/events';
import type ProjectileSprite from './ProjectileSprite';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { IStatusEffect, IStatusEffectData } from '../interfaces/IStatusEffect';
import statusEffectFactory from '../systems/StatusEffectFactory'; // Import the factory

// Extend the interface to include runtime properties
interface IStatusEffectRuntime extends IStatusEffect {
    appliedAt?: number;
    _lastTickTime?: number;
}

export abstract class EntitySprite extends Phaser.GameObjects.Sprite {
    public entityId: string;
    // Removed standalone stat variables: hp, maxHp, maxSpeed, defense

    // Stats Management
    public baseStats: { 
        hp: number;
        maxHp: number;
        maxSpeed: number;
        defense: number;
        attackCooldown: number;
        projectileDamage: number;
        projectileSpeed: number;
        [key: string]: number; // Allow other string-keyed stats
    };
    public currentStats: {
        hp: number;
        maxHp: number;
        maxSpeed: number;
        defense: number;
        attackCooldown: number;
        projectileDamage: number;
        projectileSpeed: number;
        [key: string]: number;
    };

    // Status Effects Management
    public activeStatusEffects = new Map<string, IStatusEffectRuntime>();

    protected healthBarGraphics;
    private healthBarVisible = false;
    private healthBarHideTimer: Phaser.Time.TimerEvent | null = null;
    private healthBarHideDelay = 5000; // 5 seconds before hiding the health bar

    public projectileType = 'BULLET';
    public projectileLifespan = 1000;
    public lastShotTime = 0;

    // Wobble animation properties
    protected wobbleAngleMagnitude = 2; // Max angle in degrees for wobble
    protected wobbleAngleSpeed = 0.015; // Speed of wobble oscillation (radians per ms)
    private wobbleAngleAccumulator = 0; // Accumulator for the sine wave

    // Particle system integration
    protected particleSystem?: ParticleSystem;
    protected canEmitFootsteps = true;
    protected footstepEmitInterval = 150;
    private lastFootstepTime = 0;
    // Constant for player physics height to be accessible
    protected playerPhysicsHeight = 64; // Default, can be overridden if necessary or passed

    constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, entityId: string, initialMaxHp: number, initialMaxSpeed: number, initialDefense = 0, particleSystem?: ParticleSystem) {
        super(scene, x, y, textureKey);
        this.entityId = entityId;

        this.baseStats = {
            maxHp: initialMaxHp,
            hp: initialMaxHp, // Current HP initialized to maxHP
            maxSpeed: initialMaxSpeed,
            defense: initialDefense,
            attackCooldown: 500,      // Default, can be overridden by subclasses
            projectileDamage: 10,     // Default
            projectileSpeed: 300,     // Default
        };
        this.currentStats = { ...this.baseStats };
        
        this.particleSystem = particleSystem;

        this.healthBarGraphics = scene.add.graphics();
        // Initially hide health bar until damage is taken
        this.healthBarGraphics.visible = false;
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

    // Show health bar and reset the hide timer
    private showHealthBar(): void {
        if (!this.healthBarVisible) {
            this.healthBarGraphics.visible = true;
            this.healthBarVisible = true;
        }
        
        // Reset or create the timer to hide the health bar
        if (this.healthBarHideTimer) {
            this.healthBarHideTimer.reset({ delay: this.healthBarHideDelay });
        } else {
            this.healthBarHideTimer = this.scene.time.delayedCall(this.healthBarHideDelay, () => {
                if (this.active && this.healthBarGraphics) {
                    this.healthBarGraphics.visible = false;
                    this.healthBarVisible = false;
                }
            });
        }
    }

    // Common methods can be added here, e.g.:
    public takeDamage(amount: number, source?: EntitySprite | ProjectileSprite | string): void {
        // New minimum damage calculation: minimum 10% of original damage (prevents defense from completely nullifying damage)
        // Also ensures damage is at least 1
        const damageAfterDefense = Math.max(Math.ceil(amount * 0.1), amount - (this.currentStats.defense || 0));
        const actualDamage = Math.min(this.currentStats.hp, damageAfterDefense);
        this.currentStats.hp -= actualDamage;

        // Show health bar when damage is taken
        this.showHealthBar();

        this.displayDamageNumber(actualDamage);

        this.scene.events.emit(EVENT_ENTITY_TAKE_DAMAGE, {
            target: this,
            damage: actualDamage,
            newHp: this.currentStats.hp,
            source: source
        });

        if (this.currentStats.hp <= 0) {
            this.currentStats.hp = 0;
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
        if (this.healthBarHideTimer) {
            this.healthBarHideTimer.remove();
            this.healthBarHideTimer = null;
        }
        
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
    protected updateHealthBar(): void {
        this.healthBarGraphics.clear();
        if (!this.active || !this.currentStats || this.currentStats.hp <= 0) return;

        const barWidth = this.width * 0.8;
        const barHeight = 8;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.height / 2 - barHeight - 5;

        this.healthBarGraphics.fillStyle(0x808080, 0.7);
        this.healthBarGraphics.fillRect(barX, barY, barWidth, barHeight);

        const healthPercentage = this.currentStats.hp / this.currentStats.maxHp;
        const currentHealthWidth = barWidth * healthPercentage;
        this.healthBarGraphics.fillStyle(0x00ff00, 0.9);
        this.healthBarGraphics.fillRect(barX, barY, currentHealthWidth, barHeight);

        this.healthBarGraphics.lineStyle(1, 0x000000, 0.8);
        this.healthBarGraphics.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Add method to update health bar position without redrawing
    protected updateHealthBarPosition(): void {
        if (!this.active || !this.currentStats || this.currentStats.hp <= 0) {
            this.healthBarGraphics.clear();
            return;
        }
        
        // Redraw the health bar at the updated position
        this.healthBarGraphics.clear();
        
        const barWidth = this.width * 0.8;
        const barHeight = 8;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.height / 2 - barHeight - 5;
        
        // Draw background
        this.healthBarGraphics.fillStyle(0x808080, 0.7);
        this.healthBarGraphics.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw health portion
        const healthPercentage = this.currentStats.hp / this.currentStats.maxHp;
        const currentHealthWidth = barWidth * healthPercentage;
        this.healthBarGraphics.fillStyle(0x00ff00, 0.9);
        this.healthBarGraphics.fillRect(barX, barY, currentHealthWidth, barHeight);
        
        // Draw border
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

        // Add velocity threshold to only wobble when entity is actually moving with meaningful speed
        const velocityThreshold = 10; // Minimum speed to trigger wobble effect
        const velocityMagnitude = Math.sqrt(arcadeBody.velocity.x * arcadeBody.velocity.x + arcadeBody.velocity.y * arcadeBody.velocity.y);
        const isCurrentlyMoving = velocityMagnitude > velocityThreshold;

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
        const now = time;
        const effectsToRemove: string[] = [];

        for (const [effectId, effect] of this.activeStatusEffects.entries()) {
            // appliedAt is set by the factory/system when an effect instance is created and applied.
            // It's not strictly part of IStatusEffect to keep the interface cleaner for definitions.
            const effectAppliedTimestamp = effect.appliedAt ?? 0;

            if (effect.duration !== Number.POSITIVE_INFINITY && now >= effectAppliedTimestamp + effect.duration) {
                effectsToRemove.push(effectId);
                continue;
            }

            if (effect.onUpdate) {
                effect.onUpdate(this, delta); // Corrected: 2 arguments
            }

            if (effect.tickRate && effect.onTick) {
                if (now >= (effect._lastTickTime ?? 0) + effect.tickRate) {
                    effect.onTick(this);
                    effect._lastTickTime = now;
                }
            }
        }

        // Use for...of for iterating `effectsToRemove` as per linter suggestion
        for (const id of effectsToRemove) {
            this.removeStatusEffect(id); // This should call onRemove and recalculateStats
        }

        this.updateWobble(time, delta);
        this.updateHealthBarPosition(); // Update health bar position every frame

        if (this.canEmitFootsteps && this.body) {
            const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
            if (arcadeBody.velocity) {
                // Use same velocity threshold as wobble for consistency
                const velocityThreshold = 10;
                const velocityMagnitude = Math.sqrt(arcadeBody.velocity.x * arcadeBody.velocity.x + arcadeBody.velocity.y * arcadeBody.velocity.y);
                const isMovingEnoughForFootsteps = velocityMagnitude > velocityThreshold;
                
                if (isMovingEnoughForFootsteps && time > this.lastFootstepTime + this.footstepEmitInterval) {
                    if (this.particleSystem) {
                        // Assuming ParticleSystem has emitFootstep method
                        this.particleSystem.emitFootstep(this.x, this.y + this.height / 2 - this.playerPhysicsHeight/2 + 10);
                    }
                    this.lastFootstepTime = time;
                }
            }
        }
    }

    public attemptShoot(targetPosition?: Phaser.Math.Vector2, direction?: Phaser.Math.Vector2): boolean {
        let shootDirection = direction;
        if (!shootDirection && targetPosition) {
            shootDirection = new Phaser.Math.Vector2(targetPosition.x - this.x, targetPosition.y - this.y).normalize();
        } else if (!shootDirection) {
            // Default direction if none provided (e.g., facing right)
            shootDirection = new Phaser.Math.Vector2(this.flipX ? -1 : 1, 0);
        }

        this.scene.events.emit(EVENT_ENTITY_SHOOT_PROJECTILE, {
            shooter: this,
            projectileType: this.projectileType, 
            damage: this.currentStats.projectileDamage,
            projectileSpeed: this.currentStats.projectileSpeed,
            lifespan: this.projectileLifespan,
            direction: shootDirection,
            x: this.x + shootDirection.x * (this.width / 2 + 10), // Offset to shoot from edge
            y: this.y + shootDirection.y * (this.height / 2),
        });
        return true;
    }

    public applyKnockback(direction: Phaser.Math.Vector2, force: number, durationMs?: number): void {
        if (!this.body || !this.active) return;

        const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        
        // Apply the initial knockback velocity
        arcadeBody.setVelocity(direction.x * force, direction.y * force);

        if (durationMs && durationMs > 0) {
            // If a duration is provided, set a timer to revert to normal behavior
            // or to remove a temporary state that might be overriding normal movement.
            // For now, we can simply allow natural deceleration or subsequent AI movement to take over.
            // A more robust system might involve a temporary 'isKnockedBack' state.
            this.scene.time.delayedCall(durationMs, () => {
                if (this.active && this.body) {
                    // Optional: Could reduce velocity gradually or let AI take over.
                    // For now, if AI doesn't set velocity each frame, this might stop it.
                    // If AI *does* set velocity, this explicit stop might not be needed or could conflict.
                    // A common pattern is for AI to check !isKnockedBack before applying its own movement.
                    // For simplicity here, let's assume AI will override or we want it to stop if it was only knockback.
                     if (arcadeBody.velocity.x === direction.x * force && arcadeBody.velocity.y === direction.y * force) {
                        // Only stop if velocity hasn't been changed by something else
                        // arcadeBody.setVelocity(0,0); // Or allow normal AI to resume
                     }
                }
            });
        }
        // Visual feedback for knockback (optional)
        // Example: a quick tint or shake
        this.scene.tweens.add({
            targets: this,
            angle: this.angle + (direction.x < 0 ? 5 : -5), // Quick jolt based on direction
            duration: 50,
            yoyo: true,
            ease: 'Power1'
        });
    }

    // Status Effect Management Methods
    public applyStatusEffect(effectIdOrData: string | IStatusEffectData, source?: EntitySprite | ProjectileSprite | string): void {
        let effectInstance: IStatusEffect | undefined;
        let effectIdentifier: string;

        if (typeof effectIdOrData === 'string') {
            effectIdentifier = effectIdOrData;
            effectInstance = statusEffectFactory.createEffect(effectIdentifier, source);
        } else {
            // If IStatusEffectData is passed, use its id to create the effect via the factory
            effectIdentifier = effectIdOrData.id;
            effectInstance = statusEffectFactory.createEffect(effectIdentifier, source);
            if (!effectInstance) {
                // This path implies the data was passed, but the factory couldn't make an instance (e.g. type not registered)
                console.warn(`EntitySprite: Attempted to apply effect with data for ID "${effectIdentifier}", but factory couldn't create it. Ensure type "${effectIdOrData.type}" is registered.`);
            }
        }

        if (!effectInstance) {
            // Ensure effectIdentifier is defined for the warning message
            const idForWarning = typeof effectIdOrData === 'string' ? effectIdOrData : effectIdOrData.id;
            console.warn(`EntitySprite: Could not create status effect instance for: ${idForWarning}`);
            return;
        }

        const existingEffect = this.activeStatusEffects.get(effectInstance.id); // Use effectInstance.id as it's guaranteed by IStatusEffect

        if (existingEffect) {
            if (effectInstance.canStack && existingEffect.currentStacks !== undefined && (existingEffect.maxStacks === undefined || existingEffect.currentStacks < existingEffect.maxStacks)) {
                existingEffect.currentStacks++;
                existingEffect.duration = effectInstance.duration; // Refresh duration on stack
            } else if (!effectInstance.canStack) {
                existingEffect.duration = effectInstance.duration; // Refresh duration for non-stackable
            } else {
                // Max stacks reached, just refresh duration
                existingEffect.duration = effectInstance.duration;
            }
            this.recalculateStats();
            existingEffect.onApply(this); // Re-call onApply for refresh/stack logic
        } else {
            this.activeStatusEffects.set(effectInstance.id, effectInstance);
            effectInstance.currentStacks = 1;
            effectInstance.onApply(this);
            this.recalculateStats(); 
        }
    }

    public removeStatusEffect(effectId: string): void {
        const effect = this.activeStatusEffects.get(effectId);
        if (effect) {
            effect.onRemove(this);
            this.activeStatusEffects.delete(effectId);
            this.recalculateStats(); // Recalculate stats after removal
            console.log(`Removed status effect ${effectId} from ${this.entityId}`);
        }
    }

    public hasStatusEffect(effectId: string): boolean {
        return this.activeStatusEffects.has(effectId);
    }

    public clearAllStatusEffects(filter?: (effect: IStatusEffect) => boolean): void {
        let statsChanged = false;
        for (const [effectId, effect] of this.activeStatusEffects.entries()) {
            if (!filter || filter(effect)) {
                effect.onRemove(this);
                this.activeStatusEffects.delete(effectId);
                statsChanged = true;
            }
        }
        if (statsChanged) {
            this.recalculateStats(); // Recalculate stats after clearing
        }
        // console.log(`Cleared all status effects for ${this.entityId}`); // Already logged in removeStatusEffect if called iteratively
    }

    protected recalculateStats(): void {
        // Reset currentStats to a copy of baseStats
        this.currentStats = { ...this.baseStats };

        // Apply modifiers from active status effects
        for (const effect of this.activeStatusEffects.values()) {
            if (effect.statModifiers) {
                for (const key in effect.statModifiers) {
                    if (Object.prototype.hasOwnProperty.call(effect.statModifiers, key) && 
                        typeof this.currentStats[key] === 'number') {
                        
                        const modifier = effect.statModifiers[key];
                        if (typeof modifier === 'object' && modifier !== null) {
                            // Handle { add?: number, multiply?: number } format
                            if (typeof modifier.add === 'number') {
                                this.currentStats[key] += modifier.add;
                            }
                            if (typeof modifier.multiply === 'number') {
                                this.currentStats[key] *= modifier.multiply;
                            }
                        } else if (typeof modifier === 'number') {
                            // Handle direct number assignment (additive)
                            this.currentStats[key] += modifier;
                        }
                    }
                }
            }
        }
        // HP specific clamping
        if (typeof this.currentStats.maxHp === 'number') {
            this.currentStats.hp = Math.min(this.currentStats.hp, this.currentStats.maxHp);
        }
        this.currentStats.hp = Math.max(0, this.currentStats.hp);

        this.updateHealthBar(); 
    }
} 