import Phaser from 'phaser';
// Assuming CellType might be useful later, but not strictly for the initial implementation
// import { CellType } from '../../common/world'; 

interface MapObject {
    id: number;
    tileX: number; // May not be relevant for pixel-based collision
    tileY: number; // May not be relevant for pixel-based collision
    filename: string;
    category: string;
    x: number; // Pixel X coordinate of the object's top-left corner
    y: number; // Pixel Y coordinate of the object's top-left corner
    width: number; // Pixel width of the object
    height: number; // Pixel height of the object
    scale: number; // May not be directly used for collision if x,y,width,height are final
    // Add any other properties from your JSON if needed
}

export class HitboxCollisionManager {
    private objects: MapObject[];
    private solidCategories: Set<string>;

    constructor(objects: MapObject[]) {
        this.objects = objects;
        // Define which categories are considered solid
        this.solidCategories = new Set(['building']); 
        console.log(`HitboxCollisionManager initialized with ${this.objects.length} objects.`);
    }

    /**
     * Checks if a given point in world coordinates is inside any solid object.
     * @param worldX The x-coordinate in the world.
     * @param worldY The y-coordinate in the world.
     * @returns True if the point is inside a solid object, false otherwise.
     */
    public isSolidAt(worldX: number, worldY: number): boolean {
        for (const obj of this.objects) {
            if (this.solidCategories.has(obj.category)) {
                // Create a Phaser.Geom.Rectangle for the object
                const objRect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
                if (objRect.contains(worldX, worldY)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Retrieves the first solid object found at a given point in world coordinates.
     * @param worldX The x-coordinate in the world.
     * @param worldY The y-coordinate in the world.
     * @returns The map object if found, otherwise null.
     */
    public getSolidObjectAt(worldX: number, worldY: number): MapObject | null {
        for (const obj of this.objects) {
            if (this.solidCategories.has(obj.category)) {
                const objRect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
                if (objRect.contains(worldX, worldY)) {
                    return obj;
                }
            }
        }
        return null;
    }

    /**
     * Checks if a given Phaser.Geom.Rectangle intersects with any solid object.
     * @param checkRect The rectangle to check for collision (e.g., player's bounding box).
     * @returns An object with a 'collides' boolean and an optional 'object' that was collided with.
     */
    public checkSolidRectCollision(checkRect: Phaser.Geom.Rectangle): { collides: boolean; object?: MapObject } {
        for (const obj of this.objects) {
            if (this.solidCategories.has(obj.category)) {
                const objRect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
                if (Phaser.Geom.Intersects.RectangleToRectangle(checkRect, objRect)) {
                    return { collides: true, object: obj };
                }
            }
        }
        return { collides: false };
    }

    // Getter for all objects, could be useful for rendering debug hitboxes or other systems
    public getAllObjects(): ReadonlyArray<MapObject> {
        return this.objects;
    }
} 