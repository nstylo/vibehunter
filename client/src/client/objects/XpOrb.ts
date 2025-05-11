import Phaser from 'phaser';
import type { PlayerSprite } from './PlayerSprite';

export class XpOrb extends Phaser.Physics.Arcade.Sprite {
    public xpValue: number;
    private targetPlayer: PlayerSprite;
    private magnetRadius: number;
    private magnetSpeed: number;
    private initialMoveDone = false;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, xpValue: number, targetPlayer: PlayerSprite) {
        super(scene, x, y, texture);

        this.xpValue = xpValue;
        this.targetPlayer = targetPlayer;
        this.magnetRadius = 300; // Pixels within which the orb starts moving towards the player
        this.magnetSpeed = 500;  // Pixels per second (Increased from 150)

        scene.add.existing(this);
        scene.physics.add.existing(this);

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.setCircle(this.width / 2); // Assuming orb is roughly circular
            this.body.setCollideWorldBounds(false); // Orbs might fly off screen if not collected
        }
        
        this.setScale(0.35); // Default scale for XP orbs
    }

    // Optional: Initial outward burst movement
    public initialBurst(targetX: number, targetY: number): void {
        if (this.scene && this.active) {
            this.scene.tweens.add({
                targets: this,
                x: targetX,
                y: targetY,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    this.initialMoveDone = true;
                }
            });
        }
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        if (!this.active || !this.targetPlayer?.active || !this.initialMoveDone) {
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                // Ensure it doesn't move if initial burst isn't done or conditions not met
                // However, if initial burst is active, the tween handles movement.
                // If no tween and initialMoveDone is false, it should probably be static.
                if(!this.initialMoveDone && (!this.scene.tweens.isTweening(this) && this.body)) {
                     this.body.setVelocity(0, 0);
                }
            }
            return;
        }

        const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);

        if (distanceToPlayer < this.magnetRadius) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                this.body.setVelocityX(Math.cos(angle) * this.magnetSpeed);
                this.body.setVelocityY(Math.sin(angle) * this.magnetSpeed);
            }
        } else {
            // Optional: if orbs have some drag or slow down when not actively pulled
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                 // this.body.setVelocity(0,0); // Stop if player is out of range - or let them drift
            }
        }
    }
} 