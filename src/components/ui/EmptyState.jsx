import './EmptyState.css';

export default function EmptyState({ icon = '📭', title = 'Nothing here yet', message = 'Check back later for updates.', actionLabel, onAction }) {
  return (
    <div className="empty-state animate-fade">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && <button className="btn btn-primary btn-md" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
