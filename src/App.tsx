import { useState, useRef, useEffect } from "react";
import WaveformScore from "./components/WaveformScore";
import { mergeRegions, subtractRegion } from "./utils/regionUtils";
import { exportAudio } from "./utils/exportUtils";
import { formatTimeStandard } from "./utils/timeUtils";
import { detectSilence } from "./utils/audioAnalysis";
import "./App.css";

function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    audioContextRef.current = ctx;

    return () => {
      ctx.close();
    };
  }, []);

  const startPlayback = async (offset: number) => {
    if (!audioBuffer || !audioContextRef.current) return;

    // Ensure context is running (fixes "no response" issue)
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    stopPlayback(false); // Stop but don't reset state yet

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    // Handle auto-stop at end
    source.onended = () => {
      // Only reset if we reached the end naturally, not if manually stopped
      // We can check if isPlaying is true (which means we didn't manually stop yet)
      // But difficult to distinguish manual stop from end inside onended without extra state.
      // Simpler: check if current time is near duration.
      const ctxTime = audioContextRef.current?.currentTime || 0;
      const played = ctxTime - startTimeRef.current;
      if (offset + played >= audioBuffer.duration - 0.1) {
        setIsPlaying(false);
        offsetRef.current = 0;
        setCurrentTime(0);
      }
    };

    startTimeRef.current = audioContextRef.current.currentTime;
    offsetRef.current = offset;
    source.start(0, offset);
    sourceNodeRef.current = source;
    setIsPlaying(true);

    // Cancel any existing loop
    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);

    const animate = () => {
      if (!audioContextRef.current) return;
      const playedTime =
        audioContextRef.current.currentTime - startTimeRef.current;
      const current = offsetRef.current + playedTime;

      if (current < audioBuffer.duration) {
        setCurrentTime(current);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const stopPlayback = (updateOffset = true) => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        /* ignore */
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (updateOffset && isPlaying && audioContextRef.current) {
      const playedTime =
        audioContextRef.current.currentTime - startTimeRef.current;
      offsetRef.current = Math.min(
        offsetRef.current + playedTime,
        audioBuffer?.duration || 0,
      );
      setCurrentTime(offsetRef.current);
    }

    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback(true);
    } else {
      startPlayback(offsetRef.current);
    }
  };

  // Keyboard listener with correct dependencies
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, audioBuffer]); // Re-bind when playback state or buffer changes

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioContextRef.current) return;

    setIsProcessing(true);
    stopPlayback(false);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // decodeAudioData is cpu intensive
      const decodedBuffer =
        await audioContextRef.current.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setCurrentTime(0);
      offsetRef.current = 0;
    } catch (err) {
      console.error("Error decoding audio", err);
      alert("无法解析音频文件");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    offsetRef.current = time;
    if (isPlaying) {
      startPlayback(time);
    }
  };

  const [deletedRegions, setDeletedRegions] = useState<
    { start: number; end: number }[]
  >([]);
  // ... (refs)

  // Initialize AudioContext & Disable Context Menu
  useEffect(() => {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    audioContextRef.current = ctx;

    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      ctx.close();
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  // ... (Region Handlers)
  const handleRegionAdd = (start: number, end: number) => {
    setDeletedRegions((prev) => mergeRegions(prev, { start, end }));
  };

  const handleRegionRemove = (start: number, end: number) => {
    setDeletedRegions((prev) => subtractRegion(prev, { start, end }));
    setDeletedRegions((prev) => {
      /* subtractRegion logic needed here */ return prev.filter(
        (r) => !(r.start === start && r.end === end),
      );
    }); // Placeholder for subtractRegion
  };

  // ... (existing code: startPlayback, etc.)

  // Reset regions on new file
  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { // Duplicate declaration, removed
  // ...
  // const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer); // Part of original handleFileUpload
  // setAudioBuffer(decodedBuffer); // Part of original handleFileUpload
  // setDeletedRegions([]); // Reset regions // Part of original handleFileUpload
  // setCurrentTime(0); // Part of original handleFileUpload
  // ...
  // }; // Part of original handleFileUpload

  // ...

  const handleExport = async () => {
    if (!audioBuffer) return;

    setIsProcessing(true);
    // Small timeout to allow UI to show processing state
    setTimeout(async () => {
      try {
        const blob = exportAudio(audioBuffer, deletedRegions);

        // Try Tauri native save first
        try {
          // Dynamic import to avoid breaking if standard web browser?
          // Actually imports are already top-level.
          const { saveToDisk } = await import("./utils/exportUtils");
          const saved = await saveToDisk(blob, "edited-audio.wav");
          if (saved) {
            alert("导出成功！");
          }
        } catch (tauriError) {
          console.warn(
            "Tauri export failed, falling back to browser download:",
            tauriError,
          );
          // Fallback to browser download logic
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = "edited-audio.wav";
          document.body.appendChild(a);
          a.click();

          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } catch (e) {
        console.error(e);
        alert("导出失败");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleAutoCut = () => {
    if (!audioBuffer) return;
    setIsProcessing(true);
    // Timeout to allow UI render
    setTimeout(() => {
      try {
        const silentRegions = detectSilence(audioBuffer);
        if (silentRegions.length > 0) {
          setDeletedRegions((prev) => {
            let newRegions = [...prev];
            silentRegions.forEach((r) => {
              newRegions = mergeRegions(newRegions, r);
            });
            return newRegions;
          });
          alert(`已自动标记 ${silentRegions.length} 个静音片段`);
        } else {
          alert("未检测到符合条件的静音片段");
        }
      } catch (e) {
        console.error(e);
        alert("分析失败");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  return (
    <main className="container">
      {audioBuffer && (
        <div className="top-left-info">
          <span className="time-display">
            {formatTimeStandard(currentTime)} /{" "}
            {formatTimeStandard(audioBuffer.duration)}
          </span>
        </div>
      )}

      <div className="controls">
        <label className="file-input-label">
          打开
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>
        <button
          onClick={togglePlayback}
          disabled={!audioBuffer}
          className={isPlaying ? "btn-playing" : ""}
        >
          {isPlaying ? "暂停" : "播放"}
        </button>
        <button onClick={handleAutoCut} disabled={!audioBuffer}>
          一键去静音
        </button>
        <button onClick={handleExport} disabled={!audioBuffer}>
          导出
        </button>
      </div>

      <div className="waveform-view">
        {isProcessing && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>加载音频中...</p>
          </div>
        )}

        {audioBuffer ? (
          <WaveformScore
            buffer={audioBuffer}
            currentTime={currentTime}
            onSeek={handleSeek}
            regions={deletedRegions}
            onRegionAdd={handleRegionAdd}
            onRegionRemove={handleRegionRemove}
          />
        ) : (
          <div className="empty-state">请上传音频文件以开始编辑</div>
        )}
      </div>
    </main>
  );
}

export default App;
