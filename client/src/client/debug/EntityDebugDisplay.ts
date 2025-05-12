import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { EntitySprite } from '../objects/EntitySprite';

export abstract class EntityDebugDisplay<T extends EntitySprite> {
    protected scene: GameScene;
    protected debugTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    protected isVisible: boolean = false;
    protected readonly Y_OFFSET = -10; // Offset above the entity
    protected readonly LINE_HEIGHT = 14; // Reduced line height for more compact display
    protected readonly TEXT_STYLE = {
        fontFamily: 'monospace',
        fontSize: '11px', // Smaller font size
        color: '#00ff00',
        backgroundColor: 'rgba(0,0,0,0.6)', // More transparent background
        padding: { x: 3, y: 2 }, // Reduced padding
        align: 'left'
    };

    constructor(scene: GameScene) {
        this.scene = scene;
    }

    public toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        this.debugTexts.forEach(text => {
            text.setVisible(this.isVisible);
        });
        if (!this.isVisible) {
            this.clearAllDebugTexts();
        }
    }

    public update(entities: Phaser.GameObjects.Group | T[]): void {
        if (!this.isVisible) {
            this.clearAllDebugTexts();
            return;
        }

        const activeEntities = new Set<string>();
        const entityObjects = entities instanceof Phaser.GameObjects.Group 
            ? entities.getChildren() 
            : entities;

        entityObjects.forEach(entityObject => {
            const entity = entityObject as T;
            if (!entity.active || !entity.body) {
                this.removeDebugTextForEntity(entity.entityId);
                return;
            }

            activeEntities.add(entity.entityId);
            let debugText = this.debugTexts.get(entity.entityId);

            const infoLines = this.getEntityInfoLines(entity);
            const textContent = infoLines.join('\n');

            if (debugText) {
                debugText.setText(textContent);
                debugText.setPosition(
                    entity.x, 
                    entity.y + this.Y_OFFSET - (infoLines.length * this.LINE_HEIGHT / 2)
                );
                debugText.setOrigin(0.5, 1);
                debugText.setVisible(true);
            } else {
                debugText = this.scene.add.text(
                    entity.x,
                    entity.y + this.Y_OFFSET - (infoLines.length * this.LINE_HEIGHT / 2),
                    textContent,
                    this.TEXT_STYLE
                );
                debugText.setOrigin(0.5, 1);
                debugText.setDepth(9999);
                this.debugTexts.set(entity.entityId, debugText);
            }
        });

        // Remove texts for entities that are no longer active
        this.debugTexts.forEach((text, entityId) => {
            if (!activeEntities.has(entityId)) {
                this.removeDebugTextForEntity(entityId);
            }
        });
    }

    protected abstract getEntityInfoLines(entity: T): string[];

    protected removeDebugTextForEntity(entityId: string): void {
        const debugText = this.debugTexts.get(entityId);
        if (debugText) {
            debugText.destroy();
            this.debugTexts.delete(entityId);
        }
    }

    public clearAllDebugTexts(): void {
        this.debugTexts.forEach(text => {
            text.destroy();
        });
        this.debugTexts.clear();
    }

    public destroy(): void {
        this.clearAllDebugTexts();
    }
} 