import WaveformRow from "./WaveformRow";

interface WaveformScoreProps {
  buffer: AudioBuffer;
  currentTime: number;
  onSeek: (time: number) => void;
  secondsPerRow?: number;
  regions: { start: number; end: number }[];
  onRegionAdd: (start: number, end: number) => void;
  onRegionRemove: (start: number, end: number) => void;
}

const WaveformScore = ({
  buffer,
  currentTime,
  onSeek,
  secondsPerRow = 10,
  regions,
  onRegionAdd,
  onRegionRemove,
}: WaveformScoreProps) => {
  const duration = buffer.duration;
  const rowCount = Math.ceil(duration / secondsPerRow);
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const startTime = i * secondsPerRow;
    const endTime = Math.min((i + 1) * secondsPerRow, duration);

    // Only pass currentTime if it's relevant to this row to avoid re-rendering
    // all other rows?
    // Actually, React will still diff the props.
    // But since WaveformCanvas is memoized inside WaveformRow,
    // and the Playhead logic inside WaveformRow is fast (div position),
    // it should be fine to pass currentTime to all.
    // The main heavy lifting (canvas drawing) is now skipped.

    rows.push(
      <WaveformRow
        key={i}
        buffer={buffer}
        startTime={startTime}
        endTime={endTime}
        currentTime={currentTime}
        onSeek={onSeek}
        regions={regions}
        onRegionAdd={onRegionAdd}
        onRegionRemove={onRegionRemove}
      />,
    );
  }

  return <div className="waveform-score-container">{rows}</div>;
};

export default WaveformScore;
