import { useEffect, useRef } from "react";

interface WaveformRowProps {
  buffer: AudioBuffer;
  startTime: number;
  endTime: number;
  currentTime: number;
  onSeek: (time: number) => void;
  width?: number;
  height?: number;
}

const WaveformRow = ({
  buffer,
  startTime,
  endTime,
  currentTime,
  onSeek,
  width = 1000,
  height = 120,
}: WaveformRowProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Draw background
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, width, height);

    // Draw baseline
    ctx.strokeStyle = "#333333";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const duration = endTime - startTime;
    const channelData = buffer.getChannelData(0);
    const startSample = Math.floor(startTime * buffer.sampleRate);
    const endSample = Math.floor(endTime * buffer.sampleRate);
    const sliceData = channelData.slice(startSample, endSample);

    // Draw waveform
    ctx.strokeStyle = "#4caf50";
    ctx.lineWidth = 1;
    ctx.beginPath();

    const step = Math.ceil(sliceData.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = sliceData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();

    // Draw playhead if currentTime is within this row's range
    if (currentTime >= startTime && currentTime <= endTime) {
      const playheadX = ((currentTime - startTime) / duration) * width;
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [buffer, startTime, endTime, currentTime, width, height]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / width;
    const seekTime = startTime + percentage * (endTime - startTime);
    onSeek(seekTime);
  };

  return (
    <div className="waveform-row-container">
      <div className="row-time-label">{startTime.toFixed(1)}s</div>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ cursor: "pointer", display: "block" }}
      />
    </div>
  );
};

export default WaveformRow;
