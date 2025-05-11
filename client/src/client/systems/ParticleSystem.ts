import Phaser from 'phaser';
import { ProjectileType } from '../objects/ProjectileSprite';

export class ParticleSystem {
    private scene: Phaser.Scene;
    private projectileImpactEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter | Record<string, Phaser.GameObjects.Particles.ParticleEmitter>>;
    private enemyDeathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private footstepEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.projectileImpactEmitters = new Map();
        this.initialize();
    }

    private initialize(): void {
        this.createParticleTextures();
        this.initProjectileImpactEmitters();
        this.initEnemyDeathEmitter();
        this.initFootstepEmitter();
    }

    private createParticleTextures(): void {
        const graphics = this.scene.add.graphics();

        // Generic small, bright particle (good for sparks, highlights)
        if (!this.scene.textures.exists('particle_core')) {
            graphics.clear();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(3, 3, 3); // Small and bright
            graphics.generateTexture('particle_core', 6, 6);
            graphics.clear();
        }

        // Spark texture - more dynamic
        if (!this.scene.textures.exists('spark_dynamic')) {
            graphics.clear();
            graphics.fillStyle(0xffffff, 1);
            graphics.beginPath();
            graphics.moveTo(8, 0); graphics.lineTo(10, 5); graphics.lineTo(16, 6);
            graphics.lineTo(11, 9); graphics.lineTo(13, 15); graphics.lineTo(8, 12);
            graphics.lineTo(3, 15); graphics.lineTo(5, 9); graphics.lineTo(0, 6);
            graphics.lineTo(6, 5); graphics.closePath(); graphics.fill();
            graphics.generateTexture('spark_dynamic', 16, 16);
            graphics.clear();
        }

        // Smoke texture - softer, more cloud-like
        if (!this.scene.textures.exists('smoke_soft')) {
            graphics.clear();
            // Multiple overlapping circles with varying alpha for a softer look
            graphics.fillStyle(0xffffff, 0.15); graphics.fillCircle(16, 16, 15);
            graphics.fillStyle(0xffffff, 0.25); graphics.fillCircle(14, 18, 12);
            graphics.fillStyle(0xffffff, 0.35); graphics.fillCircle(18, 14, 14);
            graphics.fillStyle(0xffffff, 0.2); graphics.fillCircle(16, 16, 10);
            graphics.generateTexture('smoke_soft', 32, 32);
            graphics.clear();
        }

        // Ember texture - small, glowing, for fire effects
        if (!this.scene.textures.exists('ember_glow')) {
            graphics.clear();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillEllipse(4, 4, 3, 5);
            graphics.generateTexture('ember_glow', 8, 8);
            graphics.clear();
        }
        
        // Flame particle texture - simplified to avoid curve issues
        if (!this.scene.textures.exists('flame_particle')) {
            graphics.clear();
            graphics.fillStyle(0xffffff, 1); // Will be tinted
            // Simple triangle/polygon for flame
            graphics.beginPath();
            graphics.moveTo(5, 0);  // Top point
            graphics.lineTo(0, 10); // Bottom-left
            graphics.lineTo(10, 10); // Bottom-right
            graphics.closePath();
            graphics.fill();
            graphics.generateTexture('flame_particle', 10, 10);
            graphics.clear();
        }

        // Footstep puff texture - small, slightly transparent
        if (!this.scene.textures.exists('footstep_puff')) {
            graphics.clear();
            // Create a cloud-like texture with multiple overlapping circles
            graphics.fillStyle(0xffffff, 0.6); // Reduced base opacity
            graphics.fillCircle(8, 8, 8); // Main circle
            
            // Add more irregular shapes to create a cloud-like appearance
            graphics.fillStyle(0xffffff, 0.5); // Reduced opacity
            graphics.fillCircle(4, 8, 5); // Left bulge
            graphics.fillCircle(12, 8, 5); // Right bulge
            graphics.fillCircle(8, 4, 5); // Top bulge
            graphics.fillCircle(8, 12, 5); // Bottom bulge
            
            // Slight inner shading for depth
            graphics.fillStyle(0x444444, 0.2); // Reduced opacity
            graphics.fillCircle(8, 8, 3);
            
            // Generate a larger texture
            graphics.generateTexture('footstep_puff', 16, 16);
            graphics.clear();
        }
        graphics.destroy();
    }

    private initProjectileImpactEmitters(): void {
        // Bullet impact emitter
        const bulletEmitter = this.scene.add.particles(0, 0, 'particle_core', {
            speed: { min: 80, max: 220 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.6, end: 0 },
            lifespan: { min: 150, max: 300 },
            blendMode: Phaser.BlendModes.ADD,
            tint: 0xffff00, // Yellow
            gravityY: 80,
            quantity: { min: 8, max: 12 },
            frequency: -1,
            emitting: false
        });
        this.projectileImpactEmitters.set(ProjectileType.BULLET, bulletEmitter);

        // Laser impact emitter
        const laserEmitter = this.scene.add.particles(0, 0, 'spark_dynamic', {
            speed: { min: 250, max: 450 },
            angle: { min: -15, max: 15 }, // More focused direction, can be adjusted based on impact angle
            scale: { start: 0.7, end: 0.1 },
            alpha: { start: 1, end: 0.2 },
            lifespan: { min: 100, max: 250 },
            blendMode: Phaser.BlendModes.ADD,
            tint: 0x00ffff, // Cyan
            quantity: { min: 10, max: 15 },
            frequency: -1,
            emitting: false
        });
        this.projectileImpactEmitters.set(ProjectileType.LASER, laserEmitter);

        // Fireball impact - Composite Emitter
        const fireballMainEmitter = this.scene.add.particles(0, 0, 'flame_particle', {
            speed: { min: 70, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.2, end: 0.3, ease: 'Quart.easeIn' },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 400, max: 700 },
            blendMode: Phaser.BlendModes.ADD,
            tint: [0xff6600, 0xffaa00, 0xff4400, 0xffcc33], // Rich oranges and yellows
            gravityY: -100, // Rising flames
            quantity: { min: 20, max: 30 },
            frequency: -1,
            emitting: false
        });

        const fireballSmokeEmitter = this.scene.add.particles(0, 0, 'smoke_soft', {
            speed: { min: 30, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 2.5, ease: 'Expo.easeOut' },
            alpha: { start: 0.5, end: 0 },
            lifespan: { min: 800, max: 1500 },
            tint: [0x222222, 0x333333, 0x181818], // Darker, varied smoke
            delay: 100, // Smoke appears slightly after main explosion
            quantity: { min: 10, max: 15 },
            frequency: -1,
            emitting: false
        });

        const fireballEmberEmitter = this.scene.add.particles(0, 0, 'ember_glow', {
            speed: { min: 50, max: 180 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 600, max: 1200 },
            blendMode: Phaser.BlendModes.ADD,
            tint: [0xffcc00, 0xffaa00, 0xffffee], // Bright, glowing embers
            gravityY: -70, // Embers rise
            delay: 50,
            quantity: { min: 15, max: 25 },
            frequency: -1,
            emitting: false
        });

        this.projectileImpactEmitters.set(ProjectileType.FLAME, {
            main: fireballMainEmitter,
            smoke: fireballSmokeEmitter,
            embers: fireballEmberEmitter
        });
    }

    private initEnemyDeathEmitter(): void {
        this.enemyDeathEmitter = this.scene.add.particles(0, 0, 'spark_dynamic', {
            speed: { min: 100, max: 250 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 1, end: 0.2 },
            lifespan: { min: 300, max: 600 },
            blendMode: Phaser.BlendModes.ADD,
            tint: 0xff0000,
            quantity: {min: 15, max: 25},
            frequency: -1,
            emitting: false
        });
    }

    private initFootstepEmitter(): void {
        this.footstepEmitter = this.scene.add.particles(0, 0, 'footstep_puff', {
            speed: { min: 8, max: 20 }, // Slower movement for cloudy drift
            angle: { min: 180, max: 360 }, // Full 180° range from straight left to straight right (full half-circle upward)
            scale: { start: 0.8, end: 1.3 },  // Grow larger over time like clouds
            alpha: { start: 0.6, end: 0 },    // Reduced starting alpha for more transparency
            lifespan: { min: 500, max: 800 }, // Longer lifespan for cloud-like drift
            blendMode: Phaser.BlendModes.NORMAL,
            tint: 0xaaaaaa, // Grey clouds
            gravityY: -30, // Slight upward drift for clouds
            quantity: 4,
            frequency: -1,
            emitting: false,
            rotate: { min: -45, max: 45 } // More varied rotation for natural movement
        });
    }

    public playProjectileImpact(
        projectileType: ProjectileType,
        x: number,
        y: number,
        scale = 1
    ): void {
        const typeStr = ProjectileType[projectileType];
        const emitterOrGroup = this.projectileImpactEmitters.get(typeStr);

        if (!emitterOrGroup) return;

        if (projectileType === ProjectileType.FLAME) {
            const group = emitterOrGroup as Record<string, Phaser.GameObjects.Particles.ParticleEmitter>;
            const baseQuantityMain = Phaser.Math.Between(20, 30);
            const baseQuantitySmoke = Phaser.Math.Between(10, 15);
            const baseQuantityEmbers = Phaser.Math.Between(15, 25);

            if (group.main) {
                group.main.setScale(scale); // Scale affects speed, gravity, offsets
                group.main.explode(Math.ceil(baseQuantityMain * scale), x, y);
            }
            if (group.smoke) {
                group.smoke.setScale(scale);
                group.smoke.explode(Math.ceil(baseQuantitySmoke * scale), x, y);
            }
            if (group.embers) {
                group.embers.setScale(scale);
                group.embers.explode(Math.ceil(baseQuantityEmbers * scale), x, y);
            }
        } else {
            const emitter = emitterOrGroup as Phaser.GameObjects.Particles.ParticleEmitter;
            let baseQuantity = 10;
            if (projectileType === ProjectileType.BULLET) baseQuantity = Phaser.Math.Between(8,12);
            if (projectileType === ProjectileType.LASER) baseQuantity = Phaser.Math.Between(10,15);
            
            emitter.setScale(scale);
            emitter.explode(Math.ceil(baseQuantity * scale), x, y);
        }
    }

    public playEnemyDeath(x: number, y: number, tint?: number): void {
        if (!this.enemyDeathEmitter) return;

        const particleTint = tint ?? 0xff0000; // Default to red if no tint provided
        
        // Phaser.GameObjects.Particles.ParticleEmitter has a `tint` property.
        // Setting it directly should affect the next emission of particles.
        // this.enemyDeathEmitter.setTint(particleTint);
        
        // The quantity can also be part of the emitter's config or overridden here if needed.
        // Using the quantity from its config ({min: 15, max: 25})
        this.enemyDeathEmitter.explode(undefined, x, y); // `undefined` for quantity uses emitter's own quantity range

        // Dramatic flash effect
        const flash = this.scene.add.circle(x, y, 30, 0xffffff, 0.6); // Reduced size and alpha
        this.scene.tweens.add({
            targets: flash,
            alpha: { from: 0.6, to: 0 },
            scale: { from: 1, to: 1.6 }, // Reduced scale effect
            duration: 250, // Shorter duration
            ease: 'Cubic.easeOut',
            onComplete: () => flash.destroy()
        });
    }

    public playFootstep(x: number, y: number): void {
        if (!this.footstepEmitter) return;

        // Always use grey tint regardless of what was passed
        const greyTint = 0x777777;
        
        // This updates the emitter config with the grey tint
        this.footstepEmitter.setConfig({
            tint: greyTint,
            speed: { min: 8, max: 16 },
            angle: { min: 180, max: 360 }, // Full 180° range (half-circle upward)
            scale: { start: 0.8, end: 1.3 },
            alpha: { start: 0.5, end: 0 }, // Reduced starting alpha for more transparency
            lifespan: { min: 300, max: 500 },
            blendMode: Phaser.BlendModes.NORMAL,
            gravityY: -30,
            quantity: 4,
            frequency: -1,
            emitting: false,
            rotate: { min: -45, max: 45 } // More varied rotation
        });
        
        // Create a more varied foot-focused spread pattern
        const footWidth = 20; // Increased from 10 for wider horizontal spread
        const baseCount = 4;
        
        // Create several puffs with random offsets along the foot area
        for (let i = 0; i < 3; i++) {
            // Random x-offset within foot width
            const offsetX = Phaser.Math.Between(-footWidth, footWidth);
            // Random y-offset to make dust appear from different parts of the foot (all at bottom)
            const offsetY = Phaser.Math.Between(-5, 5); // Increased from -2, 2 for more vertical spread
            // Random particle count for each puff
            const particleCount = Phaser.Math.Between(1, baseCount);
            
            // Emit particles at this offset
            this.footstepEmitter.explode(particleCount, x + offsetX, y + offsetY);
        }
    }

    public destroy(): void {
        for (const emitterOrGroup of this.projectileImpactEmitters.values()) {
            if (emitterOrGroup instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
                emitterOrGroup.destroy();
            } else { 
                const group = emitterOrGroup as Record<string, Phaser.GameObjects.Particles.ParticleEmitter>; 
                for (const key in group) {
                    if (Object.prototype.hasOwnProperty.call(group, key)) {
                        const emitter = group[key];
                        if (emitter && typeof emitter.destroy === 'function') {
                             emitter.destroy();
                        }
                    }
                }
            }
        }
        this.projectileImpactEmitters.clear();

        if (this.enemyDeathEmitter) {
            this.enemyDeathEmitter.destroy();
        }
        if (this.footstepEmitter) {
            this.footstepEmitter.destroy();
        }
    }
} 