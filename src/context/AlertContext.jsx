import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX, FiAlertTriangle } from 'react-icons/fi';
import './AlertModal.css';

const AlertContext = createContext();

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

// Generate confetti particles
function ConfettiOverlay() {
  const colors = ['#008ad1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.5}s`,
    duration: `${1 + Math.random() * 1.5}s`,
    size: `${6 + Math.random() * 8}px`,
    rotation: `${Math.random() * 360}deg`,
    xDrift: `${-60 + Math.random() * 120}px`,
  }));

  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            '--confetti-color': p.color,
            '--confetti-left': p.left,
            '--confetti-delay': p.delay,
            '--confetti-duration': p.duration,
            '--confetti-size': p.size,
            '--confetti-rotation': p.rotation,
            '--confetti-x-drift': p.xDrift,
          }}
        />
      ))}
    </div>
  );
}

export function AlertProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    options: null,
  });
  
  const resolveRef = useRef(null);

  const close = useCallback(() => {
    setModalState(s => ({ ...s, isOpen: false }));
    setTimeout(() => {
      if (resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
      setModalState({ isOpen: false, options: null });
    }, 200); // match CSS animation duration
  }, []);

  const showAlert = useCallback((message, title = 'Notification', type = 'info', celebrate = false) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        options: {
          type: 'alert',
          message,
          title,
          alertType: type, // 'info', 'success', 'error', 'warning'
          confirmText: 'OK',
          celebrate: celebrate && type === 'success'
        }
      });
    });
  }, []);

  const showConfirm = useCallback((message, onConfirm, title = 'Please Confirm', confirmText = 'Confirm', cancelText = 'Cancel') => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        options: {
          type: 'confirm',
          message,
          title,
          onConfirmAction: onConfirm,
          confirmText,
          cancelText
        }
      });
    });
  }, []);

  const handleConfirm = async () => {
    const { options } = modalState;
    setModalState(s => ({ ...s, isOpen: false }));
    
    if (options?.onConfirmAction) {
      await options.onConfirmAction();
    }
    
    setTimeout(() => {
      if (resolveRef.current) {
        resolveRef.current(true);
        resolveRef.current = null;
      }
      setModalState({ isOpen: false, options: null });
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalState.isOpen) close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState.isOpen, close]);

  const { isOpen, options } = modalState;

  const getIcon = () => {
    if (options?.type === 'confirm') return <FiAlertCircle className="icon warning" />;
    switch (options?.alertType) {
      case 'success': return <FiCheckCircle className="icon success" />;
      case 'error': return <FiAlertTriangle className="icon error" />;
      case 'warning': return <FiAlertCircle className="icon warning" />;
      default: return <FiInfo className="icon info" />;
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {options && (
        <div className={`pro-alert-overlay ${isOpen ? 'show' : ''}`} onClick={close}>
          <div className={`pro-alert-modal ${isOpen ? 'show' : ''} ${options.celebrate ? 'celebrate' : ''}`} onClick={e => e.stopPropagation()}>
            {options.celebrate && <ConfettiOverlay />}
            <button className="pro-alert-close" onClick={close}><FiX /></button>
            <div className="pro-alert-header">
              {getIcon()}
              <h3>{options.title}</h3>
            </div>
            <div className="pro-alert-body">
              <p>{options.message}</p>
            </div>
            <div className="pro-alert-footer">
              {options.type === 'confirm' && (
                <button className="btn btn-outline" onClick={close}>
                  {options.cancelText}
                </button>
              )}
              <button 
                className={`btn btn-primary ${options?.alertType === 'error' && options?.type !== 'confirm' ? 'danger-btn' : ''}`} 
                onClick={options.type === 'confirm' ? handleConfirm : close}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
