import React, { useEffect, useRef } from 'react';

function CanvasGraph() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 320;

    let nodes = [
      { name: 'Spring Boot Config', status: 'green', x: 100, y: 100, vx: 0.2, vy: -0.2, radius: 15 },
      { name: 'MVC Flow', status: 'green', x: 220, y: 180, vx: -0.2, vy: 0.3, radius: 15 },
      { name: 'REST APIs', status: 'green', x: 340, y: 80, vx: 0.3, vy: 0.1, radius: 15 },
      { name: 'JPA Mapping', status: 'red', x: 450, y: 220, vx: 0.1, vy: -0.3, radius: 24 },
      { name: 'Spring Security', status: 'red', x: 150, y: 240, vx: -0.1, vy: 0.2, radius: 24 },
      { name: 'Maven Dependencies', status: 'yellow', x: 550, y: 120, vx: -0.2, vy: 0.2, radius: 18 }
    ];

    let links = [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 2, target: 4 },
      { source: 3, target: 5 }
    ];

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Links
      ctx.strokeStyle = 'rgba(31, 41, 55, 0.12)';
      ctx.lineWidth = 1;
      links.forEach(l => {
        const s = nodes[l.source];
        const t = nodes[l.target];
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      });

      // Nodes
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;

        if (n.x - n.radius < 0 || n.x + n.radius > canvas.width) n.vx *= -1;
        if (n.y - n.radius < 0 || n.y + n.radius > canvas.height) n.vy *= -1;

        ctx.shadowBlur = 12;
        if (n.status === 'green') {
          ctx.fillStyle = '#14b8a6';
          ctx.shadowColor = 'rgba(20, 184, 166, 0.4)';
        } else if (n.status === 'yellow') {
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = 'rgba(234, 179, 8, 0.4)';
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(31,41,55,0.85)';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - n.radius - 6);
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="graph-3d-container">
      <canvas ref={canvasRef}></canvas>
      <div className="graph-legend">
        <span className="legend-item"><span className="color-dot green"></span> Learned</span>
        <span className="legend-item"><span className="color-dot yellow"></span> In progress</span>
        <span className="legend-item"><span className="color-dot red"></span> Weak topics</span>
      </div>
    </div>
  );
}

export default CanvasGraph;
