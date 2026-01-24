import React, { useEffect, useRef, memo } from "react";

interface WaveformRowProps {
  buffer: AudioBuffer;
  startTime: number;
  endTime: number;
  width?: number;
  height?: number;
  onSeek: (time: number) => void;
  // currentTime is no longer a prop for the canvas
}

// Separate component for the heavy waveform canvas
const WaveformCanvas = memo(
  ({
    buffer,
    startTime,
    endTime,
    width = 1000,
    height = 120,
  }: Omit<WaveformRowProps, "onSeek">) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { alpha: false }); // Optimization
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

      // Optimization: Downsample for display width
      // If we have 10 seconds at 44.1kHz = 441,000 samples.
      // Trying to draw all of them on 1000px width is wasteful.
      // Step size calculation:
      const totalSamples = endSample - startSample;
      const step = Math.ceil(totalSamples / width);
      const amp = height / 2;

      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;

        const offset = startSample + i * step;
        if (offset >= channelData.length) break;

        for (let j = 0; j < step; j++) {
          const idx = offset + j;
          if (idx >= channelData.length) break;
          const datum = channelData[idx];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }

        // If no data found in range (silence or out of bounds), flatten
        if (min > max) {
          min = 0;
          max = 0;
        }

        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();
    }, [buffer, startTime, endTime, width, height]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      />
    );
  },
  (prev, next) => {
    // Custom comparison to prevent re-renders unless essential props change
    return (
      prev.startTime === next.startTime &&
      prev.endTime === next.endTime &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.buffer === next.buffer
    );
  },
);

interface ActiveWaveformRowProps extends WaveformRowProps {
  currentTime: number;
}

const WaveformRow = ({
  buffer,
  startTime,
  endTime,
  currentTime,
  onSeek,
  width = 1000,
  height = 120,
}: ActiveWaveformRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / width;
    const seekTime = startTime + percentage * (endTime - startTime);
    onSeek(seekTime);
  };

  // Calculate playhead position
  // We only show it if the current time is within this row
  const showPlayhead = currentTime >= startTime && currentTime <= endTime;
  let playheadLeft = 0;

  if (showPlayhead) {
    const duration = endTime - startTime;
    const progress = (currentTime - startTime) / duration;
    playheadLeft = progress * width;
  }

  return (
    <div
      ref={containerRef}
      className="waveform-row-container"
      onClick={handleClick}
      style={{
        width: width,
        height: height,
        position: "relative",
        cursor: "pointer",
      }}
    >
      <div className="row-time-label" style={{ zIndex: 10 }}>
        {startTime.toFixed(1)}s
      </div>

      <WaveformCanvas
        buffer={buffer}
        startTime={startTime}
        endTime={endTime}
        width={width}
        height={height}
      />

      {showPlayhead && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "2px",
            backgroundColor: "#ff5252",
            transform: `translateX(${playheadLeft}px)`,
            zIndex: 5,
            pointerEvents: "none",
            willChange: "transform", // Hint for GPU acceleration
          }}
        />
      )}
    </div>
  );
};

export default WaveformRow; // We don't memoize the container itself because `currentTime` changes frequently
