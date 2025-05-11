import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ENEMIES_DIR = path.join(__dirname, '../public/assets/enemies');
const TARGET_SIZE = 128;

async function resizeEnemySprites() {
    console.log(`Looking for enemy sprites in: ${ENEMIES_DIR}`);
    try {
        const files = await fs.readdir(ENEMIES_DIR);
        const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));

        if (pngFiles.length === 0) {
            console.log('No PNG files found in the directory.');
            return;
        }

        console.log(`Found ${pngFiles.length} PNG files to resize.`);

        for (const file of pngFiles) {
            const filePath = path.join(ENEMIES_DIR, file);
            console.log(`Processing ${file}...`);
            try {
                const image = sharp(filePath);
                const metadata = await image.metadata();

                if (metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE) {
                    console.log(`  ${file} is already ${TARGET_SIZE}x${TARGET_SIZE}. Skipping.`);
                    continue;
                }

                await image
                    .resize(TARGET_SIZE, TARGET_SIZE)
                    .toFile(`${filePath}.tmp`); // Write to a temporary file first
                
                await fs.rename(`${filePath}.tmp`, filePath); // Overwrite original file

                console.log(`  Resized ${file} to ${TARGET_SIZE}x${TARGET_SIZE}`);
            } catch (error) {
                console.error(`  Error processing ${file}:`, error);
            }
        }
        console.log('Finished resizing enemy sprites.');
    } catch (error) {
        console.error('Error reading enemy sprites directory:', error);
    }
}

resizeEnemySprites(); 