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
  regions: { start: number; end: number }[];
  onRegionAdd: (start: number, end: number) => void;
  onRegionRemove: (start: number, end: number) => void;
}

const WaveformRow = ({
  buffer,
  startTime,
  endTime,
  currentTime,
  onSeek,
  width = 1000,
  height = 120,
  regions,
  onRegionAdd,
  onRegionRemove,
}: ActiveWaveformRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = React.useState<{
    isDragging: boolean;
    startX: number;
    currentX: number;
    button: number; // 0: Left, 1: Middle, 2: Right
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent default to stop text selection or scrolling
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Left click: Seek
    if (e.button === 0) {
      const percentage = x / width;
      const seekTime = startTime + percentage * (endTime - startTime);
      onSeek(seekTime);
      return;
    }

    // Right (2) or Middle (1) click: Start Drag
    if (e.button === 2 || e.button === 1) {
      setDragState({
        isDragging: true,
        startX: x,
        currentX: x,
        button: e.button,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState?.isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    // Check if mouse left the container bounds horizontally?
    // User requirement: "Drag out of row means select to end".
    // Bounding rect logic handles clamping naturally if we clamp 'x'.
    const rect = container.getBoundingClientRect();
    let x = e.clientX - rect.left;

    // Clamp to row bounds
    x = Math.max(0, Math.min(x, width));

    setDragState((prev) => (prev ? { ...prev, currentX: x } : null));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle end of drag
    if (dragState?.isDragging) {
      const container = containerRef.current;
      if (container) {
        // Calculate final region
        const startX = Math.min(dragState.startX, dragState.currentX);
        const endX = Math.max(dragState.startX, dragState.currentX);

        // Convert to time
        const duration = endTime - startTime;
        const rStart = startTime + (startX / width) * duration;
        const rEnd = startTime + (endX / width) * duration;

        // Action based on button
        if (dragState.button === 2) {
          // Right click -> Add/Merge
          onRegionAdd(rStart, rEnd);
        } else if (dragState.button === 1) {
          // Middle click -> Remove/Subtract
          onRegionRemove(rStart, rEnd);
        }
      }
      setDragState(null);
    }
  };

  // Handle mouse leave - we want to continue dragging behavior or commit?
  // User Requirement: "Mouse drag out of current row area means right side ends at row end".
  // The 'handleMouseMove' clamping logic handles this if the mouse moves *within* the element.
  // But if the mouse leaves the element entirely, `onMouseMove` might stop firing if not captured.
  // Simpler approach for now: Use `onMouseLeave` to commit if dragging?
  // OR better: Attach global mouse up listener?
  // Let's stick to container-bound events first. If user drags *out* of box, `onMouseLeave` fires.
  // We can treat `onMouseLeave` as `onMouseUp` with clamped values.

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState?.isDragging) {
      // Commit the drag with clamped values
      const rect = containerRef.current!.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, width));

      const startX = Math.min(dragState.startX, x);
      const endX = Math.max(dragState.startX, x);

      const duration = endTime - startTime;
      const rStart = startTime + (startX / width) * duration;
      const rEnd = startTime + (endX / width) * duration;

      if (dragState.button === 2) {
        onRegionAdd(rStart, rEnd);
      } else if (dragState.button === 1) {
        onRegionRemove(rStart, rEnd);
      }
      setDragState(null);
    }
  };

  // Calculate playhead
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()} // Disable native context menu
      style={{
        width: width,
        height: height,
        position: "relative",
        cursor: "crosshair",
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

      {/* Deleted Regions Overlays */}
      {regions.map((r, idx) => {
        // Intersect region with this row
        const rStart = Math.max(r.start, startTime);
        const rEnd = Math.min(r.end, endTime);

        if (rStart < rEnd) {
          const left = ((rStart - startTime) / (endTime - startTime)) * width;
          const w = ((rEnd - rStart) / (endTime - startTime)) * width;
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: left,
                width: w,
                top: 0,
                bottom: 0,
                backgroundColor: "rgba(128, 128, 128, 0.5)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          );
        }
        return null;
      })}

      {/* Active Drag Overlay */}
      {dragState && dragState.isDragging && (
        <div
          style={{
            position: "absolute",
            left: Math.min(dragState.startX, dragState.currentX),
            width: Math.abs(dragState.currentX - dragState.startX),
            top: 0,
            bottom: 0,
            backgroundColor:
              dragState.button === 2
                ? "rgba(128, 128, 128, 0.5)"
                : "rgba(0, 0, 0, 0.2)", // Gray for Delete, lighter for Restore
            zIndex: 3,
            pointerEvents: "none",
            border: "1px dashed white",
          }}
        />
      )}

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
            willChange: "transform",
          }}
        />
      )}
    </div>
  );
};

export default WaveformRow; // We don't memoize the container itself because `currentTime` changes frequently
