// IndicatorChart.js
import React, { useRef, useEffect } from 'react';

const BullishColor = "#0000FF"; // EasyLanguage 255 
const BearishColor = "#FFFFFF"; // EasyLanguage 16777215 

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


// Better Momentum Any
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



// ---------- Utilities ----------
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
}

function lowest(arr) {
  return Math.min(...arr);
}

function highest(arr) {
  return Math.max(...arr);
}

// ---------- Core computation ----------
export function calculateBetterProAm(candles, config = {}) {
  const Var2 = 20; // Lookback
  const Space = config.Space !== undefined ? config.Space : true;
  const SpaceMulti = config.SpaceMulti !== undefined ? config.SpaceMulti : 1;
  const TextSpaceMulti = config.TextSpaceMulti !== undefined ? config.TextSpaceMulti : 0.75;

  const signals = [];

  const Var1 = Array(candles.length).fill(0);
  const Range = candles.map(c => c.high - c.low);

  let Var4 = 0;
  let Var5 = 0;
  const Var6Arr = Array(candles.length).fill(0);

  for (let i = Var2; i < candles.length; i++) {
    const windowCandles = candles.slice(i - Var2 + 1, i + 1);
    const avgVol = average(windowCandles.map(c => c.volume));
    const avgRange = average(Range.slice(i - Var2 + 1, i + 1));
    Var1[i] = Range[i] / avgRange;
    Var6Arr[i] = avgRange * TextSpaceMulti;

    const c = candles[i];
    const prev1 = candles[i - 1];
    const prev2 = candles[i - 2];

    // ==========================
    // RAMBO
    // ==========================
    const lowestLow = lowest(candles.slice(i - Var2 + 1, i).map(c => c.low));
    const highestHigh = highest(candles.slice(i - Var2 + 1, i).map(c => c.high));

    if (c.low <= lowestLow) {
      Var4 += Var6Arr[i];
      signals.push({ time: c.time, flag: "RamboBull" });        //RamboBull
    }
    if (c.high >= highestHigh) {
      Var5 += Var6Arr[i];
      signals.push({ time: c.time, flag: "RamboBear" });        //RamboBear
    }

    // ==========================
    // NoD / NoS
    // ==========================
    const Var3 =
      c.low < lowest(candles.slice(i - Var2 + 1, i).map(c => c.low))
        ? 1
        : c.high > highest(candles.slice(i - Var2 + 1, i).map(c => c.high))
        ? -1
        : 0;

    const Var13 =
      c.close >= c.low + 0.4 * Range[i] &&
      c.low < prev1.low &&
      c.low < prev2.low &&
      Var1[i] < Var1[i - 1] &&
      Var1[i] < Var1[i - 2] &&
      (Range[i] < Range[i - 1] || Range[i] < Range[i - 2]) &&
      Var3 === 1;

    const Var14 =
      c.close <= c.high - 0.4 * Range[i] &&
      c.high > prev1.high &&
      c.high > prev2.high &&
      Var1[i] < Var1[i - 1] &&
      Var1[i] < Var1[i - 2] &&
      (Range[i] < Range[i - 1] || Range[i] < Range[i - 2]) &&
      Var3 === -1;

    if (Var13) {
      Var4 += Var6Arr[i];
      signals.push({ time: c.time, flag: "NoS" });
    }
    if (Var14) {
      Var5 += Var6Arr[i];
      signals.push({ time: c.time, flag: "NoD" });
    }

    // ==========================
    // Profit Take (PT)
    // ==========================
    const Var15 =
      c.close >= c.low + 0.4 * Range[i] &&
      c.close <= c.low + 0.6 * Range[i] &&
      c.close < prev1.close &&
      c.low < prev1.low &&
      Var1[i] > Var1[i - 1] &&
      Var3 === 1;

    const Var16 =
      c.close >= c.low + 0.4 * Range[i] &&
      c.close <= c.low + 0.6 * Range[i] &&
      c.close > prev1.close &&
      c.high > prev1.high &&
      Var1[i] > Var1[i - 1] &&
      Var3 === -1;

    if (Var15) {
      Var4 += Var6Arr[i];
      signals.push({ time: c.time, flag: "PTBull" });
    }
    if (Var16) {
      Var5 += Var6Arr[i];
      signals.push({ time: c.time, flag: "PTBear" });
    }

    // ==========================
    // Stopping Volume
    // ==========================
    const Var17 = Range[i] < Range[i - 1] && Var1[i] > Var1[i - 1] && c.high < prev1.low;
    const Var18 = Range[i] < Range[i - 1] && Var1[i] > Var1[i - 1] && c.low > prev1.high;

    if (Var17) {
      Var4 += Var6Arr[i];
      signals.push({ time: c.time, flag: "StStar" });
    }
    if (Var18) {
      Var5 += Var6Arr[i];
      signals.push({ time: c.time, flag: "StStar" });
    }
  }

  return signals;
}

// Better Pro Am
function calculateBetterProAm_Old(candles, options = {}) {
  const {
    RAMBO = true,
    NoD = true,
    ProfitTake = true,
    StoppingVol = true,
    RAMBOAlert = false,
    NoDAlert = false,
    ProfitTakeAlert = false,
    StoppingVolAlert = false,
    BullishColor = 'red',
    BearishColor = 'white',
    Space = true,
    SpaceMulti = 1,
    TextSpaceMulti = 0.75,
  } = options;

  const n = candles.length;
  const Var2 = 20; // lookback
  let Var1, Var3;
  let Var4 = 0, Var5 = 0; // text offset
  const signalsPerCandle = Array(n).fill(null).map(() => []);

  const ranges = candles.map(c => c.high - c.low);

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    Var1 = c.volume ?? 0; 

    if (i >= Var2) {
      const recentLows = candles.slice(i - Var2, i).map(x => x.low);
      const recentHighs = candles.slice(i - Var2, i).map(x => x.high);
      if (c.low < Math.min(...recentLows)) Var3 = 1;
      else if (c.high > Math.max(...recentHighs)) Var3 = -1;
      else Var3 = 0;
    } else {
      Var3 = 0;
    }

    // Space calculate
    let Var6 = ranges[i] * TextSpaceMulti;

    // --- RAMBO ---
    if (RAMBO && i >= Var2) {
      const recentVolumes = candles.slice(i - Var2, i).map(x => x.volume);
      const minVol1 = Math.min(...recentVolumes);
      const minVol2 = [...recentVolumes].sort((a,b)=>a-b)[1];

      if (Var1 === minVol1 || Var1 === minVol2) {
        // Bull
        if (Var3 === 1 && c.low === Math.min(...candles.slice(i-Var2, i).map(x=>x.low))) {
          Var4 += Var6;
          signalsPerCandle[i].push({ y: c.low - Var4, text: 'R', color: BullishColor });
          if (RAMBOAlert) console.log("RAMBO bull alert", c.time);
        }
        // Bear
        if (Var3 === -1 && c.high === Math.max(...candles.slice(i-Var2, i).map(x=>x.high))) {
          Var5 += Var6;
          signalsPerCandle[i].push({ y: c.high + Var5, text: 'R', color: BearishColor });
          if (RAMBOAlert) console.log("RAMBO bear alert", c.time);
        }
      }
    }

    // --- No Demand / No Supply ---
    const Range = ranges[i];
    const Var13 = c.close >= c.low + 0.4*Range && c.low < (candles[i-1]?.low ?? 0) && c.low < (candles[i-2]?.low ?? 0) && Var1 < (candles[i-1]?.volume ?? 0) && Var1 < (candles[i-2]?.volume ?? 0) && ((Range < (candles[i-1]?.high - candles[i-1]?.low ?? 0)) || (Range < (candles[i-2]?.high - candles[i-2]?.low ?? 0))) && Var3 === 1;
    const Var14 = c.close <= c.high - 0.4*Range && c.high > (candles[i-1]?.high ?? 0) && c.high > (candles[i-2]?.high ?? 0) && Var1 < (candles[i-1]?.volume ?? 0) && Var1 < (candles[i-2]?.volume ?? 0) && ((Range < (candles[i-1]?.high - candles[i-1]?.low ?? 0)) || (Range < (candles[i-2]?.high - candles[i-2]?.low ?? 0))) && Var3 === -1;

    if (NoD) {
      if (Var13) {
        Var4 += Var6;
        signalsPerCandle[i].push({ y: c.low - Var4, text: 'NoS', color: BullishColor });
        if (NoDAlert) console.log("NoSupply alert", c.time);
      }
      if (Var14) {
        Var5 += Var6;
        signalsPerCandle[i].push({ y: c.high + Var5, text: 'NoD', color: BearishColor });
        if (NoDAlert) console.log("NoDemand alert", c.time);
      }
    }

    // --- Profit Take ---
    const Var15 = c.close >= c.low+0.4*Range && c.close <= c.low+0.6*Range && c.close < (candles[i-1]?.close ?? 0) && c.low < (candles[i-1]?.low ?? 0) && Var1 > (candles[i-1]?.volume ?? 0) && Var3 === 1;
    const Var16 = c.close >= c.low+0.4*Range && c.close <= c.low+0.6*Range && c.close > (candles[i-1]?.close ?? 0) && c.high > (candles[i-1]?.high ?? 0) && Var1 > (candles[i-1]?.volume ?? 0) && Var3 === -1;

    if (ProfitTake) {
      if (Var15) {
        Var4 += Var6;
        signalsPerCandle[i].push({ y: c.low - Var4, text: 'PT', color: BullishColor });
        if (ProfitTakeAlert) console.log("Profit Take bull alert", c.time);
      }
      if (Var16) {
        Var5 += Var6;
        signalsPerCandle[i].push({ y: c.high + Var5, text: 'PT', color: BearishColor });
        if (ProfitTakeAlert) console.log("Profit Take bear alert", c.time);
      }
    }

    // --- Stopping Volume ---
    const Var17 = Range < ((candles[i-1]?.high ?? 0)-(candles[i-1]?.low ?? 0)) && Var1 > (candles[i-1]?.volume ?? 0) && c.high < (candles[i-1]?.low ?? 0);
    const Var18 = Range < ((candles[i-1]?.high ?? 0)-(candles[i-1]?.low ?? 0)) && Var1 > (candles[i-1]?.volume ?? 0) && c.low > (candles[i-1]?.high ?? 0);

    if (StoppingVol) {
      if (Var17) {
        Var4 += Var6;
        signalsPerCandle[i].push({ y: c.low - Var4, text: 'St*', color: BullishColor });
        if (StoppingVolAlert) console.log("Stopping Volume bull alert", c.time);
      }
      if (Var18) {
        Var5 += Var6;
        signalsPerCandle[i].push({ y: c.high + Var5, text: 'St*', color: BearishColor });
        if (StoppingVolAlert) console.log("Stopping Volume bear alert", c.time);
      }
    }
    if (Var13) console.log('NoS triggered at index', i);
    if (Var14) console.log('NoD triggered at index', i);
    if (Var15) console.log('ProfitTake bull at index', i);
    if (Var16) console.log('ProfitTake bear at index', i);
    if (Var17) console.log('StoppingVol bull at index', i);
    if (Var18) console.log('StoppingVol bear at index', i);
  }
  return candles.map((c,i)=>({ time: c.time, signals: signalsPerCandle[i] }));
}

function calculateBetterSineSR(candles) {
  const n = candles.length;
  const data = [];

  let Var1 = 0, Var2 = 0, Var3 = 0;
  let Var5 = false, Var6 = false, Var9 = false, Var10 = false, Var11 = false, Var12 = false;
  let Var7 = candles[0]?.close ?? 0;
  let Var8 = candles[0]?.close ?? 0;
  let Var13 = 1;

  const minMove = 1;
  const priceScale = 1;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const prevC = candles[i - 1] || c;

    const point = {
      time: c.time,
      support: null,
      resistance: null,
      breakOut: null,
      pullBack: null,
      endOfTrend: null,
    };

    // --- Hilbert / Sine calculate ---
    Var1 = (c.high + c.low) / 2;
    Var2 = Math.sin(Var1) * 100;
    Var3 = Math.sin(Var1 + Math.PI/4) * 100; // 45도 = π/4 rad
    const Var4 = minMove / priceScale;

    // --- CROSS OVER / CROSS UNDER ---
    if (Var3 > Var2 && !Var5) Var6 = true;
    if (Var3 < Var2 && !Var6) Var5 = true;

    // --- Support/Resistance calculate ---
    if (Var3 > Var2 && Var6 && c.high > prevC.high) {
      Var7 = Var8;
      Var8 = Math.min(c.low, prevC.low) - Var4;
      Var6 = false; Var9 = true; Var10 = false; Var11 = true;
      // Var13 state manage
      if ((Var13 === 2 || Var13 === -4) && Var8 >= Var7) Var13 = 3;
      if (Var13 === -3 && Var8 <= Var7) Var13 = -5;
      if (![3, -5].includes(Var13)) Var13 = -1;
    }

    if (Var3 < Var2 && Var5 && c.low < prevC.low) {
      Var7 = Var8;
      Var8 = Math.max(c.high, prevC.high) + Var4;
      Var5 = false; Var10 = true; Var9 = false; Var12 = true;
      // Var13 state manage
      if ((Var13 === -2 || Var13 === 4) && Var8 <= Var7) Var13 = -3;
      if (Var13 === 3 && Var8 >= Var7) Var13 = 5;
      if (![ -3, 5 ].includes(Var13)) Var13 = 1;
    }

    // --- Plot ---
    if (Var9) point.support = Var8;
    if (Var10) point.resistance = Var8;

    if (Var9 && c.close < Var8 && Var3 > 0 && Var11) {
      point.breakOut = c.low;
      Var11 = false;
      if (Var13 === 3) Var13 = 4; else if (Var13 === -2) Var13 = -2;
    }

    if (Var10 && c.close > Var8 && Var3 < 0 && Var12) {
      point.breakOut = c.high;
      Var12 = false;
      if (Var13 === -3) Var13 = -4; else if (Var13 === 2) Var13 = 2;
    }

    // --- PullBack / EndOfTrend ---
    if ((Var13 === 3 || Var13 === -3) && i > 0) point.pullBack = Var8;
    if ((Var13 === 5 || Var13 === -5) && i > 0) point.endOfTrend = Var8;

    data.push(point);
  }

  return data;
}


// IndicatorChart
export default function IndicatorChart({ candles, offset, spacing, scale , showBetterMom = true, showProAm = true, showSineSR = true}) {
  const canvasRef = useRef(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    const margin = 20;
    const innerHeight = height - margin * 2;

    //  select visibleCandles with the same CandleChart
    const leftIndexFloat = offset.x;
    const rightIndexFloat = offset.x + width / spacing;
    const leftIndex = Math.max(0, Math.floor(leftIndexFloat));
    const rightIndex = Math.min(candles.length - 1, Math.ceil(rightIndexFloat));

    const visibleCandles = candles.slice(leftIndex, rightIndex + 1);
    if (!visibleCandles.length) return;

    // calc  max/min
    const maxPrice = Math.max(...visibleCandles.map(c => c.high));
    const minPrice = Math.min(...visibleCandles.map(c => c.low));

    const priceToY = price => margin + (maxPrice - price) / (maxPrice - minPrice) * innerHeight;
    const indexToX = i => margin + (i - offset.x) * spacing;

    const r = 3;

    // ==========================
    // Better Momentum
    // ==========================
    if (showBetterMom)
    {
        const momData = calculateBetterMomentum(candles);

        momData.forEach((d, i) => {
        if (i < leftIndex || i > rightIndex) return;
        const x = indexToX(i);

        if (d.bullDiv) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(x, priceToY(candles[i].low), r, 0, 2 * Math.PI);
            ctx.fill();
        }
        if (d.bearDiv) {
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(x, priceToY(candles[i].high), r, 0, 2 * Math.PI);
            ctx.fill();
        }
        if (d.exBull) {
            ctx.fillStyle = "cyan";
            ctx.beginPath();
            ctx.arc(x, priceToY(candles[i].low), r * 0.75, 0, 2 * Math.PI);
            ctx.fill();
        }
        if (d.exBear) {
            ctx.fillStyle = "cyan";
            ctx.beginPath();
            ctx.arc(x, priceToY(candles[i].high), r * 0.75, 0, 2 * Math.PI);
            ctx.fill();
        }
        });
    }
    
    // ==========================
    // Pro Arm
    // ==========================
    if (showProAm)
    {
        const signals = calculateBetterProAm(candles);

        // --------------------------
        const timeToIndex = new Map();
        candles.forEach((c, idx) => timeToIndex.set(c.time, idx));

        // --------------------------
        const signalsByTime = new Map();
        for (const s of signals) {
        const key = s.time;
        if (!signalsByTime.has(key)) signalsByTime.set(key, []);
        signalsByTime.get(key).push(s);
        }

        // --------------------------
        function colorToCss(col) {
        if (col === undefined || col === null) return "#ffffff";
        if (typeof col === "number") {
            const hex = col.toString(16).padStart(6, "0");
            return `#${hex}`;
        }
        if (typeof col === "string") return col;
        return "#ffffff";
        }
        const bullishCss = colorToCss(BullishColor);
        const bearishCss = colorToCss(BearishColor);

        const fontSize = 12;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // --------------------------
        for (const [time, arr] of signalsByTime) {
        const idx = timeToIndex.get(time);
        if (idx === undefined) {
            continue;
        }

        const c = candles[idx];
        const x = indexToX(idx);

        const candlePixelHeight = Math.max(1, Math.abs(priceToY(c.high) - priceToY(c.low)));
        const lineHeight = Math.max(12, Math.min(20, Math.round(candlePixelHeight * 0.35))); // 12~20px 사이

        const bullish = arr.filter(s => ["RamboBull", "NoS", "PTBull", "St"].includes(s.flag));
        const bearish = arr.filter(s => ["RamboBear", "NoD", "PTBear", "StStar"].includes(s.flag));
        const others = arr.filter(s => !bullish.includes(s) && !bearish.includes(s));

        bullish.forEach((signal, i) => {
            const yBase = priceToY(c.low) + 5;
            const y = yBase + i * lineHeight;
            const text = signal.flag === "RamboBull" ? "RB" : signal.flag;
            ctx.fillStyle = bullishCss;
            ctx.fillText(text, x, y);
        });

        bearish.forEach((signal, i) => {
            const yBase = priceToY(c.high) - 5;
            const y = yBase - i * lineHeight;
            const text = signal.flag === "RamboBear" ? "RB" : signal.flag;
            ctx.fillStyle = bearishCss;
            ctx.fillText(text, x, y);
        });

        others.forEach((signal, i) => {
            const yBase = priceToY(c.low) + 5 + (bullish.length + i) * lineHeight;
            ctx.fillStyle = "#ffffff";
            ctx.fillText(signal.flag, x, yBase);
        });
        }


        // const proAmData = calculateBetterProAm(candles);
        // console.log(proAmData);
        // proAmData[20].signals.push({ y: candles[20].low, text: 'St*', color: 'cyan' });
        // console.log(proAmData[20]);
        // proAmData.forEach((d, i) => {
        //     if (i < leftIndex || i > rightIndex) return; // pass if out of screen
        //     const x = indexToX(i);

        //     d.signals.forEach(sig => {
        //         const y = priceToY(sig.y);

        //         let color;
        //         switch (sig.text) {
        //         case 'R':          // RAMBO
        //             color = 'red';
        //             break;
        //         case 'NoS':        // No Supply
        //         case 'NoD':        // No Demand
        //             color = 'cyan';
        //             break;
        //         case 'PT':         // Profit Take
        //             color = 'yellow';
        //             break;
        //         case 'St':         // Stopping Volume
        //         case 'St*':
        //             color = 'magenta';
        //             break;
        //         default:
        //             color = 'white';
        //         }

        //         ctx.fillStyle = color;
        //         ctx.font = `${r * 3}px Arial`;
        //         ctx.textAlign = "center";
        //         ctx.textBaseline = "middle";
        //         ctx.fillText(sig.text, x, y);
        //     });
        // });

        // // professinal/amateur
        // const signalsByCandle = calculateBetterProAm(candles);
        // signalsByCandle.slice(leftIndex, rightIndex + 1).forEach((c, i) => {
        //     const x = indexToX(leftIndex + i);
        //     c.signals.forEach(sig => {
        //         const y = priceToY(sig.y);
        //         // pro: red/white, am: cyan
        //         let sigColor = sig.color;
        //         ctx.strokeStyle = sigColor;
        //         ctx.beginPath();
        //         ctx.moveTo(x - 5, y);
        //         ctx.lineTo(x + 5, y);
        //         ctx.stroke();
        //         ctx.beginPath();
        //         ctx.moveTo(x, y - 5);
        //         ctx.lineTo(x, y + 5);
        //         ctx.stroke();
        //     });
        // });
    }

    // ==========================
    // Better Sine SR
    // ==========================
    if (showSineSR)
    {
        const srData = calculateBetterSineSR(candles);

        const drawnSupportLevels = new Set();
        const drawnResistanceLevels = new Set();
        const drawnPullBackLevels = new Set();
        const drawnEndTrendLevels = new Set();

        srData.forEach((d, i) => {
        if (i < leftIndex || i > rightIndex) return;
        const x = indexToX(i);

        // Support line draw always
        if (d.support !== null) {
            ctx.strokeStyle = "green";
            ctx.beginPath();
            ctx.moveTo(x, priceToY(d.support));
            ctx.lineTo(x + spacing, priceToY(d.support));
            ctx.stroke();

            if (!drawnSupportLevels.has(d.support)) {
            ctx.fillStyle = "green";
            ctx.font = "12px Arial";
            ctx.fillText("S", x, priceToY(d.support) - 10);
            drawnSupportLevels.add(d.support);
            }
        }

        if (d.resistance !== null) {
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.moveTo(x, priceToY(d.resistance));
            ctx.lineTo(x + spacing, priceToY(d.resistance));
            ctx.stroke();

            if (!drawnResistanceLevels.has(d.resistance)) {
            ctx.fillStyle = "red";
            ctx.fillText("R", x, priceToY(d.resistance) - 10);
            drawnResistanceLevels.add(d.resistance);
            }
        }

        if (d.breakOut !== null) {
            ctx.fillStyle = "orange";
            ctx.beginPath();
            ctx.arc(x, priceToY(d.breakOut), 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        if (d.pullBack !== null && !drawnPullBackLevels.has(d.pullBack)) {
            ctx.fillStyle = "cyan";
            ctx.font = "bold 12px Arial";
            ctx.fillText("PB", x, priceToY(d.pullBack) - 10);
            drawnPullBackLevels.add(d.pullBack);
        }

        if (d.endOfTrend !== null && !drawnEndTrendLevels.has(d.endOfTrend)) {
            ctx.fillStyle = "purple";
            ctx.font = "bold 12px Arial";
            ctx.fillText("END", x, priceToY(d.endOfTrend) - 10);
            drawnEndTrendLevels.add(d.endOfTrend);
        }
        });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      draw();
    };
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, [candles, offset, spacing, scale, showBetterMom, showProAm, showSineSR]);

  useEffect(() => {
    draw();
  }, [candles, offset, spacing, scale, showBetterMom, showProAm, showSineSR]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "70%",
        pointerEvents: "none",
      }}
    />
  );
}
