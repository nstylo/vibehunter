import Phaser from 'phaser';
import type { ParticleSystem } from '../systems/ParticleSystem';
import PROJECTILE_DEFINITIONS from '../definitions/projectiles.json'; // Import projectile definitions
import { DataManager } from '../systems/DataManager'; // ADDED: Import DataManager

export enum ProjectileType {
  BULLET = 'BULLET',
  LASER = 'LASER', // Not yet in JSON, will need definition if used
  PEPPER_SPRAY = 'PEPPER_SPRAY',
  PUDDLE = 'PUDDLE',
  SYRINGE = 'SYRINGE',
  FLAME = 'FLAME',
  TICKET = 'TICKET',
  SHOUT = 'SHOUT',
  TASER = 'TASER',
  FLASHLIGHT_BEAM = 'FLASHLIGHT_BEAM',
  LID_TOSS = 'LID_TOSS',
  TEXTBOOK = 'TEXTBOOK',
  HOSE_SPRAY = 'HOSE_SPRAY',
  TRANQUILIZER_DART = 'TRANQUILIZER_DART',
  SNARE = 'SNARE',
  BOTTLE = 'BOTTLE',
  // ADDED: Ensure all types from projectiles.json are here
  PAPER_PROJECTILE = 'PAPER_PROJECTILE',
  GHOST_COIN = 'GHOST_COIN',
  SOUND_WAVE = 'SOUND_WAVE',
  MUD_PATCH = 'MUD_PATCH',
  CAN_SHARD = 'CAN_SHARD',
  TRASH_BALL = 'TRASH_BALL',
  DIGITAL_GLYPH = 'DIGITAL_GLYPH',
  CRYPTO_COIN = 'CRYPTO_COIN',
  ENERGY_BLAST = 'ENERGY_BLAST',
  PAPER_SHURIKEN = 'PAPER_SHURIKEN',
  AIR_GUST = 'AIR_GUST'
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
    this.projectileTypeEnum = projectileType;

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
    const { width, height, type } = definition;

    // Common setup
    // Reset fillStyle before each new projectile type drawing if not explicitly set

    // Draw shapes based on projectile type
    switch (type) {
      case ProjectileType.BULLET: {
        graphics.fillStyle(color, 1);
        // Use fillEllipse to create a pointed oval shape, avoiding quadraticCurveTo
        graphics.fillEllipse(width / 2, height / 2, width, height * 0.7); // Main body of the bullet (more oval)
        // Add a triangular tip for a more "pointed" look if desired, or rely on texture scaling
        // For simplicity, we'll stick to a slightly more elongated ellipse here.
        // Highlight
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillEllipse(width * 0.6, height * 0.4, width * 0.3, height * 0.2);
        break;
      }

      case ProjectileType.PEPPER_SPRAY: {
        // Multiple semi-transparent ellipses for a spray effect within a fan shape
        graphics.fillStyle(color, 0.3); // Base color with more transparency
        for (let i = 0; i < 15; i++) {
          const sprayX = width / 2 + (Math.random() - 0.5) * width * (i /15) * 1.5;
          const sprayY = height - (Math.random() * height * (i/15));
          const sprayRadius = Math.random() * (width / 8) + (width/10) ;
          // Ensure particles generally stay within a fan shape pointing upwards from origin (0, height)
          if ( sprayY < height && sprayY > 0 && Math.abs(sprayX - width/2) < (sprayY/height) * width/2 + sprayRadius) {
             graphics.fillEllipse(sprayX, sprayY, sprayRadius, sprayRadius);
          }
        }
        // A slightly more opaque core for the fan
        graphics.fillStyle(color, 0.5);
        graphics.beginPath();
        graphics.moveTo(width * 0.4, height); 
        graphics.lineTo(0, height * 0.2);
        graphics.lineTo(width, height * 0.2);        
        graphics.closePath();
        graphics.fillPath();
        break;
      }

      case ProjectileType.PUDDLE: {
        graphics.fillStyle(color, 0.8);
        graphics.fillEllipse(width / 2, height / 2, width, height * 0.75); // Flatter ellipse
        // Add some ripples/highlights
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillEllipse(width / 2, height * 0.4, width * 0.7, height * 0.2);
        graphics.fillEllipse(width * 0.4, height * 0.5, width * 0.2, height * 0.1);
        graphics.fillEllipse(width * 0.6, height * 0.6, width * 0.3, height * 0.15);
        break;
      }

      case ProjectileType.SYRINGE: {
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, height * 0.35, width * 0.7, height * 0.3); // Main body tube
        graphics.fillStyle(0xcccccc, 1); // Plunger color
        graphics.fillRect(width * 0.05, height * 0.4, width * 0.6, height * 0.2); // Inner part of plunger (contents)
        graphics.fillStyle(0xaaaaaa, 1); // Plunger end color
        graphics.fillRect(width * 0.7, height * 0.3, width * 0.1, height * 0.4); // Plunger end
        // Needle part
        graphics.fillStyle(0xbbbbbb, 1); // Metal color
        graphics.fillRect(width * 0.8, height * 0.45, width * 0.2, height * 0.1); 
        break;
      }

      case ProjectileType.FLAME: {
        // More complex flame shape - multiple overlapping irregular shapes
        graphics.fillStyle(0xff3300, 0.7); // Base red-orange, semi-transparent
        graphics.fillEllipse(width / 2, height / 2, width, height); 
        graphics.fillStyle(0xffaa00, 0.8); // Orange, more opaque
        graphics.fillEllipse(width / 2 + (Math.random()-0.5)*width*0.1, height / 2 + (Math.random()-0.5)*height*0.1, width * 0.8, height * 0.8);
        graphics.fillStyle(0xffff00, 0.6); // Yellow highlight, semi-transparent
        graphics.fillEllipse(width / 2 + (Math.random()-0.5)*width*0.15, height / 2 + (Math.random()-0.5)*height*0.15, width * 0.5, height * 0.5);
        // Add some flickering tips
        graphics.fillStyle(0xff3300, 0.9);
        graphics.fillEllipse(width / 2, height * 0.1, width * 0.3, height * 0.2);
        graphics.fillStyle(0xffaa00, 0.9);
        graphics.fillEllipse(width * 0.3, height * 0.3, width * 0.2, height * 0.3);
        graphics.fillEllipse(width * 0.7, height * 0.3, width * 0.2, height * 0.3);
        break;
      }

      case ProjectileType.TICKET: {
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, width, height); // Simple rectangle
        // Add some faint lines to simulate text/details
        graphics.fillStyle(0x333333, 0.5);
        for (let i = 1; i < 4; i++) {
            graphics.fillRect(width * 0.1, height * (0.15 + i * 0.2), width * 0.8, height * 0.05);
        }
        // Perforated edge (simple version)
        graphics.fillStyle(0x000000, 0.2);
        for (let i = 0; i < height; i += height/6) {
            graphics.fillRect(width * 0.92, i, width * 0.03, height/12);
        }
        break;
      }

      case ProjectileType.SHOUT: {
        graphics.lineStyle(Math.max(1, width / 10), color, 0.3); // Thinner, more transparent base
        graphics.beginPath();
        graphics.arc(width / 2, height / 2, width * 0.15, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false);
        graphics.strokePath();
        graphics.lineStyle(Math.max(1.5, width / 8), color, 0.6);
        graphics.beginPath();
        graphics.arc(width / 2, height / 2, width * 0.3, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false);
        graphics.strokePath();
        graphics.lineStyle(Math.max(2, width / 7), color, 0.4);
        graphics.beginPath();
        graphics.arc(width / 2, height / 2, width * 0.45, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false);
        graphics.strokePath();
        break;
      }

      case ProjectileType.TASER: {
        graphics.lineStyle(Math.max(1, height / 5), color, 1);
        graphics.beginPath();
        // Main bolt
        graphics.moveTo(0, height / 2);
        graphics.lineTo(width * 0.2, height * 0.3);
        graphics.lineTo(width * 0.4, height * 0.7);
        graphics.lineTo(width * 0.6, height * 0.2);
        graphics.lineTo(width * 0.8, height * 0.8);
        graphics.lineTo(width, height / 2);
        graphics.strokePath();
        // Sparks/glow around it
        graphics.fillStyle(color, 0.3);
        for(let i=0; i<5; i++) {
            const sparkX = Math.random() * width;
            const sparkY = Math.random() * height;
            graphics.fillCircle(sparkX, sparkY, width * 0.05);
        }
        break;
      }

      case ProjectileType.FLASHLIGHT_BEAM: {
        // Gradient-like effect for the beam
        graphics.fillStyle(color, 0.2); // Outer, more transparent part
        graphics.fillRect(0, 0, width, height);
        graphics.fillStyle(color, 0.5); // Middle part
        graphics.fillRect(width * 0.15, 0, width * 0.7, height);
        graphics.fillStyle(0xffffff, 0.7); // Brighter, slightly transparent white core
        graphics.fillRect(width * 0.3, 0, width * 0.4, height);
        // Lens flare/bright spot at origin (optional)
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(width * 0.5, height * 0.9, width * 0.3); // Assuming beam emits from bottom center if vertical
        break;
      }

      case ProjectileType.LID_TOSS: {
        // Lid main color
        graphics.fillStyle(color, 1);
        graphics.fillCircle(width / 2, height / 2, Math.min(width, height) / 2);
        // Darker inner circle for depth
        graphics.fillStyle(0x555555, 1);
        graphics.fillCircle(width / 2, height / 2, Math.min(width, height) / 2 * 0.85);
        // Original color for the very center (simulating a handle mount or reflection)
        graphics.fillStyle(color, 1);
        graphics.fillCircle(width / 2, height / 2, Math.min(width, height) / 2 * 0.3);
        // Slight highlight
        graphics.fillStyle(0xeeeeee, 0.3);
        graphics.fillEllipse(width/2 + width * 0.1, height/2 - height * 0.1, width*0.3, height*0.2);
        break;
      }

      case ProjectileType.TEXTBOOK: {
        graphics.fillStyle(color, 1); // Cover color uses the parsed numeric color
        graphics.fillRect(0, 0, width, height); 
        // Pages area (slightly inset and lighter)
        graphics.fillStyle(0xe0e0e0, 1); 
        graphics.fillRect(width * 0.05, height * 0.1, width * 0.8, height * 0.8);
        // Binding (darker shade of cover or specific color)
        const bindingColor = Phaser.Display.Color.ValueToColor(color).darken(30).color;
        graphics.fillStyle(bindingColor, 1);
        graphics.fillRect(width * 0.85, 0, width * 0.15, height); // Spine on the right
        // Add a few lines for page effect on the side visible
        graphics.lineStyle(1, 0xaaaaaa, 0.7);
        for (let i=0; i < 5; i++) {
            const yPos = height * (0.15 + i * 0.15);
            graphics.beginPath();
            graphics.moveTo(width * 0.05, yPos);
            graphics.lineTo(width*0.8, yPos);
            graphics.strokePath();
        }
        break;
      }

      case ProjectileType.HOSE_SPRAY: {
        graphics.fillStyle(color, 0.6); // Semi-transparent water
        // Main stream - a tapering rectangle
        graphics.beginPath();
        graphics.moveTo(0, height * 0.3);
        graphics.lineTo(width, 0);
        graphics.lineTo(width, height);
        graphics.lineTo(0, height * 0.7);
        graphics.closePath();
        graphics.fillPath();
        // Add some droplet effects
        graphics.fillStyle(color, 0.8);
        for(let i=0; i < 5; i++) {
            graphics.fillCircle(Math.random() * width, Math.random() * height, width * 0.05);
        }
        break;
      }

      case ProjectileType.TRANQUILIZER_DART: {
        graphics.fillStyle(color, 1); // Dart body
        graphics.fillRect(0, height * 0.3, width * 0.7, height * 0.4); // Main shaft
        // "Flights" at the back
        graphics.fillStyle(0x888888, 1); // A grey for flights
        graphics.beginPath();
        graphics.moveTo(0, height * 0.3);
        graphics.lineTo(width * 0.2, 0);
        graphics.lineTo(width * 0.2, height);
        graphics.closePath();
        graphics.fillPath();
        // Needle tip
        graphics.fillStyle(0xC0C0C0, 1); // Silver color for needle tip
        graphics.fillRect(width * 0.7, height * 0.4, width * 0.3, height * 0.2);
        break;
      }

      case ProjectileType.SNARE: {
        graphics.lineStyle(Math.max(1, width / 10), color, 0.8);
        // Criss-cross lines for a net effect
        const step = width / 4;
        for (let i = 0; i <= width; i += step) {
            graphics.beginPath();
            graphics.moveTo(i, 0);
            graphics.lineTo(i, height);
            graphics.strokePath();
            graphics.beginPath();
            graphics.moveTo(0, i * (height/width)); // Adjust for non-square aspect ratios
            graphics.lineTo(width, i* (height/width));
            graphics.strokePath();
        }
        // Thicker border
        graphics.lineStyle(Math.max(2, width / 8), color, 1);
        graphics.strokeRect(0, 0, width, height);
        break;
      }

      case ProjectileType.BOTTLE: {
        graphics.fillStyle(color, 0.7); // Semi-transparent glass
        // Bottle body (ellipse)
        graphics.fillEllipse(width / 2, height * 0.6, width, height * 0.8);
        // Bottle neck (rectangle)
        graphics.fillRect(width * 0.3, 0, width * 0.4, height * 0.4);
        // Highlight
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillEllipse(width * 0.3, height * 0.3, width * 0.2, height * 0.3);
        break;
      }

      default: {
        // Fallback to simple rectangle if type is not specifically handled
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, width, height);
        break;
      }
    }
    
    graphics.generateTexture(definition.textureName, width, height);
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