import Phaser from 'phaser';

export class CameraManager {
    private scene: Phaser.Scene;
    private currentZoom = 1;
    private targetZoom = 1;
    private minZoom = 0.5;
    private maxZoom = 2;
    private zoomFactor = 0.1;
    private zoomDuration = 50; // Duration of zoom animation in ms
    private currentZoomTween: Phaser.Tweens.Tween | null = null;
    private keyZoomIn!: Phaser.Input.Keyboard.Key;
    private keyZoomOut!: Phaser.Input.Keyboard.Key;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        
        // Setup key bindings
        if (this.scene.input.keyboard) {
            this.keyZoomIn = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
            this.keyZoomOut = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
        }
    }

    /**
     * Initialize the camera with target and bounds
     */
    public initialize(
        target: Phaser.GameObjects.GameObject | Phaser.Math.Vector2, 
        boundsX: number, 
        boundsY: number, 
        boundsWidth: number, 
        boundsHeight: number
    ): void {
        this.scene.cameras.main.startFollow(target, true, 1, 1);
        this.scene.cameras.main.setBounds(boundsX, boundsY, boundsWidth, boundsHeight);
        this.scene.cameras.main.roundPixels = true; // For smoother, pixel-perfect camera movement
        this.scene.cameras.main.setZoom(this.currentZoom);

        // Setup mousewheel zoom
        this.scene.input.on('wheel', (
            pointer: Phaser.Input.Pointer, 
            gameObjects: Phaser.GameObjects.GameObject[], 
            deltaX: number, 
            deltaY: number, 
            deltaZ: number
        ) => {
            if (deltaY > 0) {
                this.zoomOut();
            } else if (deltaY < 0) {
                this.zoomIn();
            }
        });
    }

    /**
     * Set the camera background color
     */
    public setBackgroundColor(color: string): void {
        this.scene.cameras.main.setBackgroundColor(color);
    }

    /**
     * Handle zoom-in control
     */
    public zoomIn(): void {
        if (this.targetZoom < this.maxZoom) {
            this.targetZoom = Math.min(this.maxZoom, this.targetZoom + this.zoomFactor);
            this.smoothZoom(this.targetZoom);
        }
    }

    /**
     * Handle zoom-out control
     */
    public zoomOut(): void {
        if (this.targetZoom > this.minZoom) {
            this.targetZoom = Math.max(this.minZoom, this.targetZoom - this.zoomFactor);
            this.smoothZoom(this.targetZoom);
        }
    }

    /**
     * Apply smooth zoom transition
     */
    private smoothZoom(targetZoom: number): void {
        // Stop any existing zoom tween
        if (this.currentZoomTween) {
            this.currentZoomTween.stop();
        }

        // Create a new tween to smoothly transition to the target zoom
        this.currentZoomTween = this.scene.tweens.add({
            targets: this.scene.cameras.main,
            zoom: targetZoom,
            duration: this.zoomDuration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.currentZoom = this.scene.cameras.main.zoom;
            },
            onComplete: () => {
                this.currentZoom = targetZoom;
                this.currentZoomTween = null;
            }
        });
    }

    /**
     * Update method to be called in the scene's update loop
     */
    public update(): void {
        // Handle keyboard zoom controls
        if (Phaser.Input.Keyboard.JustDown(this.keyZoomIn)) {
            this.zoomIn();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyZoomOut)) {
            this.zoomOut();
        }
    }

    /**
     * Cleanup resources when the scene is shut down
     */
    public destroy(): void {
        // Stop any active tweens
        if (this.currentZoomTween) {
            this.currentZoomTween.stop();
            this.currentZoomTween = null;
        }
        
        // Remove any event listeners
        this.scene.input.off('wheel');
    }
} 