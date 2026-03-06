/**
 * Converts all PNG/JPG/JPEG/GIF images in public/images to WebP for faster loading.
 * Run: node scripts/convert-images-to-webp.js
 * Requires: npm install sharp
 */
const path = require('path');
const fs = require('fs');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const EXTENSIONS = /\.(png|jpg|jpeg|gif)$/i;

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Missing "sharp". Install with: npm install --save-dev sharp');
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_DIR).filter((f) => EXTENSIONS.test(f));
  if (files.length === 0) {
    console.log('No images to convert in public/images');
    return;
  }

  console.log(`Converting ${files.length} image(s) to WebP...`);
  for (const file of files) {
    const srcPath = path.join(IMAGES_DIR, file);
    const base = file.replace(EXTENSIONS, '');
    const destPath = path.join(IMAGES_DIR, `${base}.webp`);
    try {
      await sharp(srcPath)
        .webp({ quality: 85 })
        .toFile(destPath);
      console.log(`  ${file} -> ${base}.webp`);
    } catch (err) {
      console.error(`  Failed ${file}:`, err.message);
    }
  }
  console.log('Done.');
}

main();
