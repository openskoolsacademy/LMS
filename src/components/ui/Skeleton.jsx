import './Skeleton.css';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line w-80" />
        <div className="skeleton skeleton-line w-60" />
        <div className="skeleton skeleton-line w-40" />
        <div className="skeleton-row">
          <div className="skeleton skeleton-line w-30" />
          <div className="skeleton skeleton-line w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, width }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-line ${i === lines - 1 ? 'w-60' : ''}`} style={width ? { width } : undefined} />
      ))}
    </div>
  );
}

export default function Skeleton({ width, height, style, className = '' }) {
  return (
    <div 
      className={`skeleton ${className}`} 
      style={{ width, height, ...style }} 
    />
  );
}
