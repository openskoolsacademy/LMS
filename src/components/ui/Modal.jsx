import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade" onClick={onClose}>
      <div className={`modal-content modal-${size} animate-scale`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
