import type Phaser from 'phaser';
import { CellType } from '../../common/world';
import type { WorldGen } from './WorldGen';
import {
    generateTilesetTexture,
    getTileIndexForCellType,
    GENERATED_TILESET_KEY,
    TILE_WIDTH as GENERATED_TILE_WIDTH,
    TILE_HEIGHT as GENERATED_TILE_HEIGHT
} from '../utils/TileTextureGenerator';

export class ChunkRenderer {
    private scene: Phaser.Scene;
    public tilemapLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private worldGen: WorldGen;

    constructor(scene: Phaser.Scene, worldGen: WorldGen) {
        this.scene = scene;
        this.worldGen = worldGen; // Store worldGen instance

        // Generate the tileset texture first
        generateTilesetTexture(this.scene);

        this.createTilemap(worldGen.worldData);
    }

    private createTilemap(worldData: CellType[][]): void {
        const mapHeight = worldData.length;
        if (mapHeight === 0) {
            console.error('ChunkRenderer: Invalid world data (empty rows) for tilemap creation.');
            return;
        }
        const mapWidth = worldData[0]?.length ?? 0; // Use optional chaining and nullish coalescing

        if (mapWidth === 0) {
            console.error('ChunkRenderer: Invalid world data (empty columns) for tilemap creation.');
            return;
        }

        // 'null' for map data means an empty map. Then fill it with putTileAt.
        const map = this.scene.make.tilemap({ 
            data: undefined, // Use undefined for manually filled maps
            tileWidth: GENERATED_TILE_WIDTH, 
            tileHeight: GENERATED_TILE_HEIGHT,
            width: mapWidth,
            height: mapHeight
        });

        // Add the generated tileset image to the map.
        const tileset = map.addTilesetImage(
            GENERATED_TILESET_KEY, // Key of the generated texture
            undefined, // Not using an external image key from preload
            GENERATED_TILE_WIDTH,
            GENERATED_TILE_HEIGHT,
            0, // margin
            0  // spacing
        );
        if (!tileset) {
            console.error('ChunkRenderer: Failed to add generated tileset. Ensure texture was created.');
            return;
        }

        // Create a blank layer.
        this.tilemapLayer = map.createBlankLayer('ground', tileset, 0, 0);
        if (!this.tilemapLayer) {
            console.error('ChunkRenderer: Failed to create tilemap layer.');
            return;
        }

        // Populate the layer
        for (let y = 0; y < mapHeight; y++) {
            const row = worldData[y];
            if (!row) continue;
            for (let x = 0; x < mapWidth; x++) {
                const cell = row[x];
                if (cell === undefined) {
                    console.warn(`ChunkRenderer: Undefined cell at (${x},${y}), defaulting to empty.`);
                    this.tilemapLayer.putTileAt(getTileIndexForCellType(CellType.EMPTY), x, y);
                    continue;
                }
                const tileIndex = getTileIndexForCellType(cell);
                this.tilemapLayer.putTileAt(tileIndex, x, y);
            }
        }
        this.tilemapLayer.setDepth(-1); // Render behind other game objects
    }

    public update(): void {
        // Static rendering, so likely no update needed unless chunks are dynamic (not in current plan)
    }
} 