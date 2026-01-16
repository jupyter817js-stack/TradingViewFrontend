// ==========================
// Better Pro Am (React/JS)
// ==========================
export function calculateBetterProAm(candles, pattern = 1) {
  const n = candles.length;
  // Initialize signals array for each candle
  const signalsPerCandle = Array(0).fill(null).map(() => []);

  const Var1 = Array(n).fill(0);
  const Var2 = 20; // Lookback period
  const Range = Array(n).fill(0);

  // Calculate range for each candle
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    Range[i] = c.high - c.low;
  }

  for (let i = Var2; i < n; i++) {
    // Average volume over the last 20 candles
    const avgVol =
      candles.slice(i - Var2 + 1, i + 1).reduce((a, b) => a + b.volume, 0) /
      Var2;

    // Average range over the last 20 candles
    const avgRange =
      Range.slice(i - Var2 + 1, i + 1).reduce((a, b) => a + b, 0) / Var2;

    // Current candle range relative to average range
    Var1[i] = Range[i] / avgRange;

    // ==========================
    // Professional Activity (Pro)
    // ==========================
    if (
      candles[i].volume > avgVol &&
      Var1[i] > 1.5 &&
      candles[i].close < candles[i - 1].close
    ) {
      signalsPerCandle.push({
        time: candles[i].time,
        flag: "ProSell"
      });
    }
    if (
      candles[i].volume > avgVol &&
      Var1[i] > 1.5 &&
      candles[i].close > candles[i - 1].close
    ) {
      signalsPerCandle.push({
        time: candles[i].time,
        flag: "ProBuy"
      });
    }

    // ==========================
    // Amateur Activity (Am)
    // ==========================
    if (
      candles[i].volume < avgVol &&
      Var1[i] < 0.7 &&
      candles[i].close > candles[i - 1].close
    ) {
      signalsPerCandle.push({
        time: candles[i].time,
        flag: "AmBuy"
      });
    }
    if (
      candles[i].volume < avgVol &&
      Var1[i] < 0.7 &&
      candles[i].close < candles[i - 1].close
    ) {
      signalsPerCandle.push({
        time: candles[i].time,
        flag: "AmSell"
      });
    }
  }

  return signalsPerCandle;
}