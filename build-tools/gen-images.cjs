const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// When this script lives in `build-tools/` the script's __dirname is that folder.
// Compute the repository root (one level up) so paths point to the project root.
const root = path.resolve(__dirname, '..');
const imgRoot = path.resolve(root, 'frontend', 'src', 'assets', 'img');
// prefer `originals` folder for source images if it exists, otherwise use img root
const srcDir = fs.existsSync(path.join(imgRoot, 'originals'))
  ? path.join(imgRoot, 'originals')
  : imgRoot;
const outDir = path.resolve(imgRoot, 'generated');
// default sizes; some files override with their own sets below
const DEFAULT_SIZES = [400, 800, 1200];

// formats will be chosen per-source: PNG -> png+webp, JPG -> jpg+webp

// special per-file sizes (key is file name without extension)
const SPECIAL_SIZES = {
  // keep multi-resolution variants for the full logo used in header/footer/favicons
  'full-logo': [200, 400, 800],
  // name/logo and gallery images only need up to 1200 (no 1600)
  'name-logo': [400, 800, 1200],
  // hero/about images are displayed at a single practical size in the layout — generate only one
  'about-img': [1200],
  'hero-img': [1200]
};

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// simple CLI: `node gen-images.cjs clean` will clear generated folder
const args = process.argv.slice(2);
if (args.includes('clean')) {
  console.log('Cleaning generated images folder:', outDir);
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    console.log('Clean complete.');
  } catch (err) {
    console.error('Error cleaning generated folder:', err);
  }
  process.exit(0);
}

function isImage(file) {
  // only process jpg/png originals, skip generated variants and favicons
  if (!/\.(jpe?g|png)$/i.test(file)) return false;
  // skip files that look like already-generated variants (e.g. name-400.jpg, name-1200.jpg)
  if (/-(?:400|800|1200)\./.test(file)) return false;
  if (/^favicon(\.|-)/i.test(file)) return false;
  return true;
}

async function processFile(file) {
  const fullPath = path.join(srcDir, file);
  const name = path.parse(file).name;

  // choose sizes (special-case filenames) and formats depending on source ext
  const ext = path.extname(file).toLowerCase();
  // allow prefix-based special handling (gallery-*)
  let sizes = DEFAULT_SIZES;
  if (SPECIAL_SIZES[name]) sizes = SPECIAL_SIZES[name];
  else if (name.startsWith('gallery-')) sizes = [400, 800, 1200];
  const formats = ext === '.png' ? ['png', 'webp'] : ['jpg', 'webp'];

  for (const size of sizes) {
    for (const fmt of formats) {
      const outName = `${name}-${size}.${fmt}`;
      const outPath = path.join(outDir, outName);
      // Skip existing generated files unless FORCE=1 is set in environment
      if (fs.existsSync(outPath) && process.env.FORCE !== '1') {
        console.log('Skip (exists):', outPath);
        continue;
      }
      try {
        let pipeline = sharp(fullPath).resize({ width: size }).withMetadata();
        if (fmt === 'webp') pipeline = pipeline.webp({ quality: 80 });
        if (fmt === 'jpg') pipeline = pipeline.jpeg({ quality: 85 });
        if (fmt === 'png') pipeline = pipeline.png({ quality: 90 });
        await pipeline.toFile(outPath);
        console.log('Saved', outPath);
      } catch (err) {
        console.error('Error processing', file, err);
      }
    }
  }
}

(async () => {
  const files = fs.readdirSync(srcDir).filter(isImage);
  if (files.length === 0) {
    console.log('No source images found in', srcDir);
    return;
  }

  for (const f of files) await processFile(f);
  console.log('Done');
})();
