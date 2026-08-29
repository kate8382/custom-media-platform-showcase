import fs from 'fs';
import path from 'path';

const neededFiles = [
  "server.js",
  ".env",
  "track_data.json",
  "track_data.schema.json"
]
const repoRoot = path.resolve();
const src = path.join(repoRoot, 'backend');
const dest = path.join(repoRoot, 'dist', 'backend');

async function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    await fs.promises.mkdir(destDir, { recursive: true });
  }

  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    for (const fileToCopy of neededFiles) {
      if (entry.name === fileToCopy) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}

(async () => {
  try {
    if (!fs.existsSync(src)) {
      console.warn('No backend directory found at', src);
      process.exit(0);
    }
    await copyRecursive(src, dest);
    console.log('Backend server and data copied to', dest);
    console.log("DON'T FORGET TO CHANGE THE NODE_ENV VARIABLE IN THE ENV FILE FOR PRODUCTION MODE!!!");
    process.exit(0);
  } catch (err) {
    console.error('Failed to build backend server:', err);
    process.exit(1);
  }
})();
