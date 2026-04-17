import { FiInbox } from 'react-icons/fi';
import './EmptyState.css';

export default function EmptyState({ icon: Icon = FiInbox, title = 'Nothing here yet', message = 'Check back later for updates.', actionLabel, onAction }) {
  return (
    <div className="empty-state animate-fade">
      <div className="empty-icon-wrap" style={{ fontSize: '3rem', color: 'var(--gray-300)', marginBottom: '1.5rem', opacity: 0.6 }}>
        <Icon />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && <button className="btn btn-primary btn-md" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
