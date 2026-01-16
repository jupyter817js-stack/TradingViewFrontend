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

  let HH = 0, LL = 0;
  let CountH = 0, CountL = 0;

  let OscHigh = 0, OscHighOld = 0, OscHighOlder = 0;
  let OscLow = 0, OscLowOld = 0, OscLowOlder = 0;

  let PriceHigh = 0, PriceHighOld = 0, PriceHighOlder = 0;
  let PriceLow = 0, PriceLowOld = 0, PriceLowOlder = 0;

  let prevVal = null;

  return candles.map((c, i) => {
    if (!c || c.time == null) return { time: null, momentum: null, bullDiv: null, bearDiv: null, exBull: null, exBear: null };

    const val = anyIndicator[i];
    if (val == null) return { time: c.time, momentum: null, bullDiv: null, bearDiv: null, exBull: null, exBear: null };

    const data = { time: c.time, momentum: val, bullDiv: null, bearDiv: null, exBull: null, exBear: null };

    const Value2 = val - zeroValue;
    data.momentum = Value2 + zeroValue;

    // --- HH / LL ---
    if (prevVal !== null) {
      if ((prevVal >= 0 && Value2 < 0) || (prevVal >= LL / 2 && Value2 < LL / 2)) LL = Value2;
      if ((prevVal <= 0 && Value2 > 0) || (prevVal <= HH / 2 && Value2 > HH / 2)) HH = Value2;
    }
    if (Value2 < 0 && Value2 <= LL) { LL = Value2; CountL = 0; }
    if (Value2 > 0 && Value2 >= HH) { HH = Value2; CountH = 0; }

    CountL++; CountH++;

    // --- OscLow / PriceLow ---
    if (prevVal !== null && prevVal <= LL / 2 && Value2 > LL / 2) {
      OscLowOlder = OscLowOld; OscLowOld = OscLow; OscLow = LL;
      PriceLowOlder = PriceLowOld; PriceLowOld = PriceLow;
      const idxLow = i - (CountL - 1);
      if (idxLow >= 0 && candles[idxLow]) PriceLow = candles[idxLow].low ?? 0;
    }

    // --- OscHigh / PriceHigh ---
    if (prevVal !== null && prevVal >= HH / 2 && Value2 < HH / 2) {
      OscHighOlder = OscHighOld; OscHighOld = OscHigh; OscHigh = HH;
      PriceHighOlder = PriceHighOld; PriceHighOld = PriceHigh;
      const idxHigh = i - (CountH - 1);
      if (idxHigh >= 0 && candles[idxHigh]) PriceHigh = candles[idxHigh].high ?? 0;
    }

    // --- Divergence ---
    const Condition1 = OscLow > OscLowOld && PriceLow <= PriceLowOld;
    const Condition2 = OscLow > OscLowOlder && PriceLow <= PriceLowOlder;
    const Condition3 = OscHigh < OscHighOld && PriceHigh >= PriceHighOld;
    const Condition4 = OscHigh < OscHighOlder && PriceHigh >= PriceHighOlder;

    if (prevVal !== null && prevVal <= LL / 2 && Value2 > LL / 2 && (Condition1 || Condition2)) data.bullDiv = LL + zeroValue;
    if (prevVal !== null && prevVal >= HH / 2 && Value2 < HH / 2 && (Condition3 || Condition4)) data.bearDiv = HH + zeroValue;

    // --- Exhaustion ---
    if (i >= lookback) {
      const Value2_prev = anyIndicator[i - 1] - zeroValue;
      const lookbackSlice = anyIndicator.slice(i - lookback, i).map(v => Math.abs(v - zeroValue));
      const highestPrev = Math.max(...lookbackSlice);

      if (Math.abs(Value2_prev) === highestPrev) {
        if (Value2_prev < 0 && Value2 > Value2_prev) data.exBull = Value2_prev + zeroValue;
        if (Value2_prev > 0 && Value2 < Value2_prev) data.exBear = Value2_prev + zeroValue;
      }
    }

    prevVal = Value2;
    return data;
  });
}



//  IndicatorChart
export default function SineChart({ candles, offset, spacing, scale, indicatorType = '_Better Mom Any'}) {
  const canvasRef = useRef(null);

    const indicatorLegends = {
        '_Better Mom Any': [
            { text: 'Momentum', color: 'cyan' },
            { text: 'Zero Line', color: 'white' },
            { text: 'Bull Div', color: 'red' },
            { text: 'Bear Div', color: 'white' },
            { text: 'Exhaust Bull', color: 'cyan' },
            { text: 'Exhaust Bear', color: 'cyan' },
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
          colorConfig: { momentum: 'cyan', bullDiv: 'red', bearDiv: 'white', exBull: 'cyan', exBear: 'cyan' }
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

    // max/min 계산 (모든 신호 포함)
    let allValues = [];
    data.forEach(d => {
        if (d.momentum!=null) allValues.push(d.momentum);
        if (d.bullDiv!=null) allValues.push(d.bullDiv);
        if (d.bearDiv!=null) allValues.push(d.bearDiv);
        if (d.exBull!=null) allValues.push(d.exBull);
        if (d.exBear!=null) allValues.push(d.exBear);
    });
    if (!allValues.length) return;

    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
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
          ctx.fillStyle = color.bullDiv; 
          ctx.beginPath(); 
          ctx.arc(x, valueToY(d.bullDiv), r, 0, 2*Math.PI); 
          ctx.fill(); 
      }
      if (d.bearDiv != null){ 
          ctx.fillStyle = color.bearDiv; 
          ctx.beginPath(); 
          ctx.arc(x, valueToY(d.bearDiv), r, 0, 2*Math.PI); 
          ctx.fill(); 
      }
      if (d.exBull != null){ 
          ctx.fillStyle = color.exBull; 
          ctx.beginPath(); 
          ctx.arc(x, valueToY(d.exBull), r*3, 0, 2*Math.PI); 
          ctx.fill(); 
      }
      if (d.exBear != null){ 
          ctx.fillStyle = color.exBear; 
          ctx.beginPath(); 
          ctx.arc(x, valueToY(d.exBear), r*3, 0, 2*Math.PI); 
          ctx.fill(); 
      }
  });

    // 기존 drawIndicator 마지막 부분에서 alerts 대신 legend 사용
    const legends = indicatorLegends[indicatorType] || [];
    const boxWidth = 140;
    const boxHeight = legends.length * 16 + 10;
    const boxX = width - margin - boxWidth;
    const boxY = margin;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.font = '12px sans-serif';
    legends.forEach((a, idx) => {
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(boxX + 8, boxY + 12 + idx*16, 5, 0, 2*Math.PI);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.fillText(a.text, boxX + 20, boxY + 16 + idx*16);
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
