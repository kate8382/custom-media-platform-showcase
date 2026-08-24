#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath || 'ffmpeg');

// Resolve repository root (scripts live in build-tools/)
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'frontend', 'src', 'assets', 'audio');
const generatedDir = path.join(srcDir, 'generated');
const distDir = path.join(root, 'dist', 'assets', 'audio');

// When SKIP_DIST=1, do not write into `dist/` — generate only into the source `generated` folder.
const SKIP_DIST = process.env.SKIP_DIST === '1';
// When VERIFY=0, skip ffprobe verification step (useful for trusted, one-shot generation)
const VERIFY = process.env.VERIFY !== '0';

/**
 * Ensure a directory exists. Creates the directory (recursively) if missing.
 * @param {string} d - Absolute path to the directory to ensure.
 */
function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir(generatedDir);
if (!SKIP_DIST) ensureDir(distDir);

const args = process.argv.slice(2);
const FORCE = process.env.FORCE === '1' || args.includes('--force');

/**
 * Predicate: should this filename be treated as a source audio file?
 * Currently accepts only .mp3 files (case-insensitive).
 * @param {string} file - Filename to test
 * @returns {boolean}
 */
function isAudio(file) {
  // accept .mp3 as source audio files
  return /\.mp3$/i.test(file);
}

/**
 * Convert a single input audio file to WAV using ffmpeg.
 * Writes to a temporary file first (to avoid partial files) and renames on success.
 * Also copies the final WAV into the source-side generated folder.
 * @param {string} inputPath - absolute path to source .mp3
 * @param {string} outGenerated - absolute path to save copy inside frontend/src/.../generated
 * @param {string} outDist - absolute path to save copy inside dist/assets/audio
 * @returns {Promise<void>}
 */
function convertOne(inputPath, outGenerated, outDist) {
  return new Promise((resolve, reject) => {
    // choose the actual target path for ffmpeg output depending on SKIP_DIST
    const target = SKIP_DIST ? outGenerated : outDist;
    const tmp = target + '.tmp.wav';
    const cmd = ffmpeg(inputPath)
      .outputOptions(['-vn', '-acodec pcm_s16le', '-ar 44100', '-ac 2'])
      .format('wav')
      .on('start', (c) => console.log('FFmpeg start:', c))
      .on('progress', (p) => {
        if (p.percent) process.stdout.write(`\r${path.basename(outDist)}: ${p.percent.toFixed(1)}%`);
      })
      .on('error', (err) => {
        console.error('\nConversion error for', inputPath, err.message || err);
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) { }
        reject(err);
      })
      .on('end', () => {
        try {
          if (fs.existsSync(tmp)) {
            fs.renameSync(tmp, target);
            // if we wrote to dist, also copy to generated location
            if (!SKIP_DIST) fs.copyFileSync(outDist, outGenerated);
          }
        } catch (e) {
          console.error('\nPost-processing error for', outDist, e.message || e);
          return reject(e);
        }
        console.log(`\nSaved ${outDist} and ${outGenerated}`);
        resolve();
      })
      .save(tmp);
  });
}

/**
 * Run ffprobe and extract useful audio properties for verification.
 * Returns object with duration (s), sample_rate (Hz), channels, bit_rate (bps) when available.
 * @param {string} file - path to media file
 * @returns {Promise<Object>}
 */
function ffprobeAsync(file) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, data) => {
      if (err) return reject(err);
      const audioStream = (data.streams || []).find(s => s.codec_type === 'audio');
      const format = data.format || {};
      resolve({
        duration: format.duration ? Number(format.duration) : null,
        sample_rate: audioStream && audioStream.sample_rate ? Number(audioStream.sample_rate) : null,
        channels: audioStream && audioStream.channels ? Number(audioStream.channels) : null,
        bit_rate: audioStream && audioStream.bit_rate ? Number(audioStream.bit_rate) : (format.bit_rate ? Number(format.bit_rate) : null)
      });
    });
  });
}

/**
 * Convert and verify the generated output matches important properties of the source.
 * - Verifies duration within a small tolerance, and that sample rate and channel count match.
 * - On verification failure the function removes generated files and retries up to `attempts` times.
 * @param {string} inputPath
 * @param {string} outGenerated
 * @param {string} outDist
 * @param {number} attempts
 */
async function convertAndVerify(inputPath, outGenerated, outDist, attempts = 1) {
  let lastErr = null;
  console.log('convertAndVerify called for', inputPath, 'SKIP_DIST=', SKIP_DIST);
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      await convertOne(inputPath, outGenerated, outDist);
      if (!VERIFY) {
        console.log('Skipping verification (VERIFY=0) for', inputPath);
        return;
      }
      // verify durations and audio properties — probe the actual output location
      const srcInfo = await ffprobeAsync(inputPath);
      const actualOut = SKIP_DIST ? outGenerated : outDist;
      const outInfo = await ffprobeAsync(actualOut);
      const durSrc = srcInfo.duration || 0;
      const durOut = outInfo.duration || 0;
      const durDiff = Math.abs(durSrc - durOut);
      const DURATION_THRESHOLD = 0.06; // 60 ms tolerance

      const sampleMatch = (!srcInfo.sample_rate || !outInfo.sample_rate) || (srcInfo.sample_rate === outInfo.sample_rate);
      const channelsMatch = (!srcInfo.channels || !outInfo.channels) || (srcInfo.channels === outInfo.channels);

      if (durDiff > DURATION_THRESHOLD || !sampleMatch || !channelsMatch) {
        const msg = `Verification failed (duration diff ${durDiff}s, sample_match=${sampleMatch}, channels_match=${channelsMatch})`;
        console.warn(msg);
        lastErr = new Error(msg);
        // remove outputs so next attempt regenerates clean
        try { if (!SKIP_DIST && fs.existsSync(outDist)) fs.unlinkSync(outDist); } catch (e) { }
        try { if (fs.existsSync(outGenerated)) fs.unlinkSync(outGenerated); } catch (e) { }
        if (attempt < attempts) {
          console.log('Retrying conversion...', attempt + 1);
          continue;
        }
        throw lastErr;
      }

      console.log(`Verified: duration ${durOut}s (source ${durSrc}s), sample_rate ${outInfo.sample_rate}, channels ${outInfo.channels}`);
      return;
    } catch (err) {
      lastErr = err;
      console.error('Error on convert/verify attempt', attempt + 1, err && err.stack ? err.stack : err);
      if (attempt >= attempts) throw lastErr;
      console.log('Retrying...');
    }
  }
}

async function main() {
  if (!fs.existsSync(srcDir)) {
    console.error('Source audio folder not found:', srcDir);
    process.exit(1);
  }

  const files = fs.readdirSync(srcDir).filter(isAudio);
  if (files.length === 0) {
    console.log('No .mp3 audio files found in', srcDir);
    return;
  }

  for (const f of files) {
    try {
      const input = path.join(srcDir, f);
      const name = path.parse(f).name;
      const outName = name + '.wav';
      const outGenerated = path.join(generatedDir, outName);
      const outDist = path.join(distDir, outName);

      // Skip if outputs exist and not forced. When SKIP_DIST, only require generated file.
      if (!FORCE) {
        const hasGenerated = fs.existsSync(outGenerated) && fs.statSync(outGenerated).size > 100;
        const hasDist = fs.existsSync(outDist) && fs.statSync(outDist).size > 100;
        if (SKIP_DIST) {
          if (hasGenerated) {
            console.log('Skip (exists):', outName);
            continue;
          }
        } else {
          if (hasGenerated && hasDist) {
            console.log('Skip (exists):', outName);
            continue;
          }
        }
      }

      console.log('Converting:', input, '→', outName);
      await convertAndVerify(input, outGenerated, outDist, 1);
    } catch (err) {
      console.error('Failed processing', f, err && err.message ? err.message : err);
    }
  }

  console.log('Done');
}

main().catch((err) => {
  console.error('Fatal error:', err && err.message ? err.message : err);
  process.exit(1);
});
