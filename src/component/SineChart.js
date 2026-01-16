// IndicatorChart.js
import React, { useRef, useEffect } from 'react';

function rsi(values, length = 5) {
  let avgGain = 0, avgLoss = 0;
  const rsis = Array(values.length).fill(null);

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    if (i <= length) {
      avgGain += gain;
      avgLoss += loss;
      if (i === length) {
        avgGain /= length;
        avgLoss /= length;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        rsis[i] = 100 - (100 / (1 + rs));
      }
    } else {
      avgGain = (avgGain * (length - 1) + gain) / length;
      avgLoss = (avgLoss * (length - 1) + loss) / length;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      rsis[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsis;
}


function calculateBetterMomentum(candles, zeroValue = 50, lookback = 60) {
  if (!candles || !Array.isArray(candles)) return [];

  const closes = candles.map(c => (c?.close ?? 0));
  const anyIndicator = rsi(closes, 5);

  const results = candles.map(c => ({
    time: c?.time ?? null,
    momentum: null,
    bullDiv: null,
    bearDiv: null,
    exBull: null,
    exBear: null,
  }));

  let HH = 0, LL = 0;
  let CountH = 0, CountL = 0;

  let OscHigh = 0, OscHighOld = 0, OscHighOlder = 0;
  let OscLow = 0, OscLowOld = 0, OscLowOlder = 0;

  let PriceHigh = 0, PriceHighOld = 0, PriceHighOlder = 0;
  let PriceLow = 0, PriceLowOld = 0, PriceLowOlder = 0;

  let prevVal = null;

  const value2Arr = Array(candles.length).fill(null);
  const value3Arr = Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || c.time == null) continue;

    const val = anyIndicator[i];
    if (val == null) continue;

    const Value2 = val - zeroValue;
    value2Arr[i] = Value2;
    value3Arr[i] = Math.abs(Value2);
    results[i].momentum = Value2 + zeroValue;

    const crossBelowZero = prevVal !== null && prevVal >= 0 && Value2 < 0;
    const crossBelowLL2 = prevVal !== null && prevVal >= LL / 2 && Value2 < LL / 2;
    if (crossBelowZero || crossBelowLL2) LL = Value2;
    if (Value2 < 0 && Value2 <= LL) { LL = Value2; CountL = 0; }

    const crossAboveZero = prevVal !== null && prevVal <= 0 && Value2 > 0;
    const crossAboveHH2 = prevVal !== null && prevVal <= HH / 2 && Value2 > HH / 2;
    if (crossAboveZero || crossAboveHH2) HH = Value2;
    if (Value2 > 0 && Value2 >= HH) { HH = Value2; CountH = 0; }

    CountL += 1;
    CountH += 1;

    const crossAboveLL2Now = prevVal !== null && prevVal <= LL / 2 && Value2 > LL / 2;
    const crossBelowHH2Now = prevVal !== null && prevVal >= HH / 2 && Value2 < HH / 2;

    if (crossAboveLL2Now) {
      OscLowOlder = OscLowOld; OscLowOld = OscLow; OscLow = LL;
      PriceLowOlder = PriceLowOld; PriceLowOld = PriceLow;
      const idxLow = i - (CountL - 1);
      if (idxLow >= 0 && candles[idxLow]) PriceLow = candles[idxLow].low ?? 0;
    }

    if (crossBelowHH2Now) {
      OscHighOlder = OscHighOld; OscHighOld = OscHigh; OscHigh = HH;
      PriceHighOlder = PriceHighOld; PriceHighOld = PriceHigh;
      const idxHigh = i - (CountH - 1);
      if (idxHigh >= 0 && candles[idxHigh]) PriceHigh = candles[idxHigh].high ?? 0;
    }

    const Condition1 = OscLow > OscLowOld && PriceLow <= PriceLowOld;
    const Condition2 = OscLow > OscLowOlder && PriceLow <= PriceLowOlder;
    const Condition3 = OscHigh < OscHighOld && PriceHigh >= PriceHighOld;
    const Condition4 = OscHigh < OscHighOlder && PriceHigh >= PriceHighOlder;

    if (crossAboveLL2Now && (Condition1 || Condition2)) {
      const bullIndex = i - (CountL - 1);
      if (bullIndex >= 0 && results[bullIndex]) results[bullIndex].bullDiv = LL + zeroValue;
    }
    if (crossBelowHH2Now && (Condition3 || Condition4)) {
      const bearIndex = i - (CountH - 1);
      if (bearIndex >= 0 && results[bearIndex]) results[bearIndex].bearDiv = HH + zeroValue;
    }

    const prevIndex = i - 1;
    if (prevIndex >= 0) {
      const start = Math.max(0, prevIndex - lookback + 1);
      const window = value3Arr.slice(start, prevIndex + 1).filter(v => v != null);
      const Value2_prev = value2Arr[prevIndex];
      if (window.length && Value2_prev != null) {
        const highestPrev = Math.max(...window);
        if (value3Arr[prevIndex] === highestPrev) {
          if (Value2_prev < 0 && Value2 > Value2_prev) results[prevIndex].exBull = Value2_prev + zeroValue;
          if (Value2_prev > 0 && Value2 < Value2_prev) results[prevIndex].exBear = Value2_prev + zeroValue;
        }
      }
    }

    prevVal = Value2;
  }

  return results;
}



//  IndicatorChart
export default function SineChart({ candles, offset, spacing, scale, indicatorType = '_Better Mom Any'}) {
  const canvasRef = useRef(null);

    const indicatorLegends = {
        '_Better Mom Any': [
            { text: 'Momentum (Line)', color: '#39f7ff', shape: 'line' },
            { text: 'Zero Line', color: '#e6e8ee', shape: 'dash' },
            { text: 'Bull Div', color: '#ff4d4d', shape: 'triangle-up' },
            { text: 'Bear Div', color: '#ffffff', shape: 'triangle-down' },
            { text: 'Exhaust Bull', color: '#35d1ff', shape: 'diamond' },
            { text: 'Exhaust Bear', color: '#c77dff', shape: 'diamond' },
        ],
        '_Better Pro Am': [
            // momentum: 'cyan', 
            // bullDiv: 'red', 
            // bearDiv: 'white', 
            // exBull: 'cyan', 
            // exBear: 'cyan',
            // rambo: 'red',
            // nod: 'cyan',
            // profitTake: 'yellow',
            // stoppingVol: 'magenta'
            { text: 'Rambo', color: 'red' },
            { text: 'BearDiv', color: 'white' },
        ],
        '_Better Sine SR': [
            // support: 'red', 
            // resistance: 'white', 
            // breakOut: 'yellow', 
            // pullBack: 'cyan', 
            // endOfTrend: 'magenta'
            { text: 'Support', color: 'red' },
            { text: 'Resistance', color: 'white' },
            { text: 'BreakOut', color: 'yellow' },
            { text: 'PullBack', color: 'cyan' },
            { text: 'End Of Trend', color: 'magenta' },
        ]
    };
  const getIndicatorConfig = (type) => {
    switch(type) {
      case '_Better Mom Any':
        return { 
          func: (c) => calculateBetterMomentum(c), 
          zeroValue: 50,
          zeroColor: '#e6e8ee',
          colorConfig: { momentum: '#39f7ff', bullDiv: '#ff4d4d', bearDiv: '#ffffff', exBull: '#35d1ff', exBear: '#c77dff' }
        };
      default: 
        return null;
    }
};

const drawIndicator = () => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0,0,width,height);

    const margin = 20;
    const innerHeight = height - margin*2;

    const config = getIndicatorConfig(indicatorType);
    if (!config) return;
    const data = config.func(candles);
    const color = config.colorConfig;
    const zeroValue = config.zeroValue;
    const zeroColor = config.zeroColor;

    // max/min 계산 (모든 신호 포함)
    const momentumValues = data.map(d => d.momentum).filter(v => v != null);
    if (!momentumValues.length) return;

    const max = Math.max(...momentumValues);
    const min = Math.min(...momentumValues);
    const valueToY = v => margin + (max - v)/(max - min)*innerHeight;
    const indexToX = i => margin + (i - offset.x)*spacing;

    // y축 격자
    ctx.strokeStyle = '#555';
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    for (let i=0;i<=4;i++){
        const val = min + (max-min)*(i/4);
        const y = valueToY(val);
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width-margin, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(2), 2, y+3);
    }

    // x축 격자
    for (let i=0;i<data.length;i+=Math.ceil(data.length/5)){
        const x = indexToX(i);
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, height-margin);
        ctx.stroke();
    }

    // Momentum 라인
    if (zeroValue != null) {
        const yZero = valueToY(zeroValue);
        ctx.save();
        ctx.strokeStyle = zeroColor || '#e6e8ee';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, yZero);
        ctx.lineTo(width - margin, yZero);
        ctx.stroke();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.strokeStyle = color.momentum;
    data.forEach((d,i)=>{
        if (d.momentum==null) return;
        const x = indexToX(i), y = valueToY(d.momentum);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // 원만 표시
    const r = 3;
    data.forEach((d,i)=>{
      const x = indexToX(i);

      if (d.bullDiv != null){ 
          const y = valueToY(d.bullDiv);
          ctx.fillStyle = color.bullDiv; 
          ctx.beginPath(); 
          ctx.moveTo(x, y - r * 2);
          ctx.lineTo(x + r * 2, y + r * 2);
          ctx.lineTo(x - r * 2, y + r * 2);
          ctx.closePath();
          ctx.fill(); 
      }
      if (d.bearDiv != null){ 
          const y = valueToY(d.bearDiv);
          ctx.fillStyle = color.bearDiv; 
          ctx.beginPath(); 
          ctx.moveTo(x - r * 2, y - r * 2);
          ctx.lineTo(x + r * 2, y - r * 2);
          ctx.lineTo(x, y + r * 2);
          ctx.closePath();
          ctx.fill(); 
      }
      if (d.exBull != null){ 
          const y = valueToY(d.exBull);
          ctx.fillStyle = color.exBull; 
          ctx.beginPath(); 
          ctx.moveTo(x, y - r * 3);
          ctx.lineTo(x + r * 2, y);
          ctx.lineTo(x, y + r * 3);
          ctx.lineTo(x - r * 2, y);
          ctx.closePath();
          ctx.fill(); 
      }
      if (d.exBear != null){ 
          const y = valueToY(d.exBear);
          ctx.fillStyle = color.exBear; 
          ctx.beginPath(); 
          ctx.moveTo(x, y - r * 3);
          ctx.lineTo(x + r * 2, y);
          ctx.lineTo(x, y + r * 3);
          ctx.lineTo(x - r * 2, y);
          ctx.closePath();
          ctx.fill(); 
      }
  });

    // 기존 drawIndicator 마지막 부분에서 alerts 대신 legend 사용
    const legends = indicatorLegends[indicatorType] || [];
    const boxWidth = 175;
    const boxHeight = legends.length * 18 + 12;
    const boxX = width - margin - boxWidth;
    const boxY = margin;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.font = '12px sans-serif';
    legends.forEach((a, idx) => {
        const legendX = boxX + 12;
        const legendY = boxY + 14 + idx*18;
        ctx.strokeStyle = a.color;
        ctx.fillStyle = a.color;

        if (a.shape === 'line') {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(legendX - 4, legendY);
            ctx.lineTo(legendX + 10, legendY);
            ctx.stroke();
        } else if (a.shape === 'dash') {
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(legendX - 4, legendY);
            ctx.lineTo(legendX + 10, legendY);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (a.shape === 'triangle-up') {
            ctx.beginPath();
            ctx.moveTo(legendX + 2, legendY - 6);
            ctx.lineTo(legendX + 8, legendY + 4);
            ctx.lineTo(legendX - 4, legendY + 4);
            ctx.closePath();
            ctx.fill();
        } else if (a.shape === 'triangle-down') {
            ctx.beginPath();
            ctx.moveTo(legendX - 4, legendY - 4);
            ctx.lineTo(legendX + 8, legendY - 4);
            ctx.lineTo(legendX + 2, legendY + 6);
            ctx.closePath();
            ctx.fill();
        } else if (a.shape === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(legendX + 2, legendY - 6);
            ctx.lineTo(legendX + 8, legendY);
            ctx.lineTo(legendX + 2, legendY + 6);
            ctx.lineTo(legendX - 4, legendY);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(legendX + 2, legendY, 4, 0, 2*Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = 'white';
        ctx.fillText(a.text, boxX + 28, legendY + 4);
    });
};

  useEffect(()=>{
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = ()=>{
      canvas.width = canvas.clientWidth*dpr;
      canvas.height = canvas.clientHeight*dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr,dpr);
      drawIndicator();
    };
    window.addEventListener('resize',resize);
    resize();
    return ()=>window.removeEventListener('resize',resize);
  },[candles, offset, spacing, scale, indicatorType]);

  useEffect(()=>{ drawIndicator(); },[candles, offset, spacing, scale, indicatorType]);

  return <canvas ref={canvasRef} style={{position:'absolute',bottom:0,left:0,width:'100%',height:'30%'}} />;
}
