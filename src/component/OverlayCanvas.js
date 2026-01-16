import React, { useEffect, useRef } from 'react';

export default function OverlayCanvas({ candles, cursor, offset, spacing, scale }) {
    const canvasRef = useRef(null);

    const drawOverlay = () => {
        const canvas = canvasRef.current;
        if (!canvas || !candles.length || cursor.x == null) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);

        // Clear the canvas
        ctx.clearRect(0, 0, width, height);

        const margin = 20;
        const innerHeight = height - margin * 2;

        // Calculate visible candles
        const maxVisible = Math.floor(width / spacing);
        const startIndex = Math.max(0, candles.length - maxVisible);
        const visibleCandles = candles.slice(startIndex);
        const maxPrice = Math.max(...visibleCandles.map(c => c.high));
        const minPrice = Math.min(...visibleCandles.map(c => c.low));
        const priceToY = price => margin + (maxPrice - price) / (maxPrice - minPrice) * innerHeight;

        const relativeX = cursor.x - margin;
        const globalIndexFloat = offset.x + relativeX / spacing;
        const globalIndex = Math.round(globalIndexFloat);
        if (globalIndex < 0 || globalIndex >= candles.length) return;

        const candle = candles[globalIndex];
        const x = margin + (globalIndex - offset.x) * spacing;
        const yHigh = priceToY(candle.high);
        const radius = Math.max(2, 2 * scale);

        // Draw crosshair
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(cursor.x, 0);
        ctx.lineTo(cursor.x, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, cursor.y);
        ctx.lineTo(width, cursor.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw price tooltip on the right
        const hoverPrice = maxPrice - ((cursor.y - margin) / innerHeight) * (maxPrice - minPrice);
        ctx.fillStyle = '#000';
        ctx.fillRect(width - 80, cursor.y - 10, 80, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(hoverPrice.toFixed(2), width - 75, cursor.y + 5);

        // Draw time tooltip at the bottom
        const timeStr = new Date(candle.time).toLocaleTimeString();
        ctx.fillStyle = '#000';
        ctx.fillRect(cursor.x - 40, height - 20, 80, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(timeStr, cursor.x - 35, height - 5);

        // Draw highlight circle (commented out)
        // const color = candle.open > candle.close ? 'red' : candle.open < candle.close ? 'green' : 'gray';
        // ctx.fillStyle = color;
        // ctx.beginPath();
        // ctx.arc(x, yHigh, radius, 0, Math.PI * 2);
        // ctx.fill();
        // ctx.strokeStyle = color;
        // ctx.lineWidth = 1;
        // ctx.stroke();

        // Draw vertical tooltip in the top-right corner
        const dateStr = new Date(candle.time).toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const lines = [
            `Time: ${dateStr}`,
            `Open: ${candle.open.toFixed(2)}`,
            `High: ${candle.high.toFixed(2)}`,
            `Low: ${candle.low.toFixed(2)}`,
            `Close: ${candle.close.toFixed(2)}`
        ];

        const boxWidth = 100;
        const lineHeight = 18;
        const boxHeight = lines.length * lineHeight + 8;
        const top = 10;
        const left = width - boxWidth - 10;

        ctx.fillStyle = '#000';
        ctx.fillRect(left, top, boxWidth, boxHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        lines.forEach((line, i) => {
            ctx.fillText(line, left + 8, top + 18 + i * lineHeight);
        });
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;

        // Handle canvas resizing
        const resize = () => {
            canvas.width = canvas.clientWidth * dpr;
            canvas.height = canvas.clientHeight * dpr;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            drawOverlay();
        };

        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [candles, cursor]);

    useEffect(() => {
        drawOverlay();
    }, [candles, cursor, offset, spacing, scale]);

    return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '70%', pointerEvents: 'none' }} />;
}