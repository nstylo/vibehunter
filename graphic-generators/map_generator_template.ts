import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { existsSync } from 'fs';

// Constants
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMP_DIR = path.join(OUTPUT_DIR, 'temp');
const OUTPUT_FILE = 'game-map.png';
const FINAL_OUTPUT_FILE = 'mega-map.png';
const HITBOX_JSON_FILE = 'map-hitboxes.json'; // JSON file for hitbox data
const TILE_WIDTH = 1000;
const TILE_HEIGHT = 1000;
const GRID_SIZE_X = 10;
const GRID_SIZE_Y = 10;
const FINAL_WIDTH = TILE_WIDTH * GRID_SIZE_X;
const FINAL_HEIGHT = TILE_HEIGHT * GRID_SIZE_Y;
const SPRITES_DIR = path.join(__dirname, 'sprites');
const BACKGROUND_IMAGE = path.join(SPRITES_DIR, 'background_250x250.png');

// Types for sprite metadata
interface SpriteInfo {
  path: string;
  width: number;
  height: number;
  category?: string; // Optional category for sprite type
  filename: string; // Store filename to track usage
}

// Add a type for placed objects to track positions
interface PlacedObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

// New interface for hitbox data that will be saved to JSON
interface HitboxData {
  id: number;
  tileX: number; // Tile X position in grid
  tileY: number; // Tile Y position in grid
  filename: string;
  category: string;
  x: number; // Global X position in mega-map
  y: number; // Global Y position in mega-map
  width: number;
  height: number;
  scale: number;
}

// Global array to track all placed objects for hitbox generation
const allPlacedObjects: HitboxData[] = [];
let objectIdCounter = 0;

async function generateMegaMap() {
  console.log('===== Starting Mega Map Generation =====');
  console.log(`Will generate a ${FINAL_WIDTH}x${FINAL_HEIGHT} map from ${GRID_SIZE_X}x${GRID_SIZE_Y} tiles`);
  
  try {
    // Create output directories
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log(`Created output directories: ${OUTPUT_DIR} and ${TEMP_DIR}`);
    
    // Clear the global objects array before starting
    allPlacedObjects.length = 0;
    objectIdCounter = 0;
    
    // Step 1: Generate multiple map tiles
    console.log('Generating individual map tiles...');
    const tileFiles = await generateMapTiles(GRID_SIZE_X * GRID_SIZE_Y);
    
    // Step 2: Stitch tiles into mega map
    console.log('Stitching tiles into mega map...');
    const megaMapPath = await stitchTilesToMegaMap(tileFiles);
    
    // Step 3: Save hitbox data to JSON
    console.log('Saving hitbox data to JSON...');
    await saveHitboxData();
    
    // Open the file after generation (macOS specific)
    exec(`open "${megaMapPath}"`, (error) => {
      if (error) {
        console.error('Error opening file:', error);
      } else {
        console.log(`Opened ${megaMapPath} for viewing`);
      }
    });
    
    console.log('===== Mega Map Generation Complete =====');
    return megaMapPath;
  } catch (error) {
    console.error('Error generating mega map:', error);
    throw error;
  }
}

/**
 * Generate multiple map tiles
 */
async function generateMapTiles(count: number): Promise<string[]> {
  const tileFiles: string[] = [];
  
  // Generate a shared background tile once
  const sharedBgPath = path.join(TEMP_DIR, 'background.png');
  await createAndSaveBackground(sharedBgPath);
  
  for (let i = 0; i < count; i++) {
    try {
      console.log(`Generating tile ${i + 1}/${count}...`);
      const tilePath = path.join(TEMP_DIR, `tile-${i}.png`);
      
      // Calculate grid position for this tile
      const tileX = i % GRID_SIZE_X;
      const tileY = Math.floor(i / GRID_SIZE_X);
      
      // Add unique sprites to the background
      await addSpritesToBackground(sharedBgPath, tilePath, tileX, tileY);
      
      tileFiles.push(tilePath);
      console.log(`Tile ${i + 1} saved to ${tilePath}`);
    } catch (error) {
      console.error(`Error generating tile ${i + 1}:`, error);
    }
  }
  
  return tileFiles;
}

/**
 * Stitch map tiles into a mega map
 */
async function stitchTilesToMegaMap(tileFiles: string[]): Promise<string> {
  // Create a blank canvas for the mega map
  const megaMapPath = path.join(OUTPUT_DIR, FINAL_OUTPUT_FILE);
  
  console.log(`Creating mega map with dimensions ${FINAL_WIDTH}x${FINAL_HEIGHT}`);
  
  try {
    // Create a blank canvas with the right background color
    const canvas = sharp({
      create: {
        width: FINAL_WIDTH,
        height: FINAL_HEIGHT,
        channels: 4,
        background: { r: 26, g: 26, b: 46, alpha: 1 }
      }
    });
    
    // Calculate how many tiles we can use
    const tilesAvailable = tileFiles.length;
    const tilesNeeded = GRID_SIZE_X * GRID_SIZE_Y;
    
    if (tilesAvailable < tilesNeeded) {
      console.warn(`Warning: Only ${tilesAvailable} tiles available, but ${tilesNeeded} needed. Some tiles will be repeated.`);
    }
    
    // Create composite operations for each tile
    const composites: sharp.OverlayOptions[] = [];
    
    let tileIndex = 0;
    for (let y = 0; y < GRID_SIZE_Y; y++) {
      for (let x = 0; x < GRID_SIZE_X; x++) {
        // Wrap around if we don't have enough tiles
        const fileIndex = tileIndex % tilesAvailable;
        const tilePath = tileFiles[fileIndex];
        
        try {
          // Load tile as buffer
          const tileBuffer = await sharp(tilePath).toBuffer();
          
          // Add to composites
          composites.push({
            input: tileBuffer,
            left: x * TILE_WIDTH,
            top: y * TILE_HEIGHT
          });
          
          console.log(`Placed tile ${fileIndex} at position (${x}, ${y})`);
        } catch (error) {
          console.error(`Error placing tile ${fileIndex}:`, error);
        }
        
        tileIndex++;
      }
    }
    
    // Apply the tiles and save the mega map
    await canvas.composite(composites).toFile(megaMapPath);
    console.log(`Mega map saved to ${megaMapPath}`);
    
    return megaMapPath;
  } catch (error) {
    console.error('Error stitching mega map:', error);
    throw error;
  }
}

/**
 * Generate a single map tile
 */
async function generateSimpleMap() {
  console.log('Starting single map tile generation...');
  
  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
    
    // Step 1: Create and save background
    const bgOutputPath = path.join(OUTPUT_DIR, 'background.png');
    console.log('Creating tiled background...');
    await createAndSaveBackground(bgOutputPath);
    console.log(`Background saved to ${bgOutputPath}`);
    
    // Step 2: Create final map with sprites
    const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
    console.log('Loading sprites and placing them on background...');
    await addSpritesToBackground(bgOutputPath, outputPath, 0, 0);
    console.log(`Final map saved to ${outputPath}`);
    
    // Open the file after generation (macOS specific)
    exec(`open "${outputPath}"`, (error) => {
      if (error) {
        console.error('Error opening file:', error);
      } else {
        console.log(`Opened ${outputPath} for viewing`);
      }
    });
    
    return outputPath;
  } catch (error) {
    console.error('Error generating map tile:', error);
    throw error;
  }
}

/**
 * Create and save just the background
 */
async function createAndSaveBackground(outputPath: string): Promise<void> {
  try {
    // Check if background image exists
    if (!existsSync(BACKGROUND_IMAGE)) {
      console.warn(`Background image not found at ${BACKGROUND_IMAGE}, using solid background instead`);
      await createSolidBackground(outputPath);
      return;
    }
    
    console.log(`Loading background image from: ${BACKGROUND_IMAGE}`);
    
    // Get image dimensions
    const metadata = await sharp(BACKGROUND_IMAGE).metadata();
    const tileWidth = metadata.width || 250;
    const tileHeight = metadata.height || 250;
    
    console.log(`Background tile size: ${tileWidth}x${tileHeight}`);
    
    // Calculate how many tiles we need
    const tilesX = Math.ceil(TILE_WIDTH / tileWidth);
    const tilesY = Math.ceil(TILE_HEIGHT / tileHeight);
    console.log(`Creating ${tilesX}x${tilesY} tiles to cover the map`);
    
    // Create a blank canvas with the right background color
    const canvas = sharp({
      create: {
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        channels: 4,
        background: { r: 26, g: 26, b: 46, alpha: 1 }
      }
    });
    
    // Prepare the tile once
    const tileBuffer = await sharp(BACKGROUND_IMAGE).toBuffer();
    
    // Create composite operations for each tile
    const composites: sharp.OverlayOptions[] = [];
    
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        composites.push({
          input: tileBuffer,
          left: x * tileWidth,
          top: y * tileHeight
        });
      }
    }
    
    // Apply the tiles and save
    await canvas.composite(composites).toFile(outputPath);
  } catch (error) {
    console.error('Error creating tiled background:', error);
    console.warn('Falling back to solid background');
    await createSolidBackground(outputPath);
  }
}

/**
 * Create and save a solid background as fallback
 */
async function createSolidBackground(outputPath: string): Promise<void> {
  await sharp({
    create: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      channels: 4,
      background: { r: 26, g: 26, b: 46, alpha: 1 }
    }
  })
  .png()
  .toFile(outputPath);
  
  console.log('Created solid color background');
}

/**
 * Add sprites to an existing background image
 */
async function addSpritesToBackground(
  backgroundPath: string, 
  outputPath: string,
  tileX: number,  // X position of tile in grid
  tileY: number   // Y position of tile in grid
): Promise<void> {
  try {
    // Load sprites
    const sprites = await loadSomeSprites();
    console.log(`Loaded ${sprites.length} sprites`);
    
    if (sprites.length === 0) {
      // No sprites to add, just copy the background
      await fs.copyFile(backgroundPath, outputPath);
      console.log('No sprites to add, using background only');
      return;
    }
    
    // Load the background
    const backgroundImage = sharp(backgroundPath);
    
    // Create composites for sprites
    const composites = await createComposites(sprites, tileX, tileY);
    console.log(`Created ${composites.length} composites`);
    
    // Add sprites to background and save
    await backgroundImage.composite(composites).toFile(outputPath);
  } catch (error) {
    console.error('Error adding sprites to background:', error);
    // If error, just use the background
    await fs.copyFile(backgroundPath, outputPath);
    console.log('Error occurred, using background only');
  }
}

// Load a few sprites from the sprites directory
async function loadSomeSprites(): Promise<SpriteInfo[]> {
  const result: SpriteInfo[] = [];
  
  try {
    // Get all files in the sprites directory
    const files = await fs.readdir(SPRITES_DIR);
    
    // Filter for PNG files (excluding background.png and road sprites)
    const pngFiles = files.filter(file => 
      file.endsWith('.png') && 
      !file.startsWith('.') && 
      file !== 'background.png' &&
      !file.startsWith('road') &&
      !file.includes('250x250') // Exclude the background tile
    );
    
    console.log(`Found ${pngFiles.length} usable sprites (excluding roads)`);
    
    // Randomly select 1 or 2 sprites per tile (half of the previous 3)
    const sampleSize = Math.min(Math.floor(Math.random() * 2) + 1, pngFiles.length);
    const selectedFiles: string[] = [];
    
    // Select random files
    while (selectedFiles.length < sampleSize) {
      const randomIndex = Math.floor(Math.random() * pngFiles.length);
      const file = pngFiles[randomIndex];
      
      if (!selectedFiles.includes(file)) {
        selectedFiles.push(file);
      }
    }
    
    // Process each selected file
    for (const file of selectedFiles) {
      const filePath = path.join(SPRITES_DIR, file);
      
      try {
        // Get image dimensions
        const metadata = await sharp(filePath).metadata();
        
        if (metadata.width && metadata.height) {
          // Determine category based on filename
          let category = 'decor';
          if (file.startsWith('building_')) {
            category = 'building';
          } else if (file.startsWith('car')) {
            category = 'car';
          }
          
          result.push({
            path: filePath,
            width: metadata.width,
            height: metadata.height,
            category,
            filename: file // Store filename to track usage
          });
          console.log(`Added sprite: ${file} (${metadata.width}x${metadata.height}, ${category})`);
        }
      } catch (error) {
        console.warn(`Error processing sprite ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error loading sprites:', error);
  }
  
  return result;
}

// Create composite operations for the sprites
async function createComposites(
  sprites: SpriteInfo[],
  tileX: number,  // X position of tile in grid
  tileY: number   // Y position of tile in grid
): Promise<sharp.OverlayOptions[]> {
  const composites: sharp.OverlayOptions[] = [];
  const placedObjects: PlacedObject[] = [];
  const usedSpriteIndices: number[] = []; // Track which sprites have been used
  
  // Grid for collision detection (each cell is 50x50 pixels)
  const GRID_SIZE = 50;
  const grid: boolean[][] = Array(Math.ceil(TILE_HEIGHT / GRID_SIZE))
    .fill(false)
    .map(() => Array(Math.ceil(TILE_WIDTH / GRID_SIZE)).fill(false));
  
  // Divide the map into regions to spread out sprites, but with more variance
  const REGIONS_X = 4;
  const REGIONS_Y = 4;
  const REGION_WIDTH = TILE_WIDTH / REGIONS_X;
  const REGION_HEIGHT = TILE_HEIGHT / REGIONS_Y;
  
  // Try to place each sprite - but now with more randomness in attempts
  for (let i = 0; i < sprites.length; i++) {
    // Skip if we've already placed this many sprites
    if (placedObjects.length >= sprites.length) { // Only place the 1-2 sprites we selected
      break;
    }
    
    // Randomly select a sprite that hasn't been used yet
    let availableIndices = sprites
      .map((_, index) => index)
      .filter(index => !usedSpriteIndices.includes(index));
    
    if (availableIndices.length === 0) {
      break; // No more unused sprites
    }
    
    const randomSpriteIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const sprite = sprites[randomSpriteIndex];
    
    try {
      // Calculate scale - never scale up (maxScale = 1.0), ensure minimum size (0.6)
      const minScale = 0.6;
      const maxScale = 1.0; // Don't upscale beyond original resolution
      const scale = minScale + Math.random() * (maxScale - minScale);
      
      // New dimensions - always equal or smaller than original
      const width = Math.round(sprite.width * scale);
      const height = Math.round(sprite.height * scale);
      
      // Try to find a non-colliding position
      let placed = false;
      let attempts = 0;
      const maxAttempts = 40; // Increased attempts for more randomness
      
      while (!placed && attempts < maxAttempts) {
        let x, y;
        
        // Use different placement strategies based on attempt number
        if (attempts < 15) {
          // First try to place in different grid regions
          const regionX = Math.floor(Math.random() * REGIONS_X);
          const regionY = Math.floor(Math.random() * REGIONS_Y);
          
          // Add randomness within the region (not just padding)
          const padding = 20;
          const innerWidth = REGION_WIDTH - 2 * padding - width;
          const innerHeight = REGION_HEIGHT - 2 * padding - height;
          
          x = Math.floor(regionX * REGION_WIDTH + padding + Math.random() * innerWidth);
          y = Math.floor(regionY * REGION_HEIGHT + padding + Math.random() * innerHeight);
        } else {
          // Then try completely random positions
          x = Math.floor(Math.random() * (TILE_WIDTH - width));
          y = Math.floor(Math.random() * (TILE_HEIGHT - height));
        }
        
        // Check for collision with other placed objects
        if (!checkCollision(x, y, width, height, grid, GRID_SIZE)) {
          try {
            // Resize the sprite
            const buffer = await sharp(sprite.path)
              .resize({ width, height })
              .toBuffer();
            
            // Add to composites
            composites.push({
              input: buffer,
              left: x,
              top: y
            });
            
            // Track the placed object
            placedObjects.push({ x, y, width, height });
            
            // Add to global tracking list with adjusted coordinates for mega-map
            const globalX = tileX * TILE_WIDTH + x;
            const globalY = tileY * TILE_HEIGHT + y;
            
            // Determine category based on filename if not already set
            const category = sprite.category || 
                              (sprite.filename.startsWith('building_') ? 'building' :
                               sprite.filename.startsWith('car') ? 'car' : 'decor');
            
            allPlacedObjects.push({
              id: objectIdCounter++,
              tileX,
              tileY,
              filename: sprite.filename,
              category,
              x: globalX,
              y: globalY,
              width,
              height,
              scale
            });
            
            // Mark the grid as occupied
            markOccupied(x, y, width, height, grid, GRID_SIZE);
            
            // Mark this sprite as used so we don't use it again
            usedSpriteIndices.push(randomSpriteIndex);
            
            placed = true;
            console.log(`Placed sprite ${sprite.filename} at (${x},${y}) with dimensions ${width}x${height} (scale: ${scale.toFixed(2)})`);
          } catch (error) {
            console.warn('Error creating composite for sprite:', error);
            break; // Skip this sprite if error
          }
        }
        
        attempts++;
      }
      
      if (!placed) {
        console.log(`Could not place sprite ${sprite.filename} after ${maxAttempts} attempts - too crowded`);
      }
    } catch (error) {
      console.warn('Error processing sprite:', error);
    }
  }
  
  console.log(`Successfully placed ${placedObjects.length}/${sprites.length} sprites`);
  return composites;
}

/**
 * Check if placement would cause collision
 */
function checkCollision(
  x: number, 
  y: number, 
  width: number, 
  height: number,
  grid: boolean[][],
  gridSize: number
): boolean {
  const startX = Math.floor(x / gridSize);
  const startY = Math.floor(y / gridSize);
  const endX = Math.ceil((x + width) / gridSize);
  const endY = Math.ceil((y + height) / gridSize);
  
  // Add some padding around objects
  for (let gy = startY; gy < endY; gy++) {
    for (let gx = startX; gx < endX; gx++) {
      if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length || grid[gy][gx]) {
        return true; // Collision detected
      }
    }
  }
  
  return false; // No collision
}

/**
 * Mark area as occupied with padding
 */
function markOccupied(
  x: number, 
  y: number, 
  width: number, 
  height: number,
  grid: boolean[][],
  gridSize: number
): void {
  const startX = Math.floor(x / gridSize);
  const startY = Math.floor(y / gridSize);
  const endX = Math.ceil((x + width) / gridSize);
  const endY = Math.ceil((y + height) / gridSize);
  
  // Mark all grid cells as occupied within this area
  for (let gy = startY; gy < endY; gy++) {
    for (let gx = startX; gx < endX; gx++) {
      if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) {
        grid[gy][gx] = true;
      }
    }
  }
  
  // Add some padding around the object
  const padding = 1; // One cell padding
  for (let gy = startY - padding; gy < endY + padding; gy++) {
    for (let gx = startX - padding; gx < endX + padding; gx++) {
      if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) {
        grid[gy][gx] = true;
      }
    }
  }
}

/**
 * Save all placed objects to a JSON file for hitbox creation
 */
async function saveHitboxData(): Promise<void> {
  const hitboxData = {
    mapWidth: FINAL_WIDTH,
    mapHeight: FINAL_HEIGHT,
    tileWidth: TILE_WIDTH,
    tileHeight: TILE_HEIGHT,
    gridSizeX: GRID_SIZE_X,
    gridSizeY: GRID_SIZE_Y,
    objects: allPlacedObjects
  };

  const outputPath = path.join(OUTPUT_DIR, HITBOX_JSON_FILE);
  
  try {
    await fs.writeFile(outputPath, JSON.stringify(hitboxData, null, 2));
    console.log(`Saved hitbox data to ${outputPath} (${allPlacedObjects.length} objects)`);
  } catch (error) {
    console.error('Error saving hitbox data:', error);
  }
}

// Change this line to run the mega map generator instead
generateMegaMap().catch(console.error);
console.log('Mega map generator started'); 