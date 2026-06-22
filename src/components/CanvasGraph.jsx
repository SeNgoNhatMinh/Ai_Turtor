import React, { useEffect, useRef } from 'react';

function CanvasGraph() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const parent = canvas.parentElement;
    const initialWidth = parent ? parent.clientWidth : 500;
    
    // Set logical layout styles
    canvas.style.width = `${initialWidth}px`;
    canvas.style.height = `320px`;
    
    // Set physical backing store size scaled by DPR
    canvas.width = initialWidth * dpr;
    canvas.height = 320 * dpr;

    // Use relative percentage coordinates so they distribute nicely on any screen size
    let nodes = [
      { name: 'Spring Boot Config', status: 'green', x: 0.18, y: 0.25, vx: 0.15, vy: -0.15, radius: 14 },
      { name: 'MVC Flow', status: 'green', x: 0.35, y: 0.65, vx: -0.15, vy: 0.2, radius: 14 },
      { name: 'REST APIs', status: 'green', x: 0.55, y: 0.28, vx: 0.2, vy: 0.1, radius: 14 },
      { name: 'JPA Mapping', status: 'red', x: 0.72, y: 0.68, vx: 0.1, vy: -0.2, radius: 20 },
      { name: 'Spring Security', status: 'red', x: 0.22, y: 0.75, vx: -0.1, vy: 0.15, radius: 20 },
      { name: 'Maven Dependencies', status: 'yellow', x: 0.82, y: 0.35, vx: -0.15, vy: 0.15, radius: 16 }
    ];

    let links = [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 2, target: 4 },
      { source: 3, target: 5 }
    ];

    let initialized = false;

    const handleResize = () => {
      if (parent) {
        const width = parent.clientWidth || 500;
        const height = 320;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    // Delay scaling nodes until the parent layout is fully stable to avoid 0-width issues
    const initTimer = setTimeout(() => {
      handleResize();
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      nodes.forEach(n => {
        n.x = n.x * cssWidth;
        n.y = n.y * cssHeight;
      });
      initialized = true;
    }, 150);

    window.addEventListener('resize', handleResize);

    let animId;
    const draw = () => {
      // Clear entire physical backing store
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Only draw if nodes are initialized (scaled to absolute pixels)
      if (!initialized) {
        animId = requestAnimationFrame(draw);
        return;
      }

      // Save drawing state and apply DPR scaling for crisp graphics
      ctx.save();
      ctx.scale(dpr, dpr);

      // Get logical dimensions for boundaries
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;

      // Check dark mode dynamically
      const isDark = document.querySelector('.app-container')?.classList.contains('dark') || false;

      // Draw Links
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(31, 41, 55, 0.12)';
      ctx.lineWidth = 1.5;
      links.forEach(l => {
        const s = nodes[l.source];
        const t = nodes[l.target];
        if (s && t) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      });

      // Draw Nodes
      nodes.forEach(n => {
        // Move nodes
        n.x += n.vx;
        n.y += n.vy;

        // Smart boundaries - keeps nodes within visible canvas bounds
        if (n.x - n.radius < 0 && n.vx < 0) {
          n.vx = Math.abs(n.vx);
        } else if (n.x + n.radius > cssWidth && n.vx > 0) {
          n.vx = -Math.abs(n.vx);
        }

        if (n.y - n.radius < 0 && n.vy < 0) {
          n.vy = Math.abs(n.vy);
        } else if (n.y + n.radius > cssHeight && n.vy > 0) {
          n.vy = -Math.abs(n.vy);
        }

        // Outer glow
        ctx.shadowBlur = 15;
        if (n.status === 'green') {
          ctx.fillStyle = '#10B981'; // emerald green
          ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
        } else if (n.status === 'yellow') {
          ctx.fillStyle = '#F59E0B'; // warm amber
          ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
        } else {
          ctx.fillStyle = '#EF4444'; // rose red
          ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        }

        // Node Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        // Node Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = isDark ? '#E5E7EB' : '#1F2937';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - n.radius - 8);
      });

      // Restore drawing state to clean up dpr scaling
      ctx.restore();

      animId = requestAnimationFrame(draw);
    };

    draw();
    
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(initTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="graph-3d-container">
      <canvas ref={canvasRef} id="knowledge-graph-canvas"></canvas>
      <div className="graph-legend">
        <span className="legend-item"><span className="color-dot green"></span> Learned</span>
        <span className="legend-item"><span className="color-dot yellow"></span> In progress</span>
        <span className="legend-item"><span className="color-dot red"></span> Weak topics</span>
      </div>
    </div>
  );
}

export default CanvasGraph;
