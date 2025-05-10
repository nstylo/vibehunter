import Phaser from 'phaser';
import type { ParticleSystem } from '../systems/ParticleSystem';
import PROJECTILE_DEFINITIONS from '../definitions/projectiles.json'; // Import projectile definitions

export enum ProjectileType {
  BULLET = 'BULLET',
  LASER = 'LASER', // Not yet in JSON, will need definition if used
  FIREBALL = 'FIREBALL',
  // Add more types as needed
}

interface ProjectileDefinition {
    type: string;
    textureName: string;
    width: number;
    height: number;
    color: string; // Hex string like "0xffffff"
    impactParticleEffect: string; // Retained for potential future use, not directly driving ParticleSystem logic now
    impactSoundKey: string;
}

// Texture key prefix for projectiles
const PROJECTILE_TEXTURE_KEY_PREFIX = 'projectile_texture_';

// We will extend Phaser.Physics.Arcade.Sprite directly
export default class ProjectileSprite extends Phaser.Physics.Arcade.Sprite {
  public ownerId: string;
  public lifeMs: number;
  public damageAmount: number;
  public speed: number; // Speed of the projectile

  private projectileDef: ProjectileDefinition | undefined;
  private particleSystem?: ParticleSystem;
  private projectileTypeEnum: ProjectileType; // Store the enum for ParticleSystem

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    projectileType: ProjectileType, // Keep enum for type safety at creation
    ownerId: string,
    damageAmount: number,
    speed: number,
    lifeMs: number,
    scaleFactor?: number, // Renamed from scale to scaleFactor for clarity
    particleSystem?: ParticleSystem
  ) {
    const typeStr = ProjectileType[projectileType];
    const definition = PROJECTILE_DEFINITIONS.find(def => def.type === typeStr) as ProjectileDefinition | undefined;

    if (!definition) {
        console.error(`ProjectileSprite: No definition found for type: ${typeStr}. Using fallback.`);
        // Fallback texture generation if no definition is found
        const fallbackTextureKey = `projectile_fallback_${Date.now()}`;
        ProjectileSprite.generateFallbackTexture(scene, fallbackTextureKey);
        super(scene, x, y, fallbackTextureKey);
        this.projectileDef = undefined; // Explicitly set to undefined
    } else {
        if (!scene.textures.exists(definition.textureName)) {
            ProjectileSprite.generateProjectileTextureFromDef(scene, definition);
        }
        super(scene, x, y, definition.textureName);
        this.projectileDef = definition;
    }

    this.ownerId = ownerId;
    this.damageAmount = damageAmount;
    this.speed = speed;
    this.lifeMs = lifeMs;
    this.particleSystem = particleSystem;
    this.projectileTypeEnum = projectileType; // Store the passed enum type

    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (this.body instanceof Phaser.Physics.Arcade.Body) {
      this.body.setCollideWorldBounds(false);
    }

    if (scaleFactor !== undefined) {
        this.setScale(scaleFactor);
    }
    
    // Apply body size based on definition (if available) and scale
    const bodyWidth = this.projectileDef ? this.projectileDef.width : 8; // Default if no def
    const bodyHeight = this.projectileDef ? this.projectileDef.height : 8; // Default if no def
    
    if (this.body instanceof Phaser.Physics.Arcade.Body) {
        // For circular projectiles, a common pattern is to use half the width (or min(width,height)) as radius
        // Assuming bullet and fireball are roughly circular
        if (this.projectileDef && (this.projectileDef.type === 'BULLET' || this.projectileDef.type === 'FIREBALL')) {
            this.body.setCircle((bodyWidth / 2) * this.scaleX);
        } else {
            // Default rectangular body, adjusted by scale
            this.body.setSize(bodyWidth * this.scaleX, bodyHeight * this.scaleY);
        }
    }
  }

  // Generate texture based on definition
  static generateProjectileTextureFromDef(scene: Phaser.Scene, definition: ProjectileDefinition): void {
    const graphics = scene.add.graphics();
    const color = Number.parseInt(definition.color, 16); // Use Number.parseInt

    graphics.fillStyle(color, 1);
    // Simple rectangle for now, could be more complex based on type or a new 'shape' field in JSON
    graphics.fillRect(0, 0, definition.width, definition.height);
    
    graphics.generateTexture(definition.textureName, definition.width, definition.height);
    graphics.destroy();
  }

  // Fallback texture for when a definition is missing
  static generateFallbackTexture(scene: Phaser.Scene, textureKey: string): void {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0xff00ff, 1); // Magenta for unknown/fallback
    graphics.fillRect(0, 0, 8, 8);
    graphics.generateTexture(textureKey, 8, 8);
    graphics.destroy();
  }
  
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    this.lifeMs -= delta;
    if (this.lifeMs <= 0) {
      this.setActive(false);
      this.setVisible(false);
      this.destroy();
    }
  }

  public impact(): void {
    if (!this.active) return;

    this.setActive(false);
    this.setVisible(false);
    
    if (this.particleSystem) { // No need to check this.projectileDef for this call
      this.particleSystem.playProjectileImpact(this.projectileTypeEnum, this.x, this.y, this.scaleX);
    }
    
    // TODO: Add sound playback here using this.projectileDef?.impactSoundKey
    if (this.projectileDef?.impactSoundKey) {
        // Example: this.scene.sound.play(this.projectileDef.impactSoundKey);
        // console.log(`Playing sound: ${this.projectileDef.impactSoundKey}`); // Placeholder
    }
    
    this.destroy();
  }
} 