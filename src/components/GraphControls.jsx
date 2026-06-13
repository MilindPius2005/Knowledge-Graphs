export default function GraphControls({
  onCenter,
  onResetZoom,
  onExpandSelected,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  hasSelection,
}) {
  return (
    <div className="graph-controls" aria-label="Graph controls">
      <button type="button" onClick={onBack} disabled={!canGoBack} title="Back">
        ←
      </button>
      <button type="button" onClick={onForward} disabled={!canGoForward} title="Forward">
        →
      </button>
      <button type="button" onClick={onCenter} title="Center graph">
        ⊙
      </button>
      <button type="button" onClick={onResetZoom} title="Reset zoom">
        1:1
      </button>
      <button type="button" onClick={onExpandSelected} disabled={!hasSelection} title="Expand selected node">
        Expand
      </button>
    </div>
  );
}
