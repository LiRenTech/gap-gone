import { Region } from "./regionUtils";

export interface SilenceDetectionOptions {
  threshold?: number; // 0 to 1, default 0.02 (-34dB)
  minDuration?: number; // seconds, default 0.5
  padding?: number; // seconds, default 0.1 to keep around speech
}

export function detectSilence(
  buffer: AudioBuffer,
  options: SilenceDetectionOptions = {}
): Region[] {
  const {
    threshold = 0.015, // Slightly stricter threshold
    minDuration = 0.2, // Much shorter duration to catch sentence gaps (was 0.5)
    padding = 0.05,    // Tighter padding (was 0.1)
  } = options;

  const data = buffer.getChannelData(0); // Analyze first channel only for speed
  const sampleRate = buffer.sampleRate;
  const chunkLength = 4096; // Processing chunk size
  const regions: Region[] = [];

  let isSilence = false;
  let silenceStart = 0;
  
  // Helper to get RMSE of a chunk
  const getRMSE = (startIdx: number, len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
        if (startIdx + i < data.length) {
            sum += data[startIdx + i] * data[startIdx + i];
        }
    }
    return Math.sqrt(sum / len);
  };

  for (let i = 0; i < data.length; i += chunkLength) {
    const rmse = getRMSE(i, chunkLength);
    
    if (rmse < threshold) {
      if (!isSilence) {
        isSilence = true;
        silenceStart = i / sampleRate;
      }
    } else {
      if (isSilence) {
        // Silence ended
        const silenceEnd = i / sampleRate;
        if (silenceEnd - silenceStart >= minDuration) {
            regions.push({ start: silenceStart, end: silenceEnd });
        }
        isSilence = false;
      }
    }
  }

  // Handle silence at the very end
  if (isSilence) {
      const silenceEnd = data.length / sampleRate;
      if (silenceEnd - silenceStart >= minDuration) {
          regions.push({ start: silenceStart, end: silenceEnd });
      }
  }

  // Post-process to apply padding
  // Shrink silent regions to preserve attack/decay of speech
  return regions.map(r => ({
      start: r.start + padding,
      end: r.end - padding
  })).filter(r => r.end > r.start);
}
