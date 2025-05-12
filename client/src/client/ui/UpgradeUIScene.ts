import Phaser from 'phaser';
import type { ProgressionSystem, UpgradeChoice } from '../systems/ProgressionSystem';

const UPGRADE_FONT_FAMILY = 'Arial';

export class UpgradeUIScene extends Phaser.Scene {
    private choices: UpgradeChoice[] = [];
    private progressionSystem!: ProgressionSystem;
    private currentLevel = 1;

    constructor() {
        super({ key: 'UpgradeUIScene' });
    }

    init(data: { choices: UpgradeChoice[], progressionSystem: ProgressionSystem, level: number }): void {
        this.choices = data.choices;
        this.progressionSystem = data.progressionSystem;
        this.currentLevel = data.level;

        // Check if there are any choices
        if (this.choices.length === 0) {
            console.warn('No upgrade choices available for level up UI');
            // We'll handle this in create()
        }

        // Don't pause the game, just make sure this scene is on top
        this.scene.bringToTop();
    }

    create(): void {
        const cam = this.cameras.main;

        // Set the camera to ignore the game's camera movement
        this.cameras.main.setScroll(0, 0);

        // Add a drop shadow effect for better readability without background
        const dropShadow = {
            offsetX: 2,
            offsetY: 2,
            color: '#000000',
            blur: 4,
            fill: true
        };

        // Adjust title and card positions with more spacing
        const titleYPosition = 80; // Move down for more space from top
        const levelTextYPosition = titleYPosition + 60; // More space below title
        const cardsYPosition = levelTextYPosition + 100; // More space below level text

        // Main title - bigger and with shadow
        const titleText = this.add.text(
            cam.centerX,
            titleYPosition,
            'Level Up!',
            {
                fontFamily: UPGRADE_FONT_FAMILY,
                fontSize: '48px', // Larger font
                color: '#ffd700', // Gold color for level up
                fontStyle: 'bold',
                align: 'center',
                stroke: '#000000', // Add a stroke for better visibility against game
                strokeThickness: 6 // Thicker stroke for better visibility
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(20)
            .setShadow(dropShadow.offsetX, dropShadow.offsetY, dropShadow.color, dropShadow.blur, dropShadow.fill);

        // If there are no choices, show a message and auto-close after a delay
        if (this.choices.length === 0) {
            const noChoicesText = this.add.text(
                cam.centerX,
                cam.centerY,
                'No upgrades available right now.',
                {
                    fontFamily: UPGRADE_FONT_FAMILY,
                    fontSize: '32px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(20)
                .setShadow(dropShadow.offsetX, dropShadow.offsetY, dropShadow.color, dropShadow.blur, dropShadow.fill);
                
            // Add a level text
            this.add.text(
                cam.centerX,
                levelTextYPosition,
                `You reached Level ${this.currentLevel}!`,
                {
                    fontFamily: UPGRADE_FONT_FAMILY,
                    fontSize: '28px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(20)
                .setShadow(dropShadow.offsetX, dropShadow.offsetY, dropShadow.color, dropShadow.blur, dropShadow.fill);
                
            // Auto-close after a delay
            this.time.delayedCall(2000, () => {
                this.progressionSystem.resumeGameAfterUpgrade();
            });
            
            return;
        }

        // Level information - larger with shadow
        const levelInfoText = this.add.text(
            cam.centerX,
            levelTextYPosition,
            `You reached Level ${this.currentLevel}! Choose an upgrade:`,
            {
                fontFamily: UPGRADE_FONT_FAMILY,
                fontSize: '28px', // Larger font
                color: '#ffffff', // Brighter text
                fontStyle: 'bold',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(20)
            .setShadow(dropShadow.offsetX, dropShadow.offsetY, dropShadow.color, dropShadow.blur, dropShadow.fill);

        const numChoices = this.choices.length;
        const cardWidth = 300; // Wider cards
        const cardHeight = 150; // Taller cards
        const cardMargin = 50; // More space between cards
        const totalCardsWidth = (numChoices * cardWidth) + ((numChoices - 1) * cardMargin);
        const initialXOffset = cam.centerX - totalCardsWidth / 2;

        const localCardContainers: Phaser.GameObjects.Container[] = []; // To store card containers for keyboard interaction

        this.choices.forEach((choice, index) => {
            const cardX = initialXOffset + cardWidth / 2 + index * (cardWidth + cardMargin);
            const cardY = cardsYPosition;

            const cardContainer = this.add.container(cardX, cardY);
            cardContainer.setDepth(30);
            cardContainer.setScrollFactor(0);

            // Card background with more padding and rounded corners
            const cardBackground = this.add.graphics();
            cardBackground.fillStyle(0x282828, 0.95); // More opaque background
            cardBackground.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16); // More rounded corners
            cardBackground.lineStyle(3, 0x555555, 1); // Thicker border
            cardBackground.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
            cardBackground.setScrollFactor(0);
            cardContainer.add(cardBackground);

            // Title positioned higher in the card for more spacing
            const choiceNameText = this.add.text(
                0,
                -cardHeight / 2 + 35, // More space from top
                choice.name,
                {
                    fontFamily: UPGRADE_FONT_FAMILY,
                    fontSize: '26px', // Larger font
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center',
                    wordWrap: { width: cardWidth - 40 }, // More padding
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setScrollFactor(0);
            cardContainer.add(choiceNameText);

            // Description moved lower for more spacing
            const choiceDescText = this.add.text(
                0,
                cardHeight / 2 - 40, // More space from bottom
                choice.description,
                {
                    fontFamily: UPGRADE_FONT_FAMILY,
                    fontSize: '18px', // Larger font
                    color: '#cccccc',
                    align: 'center',
                    wordWrap: { width: cardWidth - 40 }, // More padding
                    stroke: '#000000',
                    strokeThickness: 2
                }
            ).setOrigin(0.5).setScrollFactor(0);
            cardContainer.add(choiceDescText);

            // Add number text (1, 2, or 3) to the bottom-right corner of the card
            const numberText = this.add.text(
                cardWidth / 2 - 15, // Position from the right edge
                cardHeight / 2 - 15, // Position from the bottom edge
                (index + 1).toString(),
                {
                    fontFamily: UPGRADE_FONT_FAMILY,
                    fontSize: '22px', // Prominent but not overpowering
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'right',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(1, 1).setScrollFactor(0); // Origin bottom-right
            cardContainer.add(numberText);

            cardContainer.setSize(cardWidth, cardHeight);
            cardContainer.setInteractive()
                .on(Phaser.Input.Events.POINTER_DOWN, () => {
                    this.tweens.add({
                        targets: cardContainer,
                        scaleX: 0.95,
                        scaleY: 0.95,
                        duration: 80,
                        yoyo: true,
                        onComplete: () => {
                            cardContainer.setScale(1);
                            this.selectUpgrade(choice);
                        }
                    });
                })
                .on(Phaser.Input.Events.POINTER_OVER, () => {
                    this.tweens.add({
                        targets: cardContainer,
                        scaleX: 1.05,
                        scaleY: 1.05,
                        duration: 150,
                        ease: 'Power1'
                    });
                    cardBackground.clear();
                    cardBackground.fillStyle(0x3a3a3a, 0.95); // More opaque hover state
                    cardBackground.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                    cardBackground.lineStyle(3, 0x00ff00, 1); // Thicker highlight border
                    cardBackground.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                })
                .on(Phaser.Input.Events.POINTER_OUT, () => {
                    this.tweens.add({
                        targets: cardContainer,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 150,
                        ease: 'Power1'
                    });
                    cardBackground.clear();
                    cardBackground.fillStyle(0x282828, 0.95);
                    cardBackground.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                    cardBackground.lineStyle(3, 0x555555, 1);
                    cardBackground.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                });
            localCardContainers.push(cardContainer); // Store the container
        });

        // Add keyboard listeners for 1, 2, 3 keys
        const keyEventNames = ['ONE', 'TWO', 'THREE'];
        keyEventNames.forEach((keyName, index) => {
            if (index < this.choices.length) { // Check if the choice for this key exists
                const choiceToSelect = this.choices[index];
                const containerToAnimate = localCardContainers[index]; // Corresponding container

                this.input.keyboard?.on(`keydown-${keyName}`, () => {
                    if (choiceToSelect) { // Ensure choiceToSelect is defined
                        if (containerToAnimate) {
                            // Trigger the same animation and selection logic as POINTER_DOWN
                            this.tweens.add({
                                targets: containerToAnimate,
                                scaleX: 0.95,
                                scaleY: 0.95,
                                duration: 80,
                                yoyo: true,
                                onComplete: () => {
                                    containerToAnimate.setScale(1);
                                    this.selectUpgrade(choiceToSelect);
                                }
                            });
                        } else {
                            // Fallback if container somehow not found (should not happen if logic is correct)
                            this.selectUpgrade(choiceToSelect);
                        }
                    }
                });
            }
        });
    }

    private selectUpgrade(choice: UpgradeChoice): void {
        if (choice) {
            this.progressionSystem.applyUpgrade(choice.id);
            this.progressionSystem.resumeGameAfterUpgrade(); // This method might need renaming or repurposing now

            // No longer resuming the main game scene as it's not paused by this UI
            // if (this.scene.isPaused(MAIN_GAME_SCENE_KEY)) {
            //     this.scene.resume(MAIN_GAME_SCENE_KEY);
            // }

            this.scene.stop(); // Stop this UI scene
        }
    }
} 