import { useState, useRef, useEffect } from "react";
import WaveformScore from "./components/WaveformScore";
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

  return (
    <main className="container">
      <header className="app-header">
        <h1>Audio Full Cut</h1>
        <div className="controls">
          <label className="file-input-label">
            选择音频文件
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
          <button onClick={togglePlayback} disabled={!audioBuffer}>
            {isPlaying ? "暂停" : "播放"}
          </button>
          {audioBuffer && (
            <span className="time-info">
              {currentTime.toFixed(2)}s / {audioBuffer.duration.toFixed(2)}s
            </span>
          )}
        </div>
      </header>

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
          />
        ) : (
          <div className="empty-state">请上传音频文件以开始编辑</div>
        )}
      </div>
    </main>
  );
}

export default App;
