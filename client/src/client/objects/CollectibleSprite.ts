import { EntitySprite } from './EntitySprite';
import Phaser from 'phaser';

export default class CollectibleSprite extends EntitySprite {
  public value: number; // e.g., XP amount or power-up type identifier
  private glowTween: Phaser.Tweens.Tween | null = null;
  private magnetRadius = 100; // Pixels. Type inferred.
  private collected = false; // Type inferred, was: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, value: number, frame?: string | number) {
    // Collectibles typically don't have an entityId from the server in the same way,
    // hp, maxHp, maxSpeed are also not very relevant.
    super(scene, x, y, textureKey, `collectible_${scene.time.now}_${Math.random()}`, 0, 0, 0);
    this.value = value;

    if (this.healthBarGraphics) {
      this.healthBarGraphics.destroy(); // No health bar for collectibles
    }

    // Example: Add a slight bobbing tween
    this.scene.tweens.add({
      targets: this,
      y: y - 5, // Move up by 5 pixels
      duration: 1000, // 1 second
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1 // Repeat indefinitely
    });

    // TODO: Initialize glow tween if needed, or start it on some condition
    // this.startGlow();
  }

  // Optional: Method to create a glowing effect
  startGlow() {
    if (this.glowTween) {
      this.glowTween.stop();
    }
    // This requires a separate texture or shader for a good glow effect.
    // For simplicity, we can tint or scale, but a real glow is more complex.
    // Example: a simple alpha pulse
    this.glowTween = this.scene.tweens.add({
        targets: this,
        alpha: { from: 0.7, to: 1.0 },
        ease: 'Sine.easeInOut',
        duration: 750,
        yoyo: true,
        repeat: -1
    });
  }

  update(time: number, delta: number, playerPosition?: Phaser.Math.Vector2) {
    super.preUpdate(time, delta); // For base class preUpdate logic

    if (this.collected || !this.active) return;

    // Magnet effect: Move towards the player if within magnetRadius
    if (playerPosition) {
      const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerPosition.x, playerPosition.y);

      if (distanceToPlayer < this.magnetRadius) {
        // Calculate direction towards player
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerPosition.x, playerPosition.y);
        // Move towards player - adjust speed as needed
        const moveSpeed = 200; // Pixels per second
        this.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);

        // Check for collection (e.g., very close to player)
        if (distanceToPlayer < 20) { // Collection threshold
          this.onCollect();
        }
      } else {
        this.setVelocity(0, 0); // Stop if player is out of range
      }
    }
  }

  private setVelocity(x: number, y: number) {
    if (this.body instanceof Phaser.Physics.Arcade.Body) {
        this.body.setVelocity(x,y);
    } else {
        // Fallback for manual position update if no physics body or different type
        const speed = Math.sqrt(x*x + y*y);
        if (speed > 0) {
            const deltaX = x / speed; // Normalized direction
            const deltaY = y / speed;
            // Assuming manual movement speed parameter if no physics body speed is directly applicable
            const manualMoveSpeed = 1; // Example, adjust as needed based on how x,y for setVelocity are derived
            this.x += deltaX * manualMoveSpeed; 
            this.y += deltaY * manualMoveSpeed;
        }
    }
  }

  onCollect() {
    if (this.collected) return;
    this.collected = true;
    this.setActive(false).setVisible(false);
    // Could play a sound or show a particle effect here
    
    // If using object pooling, return to pool instead of destroying
    // this.destroy(); // Or manage lifecycle via scene/system
  }

  // Call this if the collectible needs to be explicitly destroyed (e.g. not pooled)
  // destroy(fromScene?: boolean): void {
  //   if (this.glowTween) {
  //     this.glowTween.stop();
  //     this.glowTween = null;
  //   }
  //   super.destroy(fromScene);
  // }
} 