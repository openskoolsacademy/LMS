import React from 'react';
import './Loader.css';

export default function Loader({ text = "Loading...", fullScreen = false }) {
  return (
    <div className={`brand-loader-container ${fullScreen ? 'full-screen' : ''}`}>
      <div className="brand-spinner">
        <div className="brand-spinner-inner"></div>
      </div>
      {text && <div className="brand-loader-text">{text}</div>}
    </div>
  );
}
