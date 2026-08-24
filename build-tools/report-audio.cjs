const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
ffmpeg.setFfmpegPath(ffmpegPath || 'ffmpeg');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'frontend', 'src', 'assets', 'audio');
const genDir = path.join(srcDir, 'generated');

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
      });
    });
  });
}

(async function () {
  const files = fs.readdirSync(srcDir).filter(f => /\.mp3$/i.test(f));
  const report = [];
  for (const f of files) {
    const src = path.join(srcDir, f);
    const name = path.parse(f).name;
    const gen = path.join(genDir, name + '.wav');
    const entry = { mp3: src, wav: fs.existsSync(gen) ? gen : null };
    try {
      const si = await ffprobeAsync(src);
      entry.src = si;
    } catch (e) { entry.srcErr = e.message }
    if (entry.wav) {
      try {
        const wi = await ffprobeAsync(entry.wav);
        entry.wavInfo = wi;
        entry.diff = entry.src && wi ? Math.abs((entry.src.duration || 0) - (wi.duration || 0)) : null;
      } catch (e) { entry.wavErr = e.message }
    }
    report.push(entry);
  }
  console.log(JSON.stringify(report, null, 2));
})();
