import { Region } from "./regionUtils";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export async function saveToDisk(blob: Blob, defaultName: string) {
    // Convert Blob to Uint8Array
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
        // Open Save Dialog
        const path = await save({
            defaultPath: defaultName,
            filters: [{
                name: 'Audio',
                extensions: ['wav']
            }]
        });

        if (path) {
            // Write to file
            await writeFile(path, uint8Array);
            return true;
        }
    } catch (err) {
        console.error("Tauri save failed:", err);
        throw err;
    }
    return false;
}


export function getKeptRegions(deletedRegions: Region[], totalDuration: number): Region[] {
  const sorted = [...deletedRegions].sort((a, b) => a.start - b.start);
  const kept: Region[] = [];
  let currentTime = 0;

  for (const region of sorted) {
    if (currentTime < region.start) {
      kept.push({ start: currentTime, end: region.start });
    }
    currentTime = Math.max(currentTime, region.end);
  }

  if (currentTime < totalDuration) {
    kept.push({ start: currentTime, end: totalDuration });
  }

  return kept;
}

export function exportAudio(
  buffer: AudioBuffer,
  deletedRegions: Region[]
): Blob {
  const keptRegions = getKeptRegions(deletedRegions, buffer.duration);
  const sampleRate = buffer.sampleRate;
  const numberOfChannels = buffer.numberOfChannels;

  // Calculate total duration in samples consistently
  let totalSamples = 0;
  for (const region of keptRegions) {
    const startSample = Math.floor(region.start * sampleRate);
    const endSample = Math.floor(region.end * sampleRate);
    totalSamples += (endSample - startSample);
  }

  // Create new buffer data
  const outputBuffer = new AudioBuffer({
    length: totalSamples,
    numberOfChannels: numberOfChannels,
    sampleRate: sampleRate,
  });

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const outputData = outputBuffer.getChannelData(channel);
    const inputData = buffer.getChannelData(channel);
    let offset = 0;

    for (const region of keptRegions) {
      const startSample = Math.floor(region.start * sampleRate);
      const endSample = Math.floor(region.end * sampleRate);
      const length = endSample - startSample;
      
      // Safety check boundaries
      if (startSample < inputData.length) {
          // slice handles end > length automatically, but we want exact length match with offset logic
          // However, if inputData is shorter than expected endSample, we might have issues.
          // But startSample/endSample are derived from region which is constrained by duration.
          
          const chunk = inputData.slice(startSample, startSample + length);
          
          // Double check target fit
          if (offset + chunk.length <= outputData.length) {
             outputData.set(chunk, offset);
          } else {
             // If rounding error caused overflow, truncate
             // This effectively solves the RangeError
             const fitLength = outputData.length - offset;
             outputData.set(chunk.slice(0, fitLength), offset);
          }
          offset += chunk.length;
      }
    }
  }

  return bufferToWav(outputBuffer);
}

// Simple WAV encoder
function bufferToWav(abuffer: AudioBuffer) {
  const numOfChan = abuffer.numberOfChannels,
    length = abuffer.length * numOfChan * 2 + 44,
    buffer = new ArrayBuffer(length),
    view = new DataView(buffer),
    channels = [],
    sampleRate = abuffer.sampleRate;
  let offset = 0,
    pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this simple converter)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (let i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < abuffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      // interleave channels
      let sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data: any) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: any) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
