const labels = {
  pending: 'Queued',
  processing: 'Generating',
  ready: 'Ready',
  failed: 'Could not generate',
  unavailable: 'Unavailable',
};

export default function MediaEvidence({ asset, src, timestamp, onRetry }) {
  if (!asset) return null;

  const isMock = asset.mode === 'mock';
  const isSimulation = asset.mode === 'simulated' || asset.status === 'unavailable';

  return (
    <section className="media-evidence" aria-label={`${asset.mediaType} evidence`}>
      <header className="media-evidence__header">
        <span className={`media-evidence__status media-evidence__status--${asset.status}`} role="status">
          {labels[asset.status] ?? 'Status unknown'}
        </span>
        {timestamp && <time dateTime={timestamp}>{timestamp}</time>}
      </header>

      {asset.status === 'ready' && src && asset.mediaType === 'image' && (
        <img crossOrigin="use-credentials" className="media-evidence__image" src={src} alt="Fictional visual evidence generated for this case" />
      )}
      {asset.status === 'ready' && src && asset.mediaType === 'video' && (
        <video crossOrigin="use-credentials" className="media-evidence__video" src={src} controls playsInline preload="metadata">
          Your browser does not support video playback.
        </video>
      )}

      <p className="media-evidence__notice">
        {isMock && 'Mock fixture — not an AI-generated case image.'}
        {isSimulation && (asset.statusMessage ?? 'Simulated or unavailable evidence. No real video was generated.')}
        {!isMock && !isSimulation && asset.mode === 'ai' && 'AI-generated fictional evidence.'}
        {asset.status === 'pending' && (asset.statusMessage ?? 'Waiting for a media worker.')}
        {asset.status === 'processing' && (asset.statusMessage ?? 'This case remains available while media is processing.')}
        {asset.status === 'failed' && (asset.statusMessage ?? 'The case and evidence remain available.')}
      </p>

      {asset.status === 'failed' && onRetry && (
        <button className="media-evidence__retry" type="button" onClick={() => onRetry(asset.id)}>
          Retry generation
        </button>
      )}
    </section>
  );
}
