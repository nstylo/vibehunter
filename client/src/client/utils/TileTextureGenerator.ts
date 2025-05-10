import type Phaser from 'phaser';
import { type CellType, CellType as CellTypeValue } from '../../common/world';

export const GENERATED_TILESET_KEY = 'generated_tileset';
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 64;

/**
 * Generates a single canvas texture containing tiles for each CellType.
 * The order of tiles in the texture is EMPTY, ROUGH, SOLID.
 * @param scene The Phaser.Scene to create textures in.
 * @returns The number of tiles generated in the tileset.
 */
export function generateTilesetTexture(scene: Phaser.Scene): number {
    // Define the order of cell types in the texture for consistent indexing
    const tileTypesInOrder: CellType[] = [CellTypeValue.EMPTY, CellTypeValue.ROUGH, CellTypeValue.SOLID];
    const numTiles = tileTypesInOrder.length;

    const canvasWidth = TILE_WIDTH * numTiles;
    const canvasHeight = TILE_HEIGHT;

    // Remove existing texture if it exists, to allow for hot-reloading/regeneration
    if (scene.textures.exists(GENERATED_TILESET_KEY)) {
        scene.textures.remove(GENERATED_TILESET_KEY);
    }

    const canvasTexture = scene.textures.createCanvas(GENERATED_TILESET_KEY, canvasWidth, canvasHeight);
    if (!canvasTexture) {
        console.error('TileTextureGenerator: Failed to create canvas texture for tileset.');
        return 0;
    }
    const ctx = canvasTexture.context;
    if (!ctx) {
        console.error('TileTextureGenerator: Failed to get canvas context.');
        return 0;
    }

    tileTypesInOrder.forEach((cellType, index) => {
        const xOffset = index * TILE_WIDTH;
        const yOffset = 0; // All tiles are in a single row

        ctx.clearRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);

        switch (cellType) {
            case CellTypeValue.EMPTY: // Grass
                ctx.fillStyle = '#6A994E'; // A medium green for grass
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Add some darker green speckles for texture
                ctx.fillStyle = 'rgba(42, 78, 12, 0.4)'; // Darker green, slightly transparent
                for (let i = 0; i < 10; i++) {
                    const speckX = xOffset + Math.random() * TILE_WIDTH;
                    const speckY = yOffset + Math.random() * TILE_HEIGHT;
                    ctx.fillRect(speckX, speckY, 1, 1); // Small speckles
                }
                break;
            case CellTypeValue.ROUGH: // Sand
                ctx.fillStyle = '#F4DDB1'; // Light yellowish-brown for sand
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Add some slightly darker speckles for texture
                ctx.fillStyle = 'rgba(210, 180, 140, 0.5)'; // Tan/light brown, slightly transparent
                for (let i = 0; i < 15; i++) {
                    const speckX = xOffset + Math.random() * (TILE_WIDTH -1) + 0.5;
                    const speckY = yOffset + Math.random() * (TILE_HEIGHT-1) + 0.5;
                    ctx.beginPath();
                    ctx.arc(speckX, speckY, Math.random() * 0.75 + 0.25, 0, Math.PI * 2); // Tiny, varied dots
                    ctx.fill();
                }
                break;
            case CellTypeValue.SOLID: // Stone
                ctx.fillStyle = '#8A8A8A'; // Medium gray for stone
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Add a darker border and some cracks/lines for stone texture
                ctx.strokeStyle = '#5A5A5A'; // Darker gray for border/cracks
                ctx.lineWidth = 1;
                ctx.strokeRect(xOffset + 0.5, yOffset + 0.5, TILE_WIDTH - 1, TILE_HEIGHT - 1);

                // Simple crack lines
                ctx.beginPath();
                ctx.moveTo(xOffset + TILE_WIDTH * 0.2, yOffset + TILE_HEIGHT * 0.3);
                ctx.lineTo(xOffset + TILE_WIDTH * 0.5, yOffset + TILE_HEIGHT * 0.6);
                ctx.lineTo(xOffset + TILE_WIDTH * 0.8, yOffset + TILE_HEIGHT * 0.4);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(xOffset + TILE_WIDTH * 0.6, yOffset + TILE_HEIGHT * 0.8);
                ctx.lineTo(xOffset + TILE_WIDTH * 0.3, yOffset + TILE_HEIGHT * 0.7);
                ctx.stroke();
                break;
        }
    });

    canvasTexture.refresh();
    return numTiles;
}

/**
 * Maps a CellType to its corresponding tile index in the generated tileset.
 * Assumes the order: EMPTY, ROUGH, SOLID.
 * @param cellType The cell type.
 * @returns The tile index.
 */
export function getTileIndexForCellType(cellType: CellType): number {
    switch (cellType) {
        case CellTypeValue.EMPTY: return 0;
        case CellTypeValue.ROUGH: return 1;
        case CellTypeValue.SOLID: return 2;
        default:
            console.warn(`TileTextureGenerator: Unknown cell type ${cellType}, defaulting to EMPTY tile.`);
            return 0; // Default to empty tile index
    }
} 