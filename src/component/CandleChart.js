import React, { useEffect, useRef } from 'react';
import { calculateBetterProAm } from "../Utils/calculateBetterProAm";

export default function CandleChart({ candles, offset, spacing, scale, displayStyle = "candles" }) {
    const canvasRef = useRef(null);
    const drawChart = () => {
        const canvas = canvasRef.current;
        if (!canvas || !candles.length) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);

        // black background
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        const margin = 20;
        const innerHeight = height - margin * 2;

        const leftIndexFloat = offset.x;
        const rightIndexFloat = offset.x + width / spacing;
        const leftIndex = Math.max(0, Math.floor(leftIndexFloat));
        const rightIndex = Math.min(candles.length - 1, Math.ceil(rightIndexFloat));

        const visibleCandles = candles.slice(leftIndex, rightIndex + 1);
        if (!visibleCandles.length) return;

        const maxPrice = Math.max(...visibleCandles.map(c => c.high));
        const minPrice = Math.min(...visibleCandles.map(c => c.low));

        const priceToY = price => margin + (maxPrice - price) / (maxPrice - minPrice) * innerHeight;
        const indexToX = i => margin + (i - offset.x) * spacing;

        // y grid
        ctx.font = "10px Arial";
        for (let i = 0; i <= 6; i++) {
            const price = minPrice + (maxPrice - minPrice) * (i / 6);
            const y = priceToY(price);
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
            ctx.fillStyle = '#aaa';
            ctx.fillText(price.toFixed(2), 5, y + 5);
        }

        // x grid (timeline)
        const count = rightIndex - leftIndex + 1;
        const approxStep = Math.floor(count / 6);
        for (let i = 0; i <= 6; i++) {
            const idx = leftIndex + i * approxStep;
            if (idx >= candles.length) break;
            const c = candles[idx];
            const x = indexToX(idx);
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(x, margin);
            ctx.lineTo(x, height - margin);
            ctx.stroke();
            ctx.fillStyle = '#aaa';
            ctx.fillText(new Date(c.time).toLocaleTimeString(), x - 25, height - margin + 15);
        }

        const proAmData = calculateBetterProAm(candles);

            // console.log(proAmData);

        const bodyWidth = Math.max(4, Math.min(16, spacing * 0.8));

        // candle
        visibleCandles.forEach((c, i) => {
            const x = indexToX(leftIndex + i);
            const yHigh = priceToY(c.high);
            const yLow = priceToY(c.low);
            const yOpen = priceToY(c.open);
            const yClose = priceToY(c.close);

            // signals check
            let color;
            const candleTime = Number(c.time);
            const proAm = proAmData.find(s => Number(s.time) === candleTime);
            if (proAm)
            {
                if ((proAm.flag === "ProSell") || (proAm.flag === "ProBuy"))
                    color = 'blue';                     // Professional signals
                else if ((proAm.flag === "AmSell") || (proAm.flag === "AmBuy")) 
                    color = 'yellow';                   // Amateur signals
            }
            else
                color = c.open > c.close ? 'red' : c.open < c.close ? 'lime' : 'gray';

            if (displayStyle === "ohlc") {
                ctx.strokeStyle = color;

                // high-low line
                ctx.beginPath();
                ctx.moveTo(x, yHigh);
                ctx.lineTo(x, yLow);
                ctx.stroke();

                // open
                ctx.beginPath();
                ctx.moveTo(x - 4, yOpen);
                ctx.lineTo(x, yOpen);
                ctx.stroke();

                // close
                ctx.beginPath();
                ctx.moveTo(x, yClose);
                ctx.lineTo(x + 4, yClose);
                ctx.stroke();
                return;
            }

            ctx.strokeStyle = color;
            ctx.fillStyle = color;

            // wick
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            const bodyTop = Math.min(yOpen, yClose);
            const bodyBottom = Math.max(yOpen, yClose);
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
        });

        const legendItems = [
            { label: "Bull Candle", color: "lime" },
            { label: "Bear Candle", color: "red" },
            { label: "Pro Signal", color: "blue" },
            { label: "Am Signal", color: "yellow" },
        ];
        const legendX = margin + 6;
        const legendY = margin + 6;
        const legendWidth = 150;
        const legendHeight = legendItems.length * 16 + 10;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        ctx.font = "12px Arial";
        legendItems.forEach((item, idx) => {
            const y = legendY + 8 + idx * 16;
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX + 8, y - 6, 10, 10);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(item.label, legendX + 24, y + 2);
        });

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
            drawChart();
        };

        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [candles, offset, spacing, scale, displayStyle]);

    useEffect(() => {
        drawChart();
    }, [candles, offset, spacing, scale, displayStyle]);

    return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '70%' }} />;
}
