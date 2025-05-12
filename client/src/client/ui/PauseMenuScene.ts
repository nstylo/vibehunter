import Phaser from 'phaser';
import { GameEvent } from '../../common/events';

export class PauseMenuScene extends Phaser.Scene {
  private menuContainer: Phaser.GameObjects.Container | null = null;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  
  constructor() {
    super({ key: 'PauseMenuScene' });
  }

  create() {
    // Add semi-transparent dark overlay
    this.overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    );
    
    // Create container for menu items
    this.menuContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2);
    
    // Add pause menu title
    const titleText = this.add.text(0, -120, 'GAME PAUSED', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    
    // Create resume button only (quit button removed as requested)
    const resumeButton = this.createButton(0, 0, 'Resume Game', this.onResumeClicked.bind(this));
    
    // Add all elements to the container
    this.menuContainer.add([titleText, resumeButton]);
    
    // Ensure this scene stays on top
    this.scene.bringToTop();
  }
  
  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const buttonWidth = 200;
    const buttonHeight = 50;
    
    const container = this.add.container(x, y);
    
    // Button background
    const background = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x444444)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => background.setFillStyle(0x666666))
      .on('pointerout', () => background.setFillStyle(0x444444))
      .on('pointerdown', () => background.setFillStyle(0x222222))
      .on('pointerup', () => {
        background.setFillStyle(0x666666);
        callback();
      });
    
    // Button border
    const border = this.add.rectangle(0, 0, buttonWidth, buttonHeight)
      .setStrokeStyle(2, 0xffffff);
    
    // Button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    container.add([background, border, buttonText]);
    return container;
  }
  
  private onResumeClicked(): void {
    // Tell GameScene to resume - don't try to sleep this scene ourselves
    this.game.events.emit(GameEvent.RESUME_GAME);
    // We don't call scene.sleep() here anymore - GameScene will handle that
  }
  
  shutdown(): void {
    // Clean up resources
    if (this.menuContainer) {
      this.menuContainer.destroy();
      this.menuContainer = null;
    }
    
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
  }
} 