import WaveformRow from "./WaveformRow";

interface WaveformScoreProps {
  buffer: AudioBuffer;
  currentTime: number;
  onSeek: (time: number) => void;
  secondsPerRow?: number;
}

const WaveformScore = ({
  buffer,
  currentTime,
  onSeek,
  secondsPerRow = 10,
}: WaveformScoreProps) => {
  const duration = buffer.duration;
  const rowCount = Math.ceil(duration / secondsPerRow);
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const startTime = i * secondsPerRow;
    const endTime = Math.min((i + 1) * secondsPerRow, duration);
    rows.push(
      <WaveformRow
        key={i}
        buffer={buffer}
        startTime={startTime}
        endTime={endTime}
        currentTime={currentTime}
        onSeek={onSeek}
      />,
    );
  }

  return <div className="waveform-score-container">{rows}</div>;
};

export default WaveformScore;
