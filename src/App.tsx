import { useState, useRef, useEffect } from "react";
import WaveformScore from "./components/WaveformScore";
import "./App.css";

function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    audioContextRef.current = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioContextRef.current) return;

    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer =
      await audioContextRef.current.decodeAudioData(arrayBuffer);
    setAudioBuffer(decodedBuffer);
    setCurrentTime(0);
    offsetRef.current = 0;
    stopPlayback();
  };

  const startPlayback = (offset: number) => {
    if (!audioBuffer || !audioContextRef.current) return;

    stopPlayback();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    source.onended = () => {
      if (
        audioContextRef.current &&
        audioContextRef.current.currentTime - startTimeRef.current >=
          audioBuffer.duration - offset
      ) {
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

    requestAnimationFrame(updateProgress);
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  };

  const updateProgress = () => {
    if (!audioContextRef.current || !isPlaying) return;

    const playedTime =
      audioContextRef.current.currentTime - startTimeRef.current;
    const current = offsetRef.current + playedTime;

    if (audioBuffer && current < audioBuffer.duration) {
      setCurrentTime(current);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    offsetRef.current = time;
    if (isPlaying) {
      startPlayback(time);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
      // Calculate where we stopped to resume from there
      const playedTime =
        audioContextRef.current!.currentTime - startTimeRef.current;
      offsetRef.current += playedTime;
    } else {
      startPlayback(offsetRef.current);
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
