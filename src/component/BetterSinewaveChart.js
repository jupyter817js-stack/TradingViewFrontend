import React, { useEffect, useRef } from "react";

// Approximate JMA calculation function
function jma(values, length = 14, phase = 0) {
  const out = [];
  if (!values.length) return out;

  const beta = 0.45 * (length - 1) / (0.45 * (length - 1) + 2);
  const alpha = Math.pow(beta, 2);

  let e0 = values[0], e1 = 0, e2 = 0;
  let jmaPrev = values[0];

  for (let i = 0; i < values.length; i++) {
    const price = values[i];

    e0 = (1 - beta) * price + beta * e0;
    e1 = (price - e0) * (1 - alpha) + alpha * e1;
    e2 = e1 * (1 - alpha) + alpha * e2;

    jmaPrev = e0 + (phase / 100) * e2;
    out.push(jmaPrev);
  }

  return out;
}

export default function BetterSinewaveChart({ candles, offset, spacing, scale }) {
  const canvasRef = useRef(null);

  const drawIndicator = () => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const margin = 20;
    const innerHeight = height - margin * 2;

    // Extract close prices
    const closes = candles.map(c => c.close);

    // Calculate two JMA curves
    const jmaFast = jma(closes, 14, 0); // blue
    const jmaSlow = jma(closes, 28, 0); // red

    // Scaling function
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const valueToY = (v) => margin + (max - v) / (max - min) * innerHeight;
    const indexToX = (i) => margin + (i - offset.x) * spacing;

    // Blue (fast JMA)
    ctx.beginPath();
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 1.5;
    jmaFast.forEach((v, i) => {
      const x = valueToY(i);
      const y = indexToX(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Red (slow JMA)
    ctx.beginPath();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;
    jmaSlow.forEach((v, i) => {
      const x = valueToY(i);
      const y = indexToX(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Y-axis grid
    ctx.strokeStyle = '#555';
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const val = min + (max - min) * (i / 4);
      const y = valueToY(val);
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
      ctx.fillText(val.toFixed(2), 2, y + 3);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      drawIndicator();
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [candles, offset, spacing, scale]);

  useEffect(() => {
    drawIndicator();
  }, [candles, offset, spacing, scale]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
