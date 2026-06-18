import React from 'react';

function SplineAvatar({ emotion, setEmotion }) {
  return (
    <div className="avatar-3d-wrapper">
      <div className="avatar-status-badge">
        <span className="pulse-dot-green"></span> AI Tutor: Active ({emotion})
      </div>
      <div className="spline-container">
        <spline-viewer url="https://prod.spline.design/iW-w7x26XW77g6S6/scene.splinecode"></spline-viewer>
      </div>
      <div className="avatar-fallback-controls">
        <p className="avatar-emotion-label">AI avatar action:</p>
        <div className="emotion-buttons">
          <button className={`emotion-btn ${emotion === 'idle' ? 'active' : ''}`} onClick={() => setEmotion('idle')}>Idle</button>
          <button className={`emotion-btn ${emotion === 'thinking' ? 'active' : ''}`} onClick={() => setEmotion('thinking')}>Thinking</button>
          <button className={`emotion-btn ${emotion === 'success' ? 'active' : ''}`} onClick={() => setEmotion('success')}>Success</button>
        </div>
      </div>
    </div>
  );
}

export default SplineAvatar;
