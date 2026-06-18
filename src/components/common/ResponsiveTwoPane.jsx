import React from 'react';

function ResponsiveTwoPane({ left, right, className = '' }) {
  return (
    <div className={`responsive-two-pane ${className}`.trim()}>
      <div className="two-pane-left">{left}</div>
      <div className="two-pane-right">{right}</div>
    </div>
  );
}

export default ResponsiveTwoPane;
