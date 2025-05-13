import Phaser from 'phaser';
import { HitboxCollisionManager } from './HitboxCollisionManager';

export class MapInitializer {
    private scene: Phaser.Scene;
    private hitboxCollisionManager!: HitboxCollisionManager;
    private buildings!: Phaser.Physics.Arcade.StaticGroup;
    
    // Default map dimensions
    private mapWidth: number = 10000;
    private mapHeight: number = 10000;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * Initialize the game map and set up collisions
     * @returns An object containing map information and created physics bodies
     */
    public initialize(): { 
        mapWidth: number, 
        mapHeight: number, 
        buildings: Phaser.Physics.Arcade.StaticGroup,
        hitboxCollisionManager: HitboxCollisionManager
    } {
        // Display the static map
        this.scene.add.image(0, 0, 'mega-map').setOrigin(0, 0).setDepth(-20); // Ensure it's behind everything

        // Get map dimensions from JSON (or hardcode if known fixed)
        const mapHitboxData = this.scene.cache.json.get('mapHitboxData');
        this.mapWidth = mapHitboxData?.mapWidth ?? 10000; // Default to 10000 if not in JSON
        this.mapHeight = mapHitboxData?.mapHeight ?? 10000;

        // Set world bounds based on map dimensions
        this.scene.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

        // Initialize HitboxCollisionManager and create building colliders
        this.buildings = this.scene.physics.add.staticGroup();
        
        if (mapHitboxData?.objects) {
            this.hitboxCollisionManager = new HitboxCollisionManager(mapHitboxData.objects);
            
            for (const obj of this.hitboxCollisionManager.getAllObjects()) {
                if (obj.category === 'building') {
                    // Create a static physics body for each building
                    // Adjust origin if necessary, but x,y from JSON are usually top-left
                    const buildingCollider = this.buildings.create(
                        obj.x + obj.width / 2, 
                        obj.y + obj.height / 2, 
                        undefined
                    );
                    buildingCollider.setSize(obj.width, obj.height);
                    buildingCollider.setVisible(false); // The building is already part of the visual map
                    buildingCollider.refreshBody();
                }
            }
        } else {
            console.error("MapInitializer: Map hitbox data not found or invalid. Cannot create collision manager or buildings.");
            // Fallback or error state if map data is missing
            this.hitboxCollisionManager = new HitboxCollisionManager([]); // Init with empty if no data
        }

        return {
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            buildings: this.buildings,
            hitboxCollisionManager: this.hitboxCollisionManager
        };
    }

    /**
     * Add collision between game entities and map objects
     * @param entities Game entities to add collisions for
     */
    public setupCollisions(entities: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[] | Phaser.Physics.Arcade.Group): void {
        this.scene.physics.add.collider(entities, this.buildings);
    }
} 