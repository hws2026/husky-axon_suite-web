// Checks future backend diagnostics; this does NOT capture or inspect media itself.
// A production service must derive these measurements from the actual stream/file.
const HuskyMediaContract = Object.freeze({
  target: Object.freeze({ width: 3840, height: 2160, fps: 30, sampleRate: 48000, maxDriftMs: 50 }),
  validate(report) {
    if (!report) return { ready: false, errors: ['Capture backend is not connected.'] };
    const errors = [];
    const video = report.video || {}, audio = report.audio || {}, sync = report.sync || {};
    if (video.width !== this.target.width || video.height !== this.target.height || video.upscaled !== false)
      errors.push('Native 3840 × 2160 video has not been verified.');
    if (!Number.isFinite(video.measuredFps) || video.measuredFps < this.target.fps)
      errors.push('Measured 30 FPS capture has not been verified.');
    if (video.pov !== 'mounted-camera') errors.push('Mounted camera POV has not been verified.');
    if (audio.source !== 'gameplay' || audio.trackPresent !== true)
      errors.push('Gameplay audio track is missing or unverified.');
    if (audio.sampleRate !== this.target.sampleRate)
      errors.push('48 kHz gameplay audio has not been verified.');
    if (audio.captureHealthy !== true) errors.push('Audio capture health has not been verified.');
    if (sync.clock !== 'shared-monotonic' || sync.timestampsVerified !== true)
      errors.push('Shared audio/video timestamps have not been verified.');
    if (sync.monitoredEntireRecording !== true || !Number.isInteger(sync.measurements) || sync.measurements <= 0)
      errors.push('Continuous audio/video sync monitoring has not been verified.');
    if (!Number.isFinite(sync.maxAbsoluteDriftMs) || sync.maxAbsoluteDriftMs < 0 || sync.maxAbsoluteDriftMs > this.target.maxDriftMs)
      errors.push('Audio/video drift exceeds 50 ms or has not been measured.');
    if (report.finalized !== true) errors.push('Recording container has not been finalized.');
    return { ready: errors.length === 0, errors };
  }
});
