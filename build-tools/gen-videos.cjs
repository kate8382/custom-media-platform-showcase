const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
let ffprobePkg = null;
try {
  ffprobePkg = require('ffprobe-static');
} catch (e) {
  // ffprobe-static may not be installed in production environments; fall back to system ffprobe
  ffprobePkg = null;
}
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
// configure ffprobe path using ffprobe-static when available (works in CI)
try {
  if (ffprobePkg) {
    const probePath = ffprobePkg.path ? ffprobePkg.path : ffprobePkg;
    if (probePath) ffmpeg.setFfprobePath(probePath);
  }
} catch (e) {
  // ignore and fallback to system ffprobe (may not be present in CI)
}

const root = path.resolve(__dirname, '..');
const srcDir = path.resolve(root, 'frontend', 'src', 'assets', 'video');
const outDir = path.resolve(srcDir, 'generated');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
if (args.includes('clean')) {
  console.log('Cleaning generated videos:', outDir);
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    console.log('Clean complete.');
  } catch (err) {
    console.error('Error cleaning generated videos:', err);
  }
  process.exit(0);
}

function isVideo(file) {
  return /\.(mp4|mov|mkv|avi|webm)$/i.test(file) && !/generated/i.test(file);
}

async function processVideo(file) {
  const fullPath = path.join(srcDir, file);
  const name = path.parse(file).name;

  const mp4Out = path.join(outDir, `${name}.mp4`);
  const webmOut = path.join(outDir, `${name}.webm`);

  // Skip quickly if both outputs already exist and not forced
  const force = process.env.FORCE === '1';
  if (!force && fs.existsSync(mp4Out) && fs.existsSync(webmOut)) {
    console.log('Skip (exists):', mp4Out, webmOut);
    return;
  }

  const transcode = (input, output, opts = {}) => new Promise((resolve, reject) => {
    // helper: probe metadata
    const probe = (inputPath) => new Promise((res, rej) => {
      ffmpeg.ffprobe(inputPath, (err, meta) => err ? rej(err) : res(meta));
    });

    // If output exists and not forced, skip immediately (avoid using ffprobe in CI)
    if (fs.existsSync(output) && !force) {
      console.log('Skip (exists):', output);
      return resolve();
    }

    start();

    function start() {
      const ext = path.extname(output); // e.g. .mp4 or .webm
      const base = path.parse(output).name;
      const tmpOut = path.join(path.dirname(output), `${base}.tmp${ext}`);
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) { }

      const logDir = path.join(outDir, 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

      const maxRetries = typeof opts.retries === 'number' ? opts.retries : 1;
      const formatName = ext.startsWith('.') ? ext.slice(1) : ext;
      const logPath = path.join(logDir, `${base}.${formatName}.log`);

      const runOnce = async () => {
        // start ffmpeg process and wait for end
        const proc = ffmpeg(input)
          .format(formatName)
          .outputOptions(opts.outputOptions || [])
          .on('progress', p => {
            process.stdout.write(`\r${base}${ext} ${p.percent ? p.percent.toFixed(1) : ''}%`);
          })
          .on('stderr', s => {
            try { fs.appendFileSync(logPath, s + '\n'); } catch (e) { }
          });

        await new Promise((res, rej) => {
          proc.on('end', res);
          proc.on('error', rej);
          proc.save(tmpOut);
        });

        // finalize
        try {
          fs.renameSync(tmpOut, output);
          console.log('\nSaved', output);
        } catch (err) {
          console.error('Error finalizing', tmpOut, err.message || err);
          try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) { }
          throw err;
        }

        // verify duration matches (within threshold)
        const inMeta = await probe(input);
        const outMeta = await probe(output);
        const inDur = Number(inMeta.format && inMeta.format.duration) || 0;
        const outDur = Number(outMeta.format && outMeta.format.duration) || 0;
        const diff = Math.abs(inDur - outDur);
        if (inDur > 0 && diff > 0.05) {
          throw new Error(`duration mismatch: in=${inDur} out=${outDur}`);
        }
      };

      // retries
      (async function attemptLoop() {
        let attempt = 0;
        while (attempt <= maxRetries) {
          attempt++;
          try {
            await runOnce();
            return resolve();
          } catch (err) {
            console.error(`Attempt ${attempt} failed for ${output}:`, err.message || err);
            try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) { }
            if (attempt > maxRetries) return reject(err);
            console.log(`Retrying ${output} (attempt ${attempt + 1})`);
          }
        }
      })();
    }
  });

  // mp4 H.264 + AAC
  await transcode(fullPath, mp4Out, {
    outputOptions: ['-c:v libx264', '-crf 23', '-preset medium', '-pix_fmt yuv420p', '-movflags +faststart', '-c:a aac', '-b:a 128k']
  });

  // webm (VP9) with opus — write to tmp then atomically rename inside transcode
  await transcode(fullPath, webmOut, {
    // use faster encode settings (cpu-used) for reasonable speed without dropping frames
    outputOptions: ['-c:v libvpx-vp9', '-b:v 0', '-crf 30', '-cpu-used 4', '-deadline good', '-row-mt 1', '-c:a libopus'],
    retries: 1
  });
}

(async () => {
  const files = fs.readdirSync(srcDir).filter(isVideo);
  if (files.length === 0) {
    console.log('No source videos found in', srcDir);
    return;
  }

  for (const f of files) {
    try {
      await processVideo(f);
    } catch (err) {
      console.error('Failed to process', f, err);
    }
  }

  console.log('Done');
})();
