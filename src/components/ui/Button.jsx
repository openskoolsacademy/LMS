import './Button.css';

export default function Button({ children, variant = 'primary', size = 'md', fullWidth, onClick, type = 'button', disabled, className = '' }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
