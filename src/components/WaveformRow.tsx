import React, { useEffect, useRef, memo } from "react";
import { formatTimeCompact } from "../utils/timeUtils";

interface WaveformRowProps {
  buffer: AudioBuffer;
  startTime: number;
  endTime: number;
  width?: number;
  height?: number;
  onSeek: (time: number) => void;
  // currentTime is no longer a prop for the canvas
}

function drawWaveformSlice({
  ctx,
  buffer,
  startTime,
  endTime,
  width,
  height,
  fillStyle,
  baselineStyle,
  waveformStyle,
}: {
  ctx: CanvasRenderingContext2D;
  buffer: AudioBuffer;
  startTime: number;
  endTime: number;
  width: number;
  height: number;
  fillStyle?: string;
  baselineStyle: string;
  waveformStyle: string;
}) {
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  ctx.strokeStyle = baselineStyle;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  const channelData = buffer.getChannelData(0);
  const startSample = Math.floor(startTime * buffer.sampleRate);
  const endSample = Math.floor(endTime * buffer.sampleRate);
  const totalSamples = Math.max(1, endSample - startSample);
  const step = Math.max(1, Math.ceil(totalSamples / Math.max(1, width)));
  const amp = height / 2;

  ctx.strokeStyle = waveformStyle;
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

    if (min > max) {
      min = 0;
      max = 0;
    }

    ctx.moveTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
  }

  ctx.stroke();
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

      drawWaveformSlice({
        ctx,
        buffer,
        startTime,
        endTime,
        width,
        height,
        fillStyle: "#1e1e1e",
        baselineStyle: "#333333",
        waveformStyle: "#4caf50",
      });
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

const PeelWaveCanvas = memo(
  ({
    buffer,
    startTime,
    endTime,
    width,
    height,
  }: {
    buffer: AudioBuffer;
    startTime: number;
    endTime: number;
    width: number;
    height: number;
  }) => {
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

      drawWaveformSlice({
        ctx,
        buffer,
        startTime,
        endTime,
        width,
        height,
        baselineStyle: "rgba(255, 255, 255, 0.14)",
        waveformStyle: "rgba(133, 237, 151, 0.92)",
      });
    }, [buffer, startTime, endTime, width, height]);

    return (
      <canvas
        ref={canvasRef}
        className="region-peel-effect-wave"
        style={{
          display: "block",
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
    );
  },
  (prev, next) => {
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

interface PeelEffect {
  id: number;
  left: number;
  width: number;
  startTime: number;
  endTime: number;
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
  const [peelEffects, setPeelEffects] = React.useState<PeelEffect[]>([]);
  const peelEffectIdRef = useRef(0);
  const peelTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      peelTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
    };
  }, []);

  const triggerPeelEffect = (
    startX: number,
    endX: number,
    effectStartTime: number,
    effectEndTime: number,
  ) => {
    const widthPx = Math.abs(endX - startX);
    if (widthPx < 6) return;

    const id = peelEffectIdRef.current++;
    setPeelEffects((prev) => [
      ...prev,
      {
        id,
        left: Math.min(startX, endX),
        width: widthPx,
        startTime: effectStartTime,
        endTime: effectEndTime,
      },
    ]);

    const timeoutId = window.setTimeout(() => {
      setPeelEffects((prev) => prev.filter((effect) => effect.id !== id));
      peelTimeoutsRef.current = peelTimeoutsRef.current.filter(
        (activeId) => activeId !== timeoutId,
      );
    }, 700);

    peelTimeoutsRef.current.push(timeoutId);
  };

  const commitDrag = (finalX: number) => {
    if (!dragState?.isDragging) return;

    const startX = Math.min(dragState.startX, finalX);
    const endX = Math.max(dragState.startX, finalX);
    const duration = endTime - startTime;
    const rStart = startTime + (startX / width) * duration;
    const rEnd = startTime + (endX / width) * duration;

    if (dragState.button === 2) {
      onRegionAdd(rStart, rEnd);
      triggerPeelEffect(startX, endX, rStart, rEnd);
    } else if (dragState.button === 1) {
      onRegionRemove(rStart, rEnd);
    }

    setDragState(null);
  };

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

  const handleMouseUp = () => {
    if (!dragState?.isDragging) return;
    commitDrag(dragState.currentX);
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
      const rect = containerRef.current!.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, width));
      commitDrag(x);
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

  const activeDragLeft = dragState
    ? Math.min(dragState.startX, dragState.currentX)
    : 0;
  const activeDragWidth = dragState
    ? Math.abs(dragState.currentX - dragState.startX)
    : 0;

  const restorePreviewSegments =
    dragState?.isDragging && dragState.button === 1
      ? regions.flatMap((region, idx) => {
          const rowRegionStart = Math.max(region.start, startTime);
          const rowRegionEnd = Math.min(region.end, endTime);
          if (rowRegionStart >= rowRegionEnd) return [];

          const dragStartTime =
            startTime + (activeDragLeft / width) * (endTime - startTime);
          const dragEndTime =
            startTime +
            ((activeDragLeft + activeDragWidth) / width) * (endTime - startTime);

          const overlapStart = Math.max(rowRegionStart, dragStartTime);
          const overlapEnd = Math.min(rowRegionEnd, dragEndTime);
          if (overlapStart >= overlapEnd) return [];

          return [
            {
              key: `${idx}-${overlapStart}-${overlapEnd}`,
              left:
                ((overlapStart - startTime) / (endTime - startTime)) * width,
              width:
                ((overlapEnd - overlapStart) / (endTime - startTime)) * width,
            },
          ];
        })
      : [];

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
      <div className="waveform-row-clip">
        <div className="row-time-label" style={{ zIndex: 10 }}>
          {formatTimeCompact(startTime)}
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
            const left =
              ((rStart - startTime) / (endTime - startTime)) * width;
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
                  backgroundColor: "rgba(18, 18, 18, 0.74)",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              />
            );
          }
          return null;
        })}

        {restorePreviewSegments.map((segment) => (
          <div
            key={segment.key}
            style={{
              position: "absolute",
              left: segment.left,
              width: segment.width,
              top: 0,
              bottom: 0,
              background:
                "linear-gradient(180deg, rgba(76, 175, 80, 0.46) 0%, rgba(76, 175, 80, 0.24) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(114, 255, 140, 0.42), inset 0 0 18px rgba(76, 175, 80, 0.18)",
              zIndex: 3,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Active Drag Overlay */}
        {dragState && dragState.isDragging && (
          <div
            style={{
              position: "absolute",
              left: activeDragLeft,
              width: activeDragWidth,
              top: 0,
              bottom: 0,
              backgroundColor:
                dragState.button === 2
                  ? "rgba(18, 18, 18, 0.68)"
                  : "rgba(255, 255, 255, 0.2)",
              zIndex: 4,
              pointerEvents: "none",
              border:
                dragState.button === 2
                  ? "1px dashed rgba(255, 255, 255, 0.18)"
                  : "1px dashed rgba(255, 255, 255, 0.42)",
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

      {peelEffects.map((effect) => (
        <div
          key={effect.id}
          className="region-peel-effect"
          style={{
            left: effect.left,
            width: effect.width,
          }}
        >
          <div className="region-peel-effect-skin">
            <PeelWaveCanvas
              buffer={buffer}
              startTime={effect.startTime}
              endTime={effect.endTime}
              width={effect.width}
              height={height}
            />
            <div className="region-peel-effect-gloss" />
          </div>
          <div className="region-peel-effect-shadow" />
        </div>
      ))}
    </div>
  );
};

export default WaveformRow; // We don't memoize the container itself because `currentTime` changes frequently
