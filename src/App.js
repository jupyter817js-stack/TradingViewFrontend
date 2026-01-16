import React, { useState, useEffect, useRef } from 'react';
import CandleChart from './component/CandleChart';
import OverlayCanvas from './component/OverlayCanvas';
import IndicatorChart from './component/IndicatorChart';
import SineChart from './component/SineChart';
import './App.css';

export default function App() {
  const containerRef = useRef(null);

  const [candles, setCandles] = useState([]);
  const [cursor, setCursor] = useState({ x: null, y: null });
  const [tickSize, setTickSize] = useState(500);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [spacing, setSpacing] = useState(5);
  const [scale, setScale] = useState(1);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastPosition, setLastPosition] = useState(null);
  const [displayStyle, setDisplayStyle] = useState("candles");
  const isMouseDownRef = useRef(false);

  const [showBetterMom, setShowBetterMom] = useState(true);
  const [showProAm, setShowProAm] = useState(true);
  const [showSineSR, setShowSineSR] = useState(true);

  const [oldestTime, setOldestTime] = useState(null);
  const [newestTime, setNewestTime] = useState(null);

  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // Add refs for newest and oldest time
  const newestTimeRef = useRef(null);
  const oldestTimeRef = useRef(null);

  useEffect(() => { newestTimeRef.current = newestTime; }, [newestTime]);
  useEffect(() => { oldestTimeRef.current = oldestTime; }, [oldestTime]);
  useEffect(() => { isMouseDownRef.current = isMouseDown; }, [isMouseDown]);

  const pixelPerCandle = () => spacing * scale * 0.2; // Helper function for pixel per candle

  const [hasInitializedOffset, setHasInitializedOffset] = useState(false);

  const [isRealTime, setIsRealTime] = useState(false);

  const [visibleStartIndex, setVisibleStartIndex] = useState(null);
  const [visibleEndIndex, setVisibleEndIndex] = useState(null);
  const [moveCnt, setMoveCnt] = useState(0);
  const [mode, setMode] = useState("scroll"); // "scroll" | "realtime"
  const dragStartX = useRef(0); // Drag start offset.x

  const FIXED_CANDLE_COUNT = 3000; // Number of candles to display on screen
  const SLICE_COUNT = 1500; // Number of candles to load during drag

  const lastOffsetX = useRef(0);

  /* ===================== Fetch Helper ===================== */
  const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
      )
    ]);
  };

  const normalizeTime = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return num < 1e12 ? num * 1000 : num;
  };

  const getVisibleCount = () => {
    const container = containerRef.current;
    if (!container) return 0;
    return Math.max(1, Math.floor(container.clientWidth / spacing));
  };

  const clampOffset = (value, candleCount, rightPad = 0) => {
    const visibleCount = getVisibleCount();
    const maxOffset = Math.max(0, candleCount - visibleCount + rightPad);
    return Math.min(Math.max(0, value), maxOffset);
  };

  const fetchCandles = async (size, { before, after, limit }) => {
    try {
      const hostname = window.location.hostname;
      const port = 8765;
      const url = new URL(`http://${hostname}:${port}/api/candles`);
      url.searchParams.append('tick_size', size);
      url.searchParams.append('limit', limit);
      if (before) url.searchParams.append('before', before);
      if (after) url.searchParams.append('after', after);

      const res = await fetchWithTimeout(url.toString(), {}, 5000);
      if (!res.ok) return [];

      const data = await res.json();
      console.log('Fetched data times:', data.map(d => new Date(normalizeTime(d.time)).toISOString()));
      if (!Array.isArray(data)) return [];

      return data
        .filter(d => d && d.time != null)
        .map(d => {
          const time = normalizeTime(d.time);
          if (time == null) return null;
          return {
            time,
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close),
            volume: Number(d.volume),
          };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('Fetch error or timeout:', err.message);
      return [];
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!containerRef.current) return;

      setOffset({ x: 0, y: 0 }); // Initialize offset to 0
      setOldestTime(null);
      setNewestTime(null);

      const initial = await fetchCandles(tickSize, { limit: FIXED_CANDLE_COUNT });
      if (!isMounted || !initial.length) return;

      setCandles(initial);
      setOldestTime(initial[0]?.time ?? null);
      setNewestTime(initial[initial.length - 1]?.time ?? null);

      console.log("initial " + oldestTime + " " + newestTime);

      // Start at latest candles with a small right-side pad
      const rightPadCandles = 8;
      const visibleCount = getVisibleCount();
      const initialStartIndex = Math.max(0, initial.length - visibleCount + rightPadCandles);
      setOffset({ x: clampOffset(initialStartIndex, initial.length, rightPadCandles), y: 0 });
      console.log('Initial startIndex:', initialStartIndex);
    })();
    return () => { isMounted = false; };
  }, [tickSize, spacing, scale]);

  /* ===================== Screen Drag and Dynamic Loading ===================== */
  useEffect(() => {
    const delta = offset.x - lastOffsetX.current;
    lastOffsetX.current = offset.x;
    if (delta === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const startIndex = Math.floor(offset.x);
    const endIndex = Math.floor(offset.x + container.clientWidth / spacing);

    setVisibleStartIndex(startIndex);
    setVisibleEndIndex(endIndex);

    // Left edge → prepend
    if (startIndex < 100 && !isLoadingPrev && oldestTime) {
      console.log("prepend " + oldestTime);
      setIsLoadingPrev(true);
      const beforeLimit = candles.length < FIXED_CANDLE_COUNT 
        ? (FIXED_CANDLE_COUNT + SLICE_COUNT - candles.length) 
        : SLICE_COUNT;

      fetchCandles(tickSize, { before: oldestTime, limit: beforeLimit })
        .then(newData => {
          if (newData.length) {
            setCandles(prev => {
              const merged = [...newData, ...prev];
              const sliced = merged.slice(0, FIXED_CANDLE_COUNT);

              const allTimes = sliced.map(c => c.time);
              const newOldest = Math.min(...allTimes);
              const newNewest = Math.max(...allTimes);

              setOldestTime(newOldest);
              setNewestTime(newNewest);

              console.log("prepend " + oldestTime + " " + newestTime);

              return sliced;
            });

            const curStartIndex = Math.floor(candles.length * 0.5);
            setOffset({ x: clampOffset(curStartIndex, candles.length), y: 0 });
            setMode("scroll");
          }
        })
        .finally(() => setIsLoadingPrev(false));
    }

    // Right edge → append
    if (mode === "scroll" && endIndex >= candles.length - 100 && !isLoadingNext && newestTime) {
      console.log("after " + newestTime);

      setIsLoadingNext(true);

      fetchCandles(tickSize, { after: newestTime, limit: SLICE_COUNT })
        .then(newData => {
          if (newData.length) {
            setCandles(prev => {
              const merged = [...prev, ...newData];

              // Calculate min/max before slicing
              const allTimes = merged.map(c => c.time);
              const newOldest = Math.min(...allTimes);
              const newNewest = Math.max(...allTimes);

              console.log("after " + oldestTime + " " + newestTime);

              setOldestTime(newOldest);
              setNewestTime(newNewest);

              if (merged.length < FIXED_CANDLE_COUNT + SLICE_COUNT) {
                setMode("realtime");
                return merged;
              }

              return merged.slice(-FIXED_CANDLE_COUNT);
            });

            const curStartIndex = Math.floor(candles.length * 0.5);
            setOffset({ x: clampOffset(curStartIndex, candles.length), y: 0 });
          }
        })
        .finally(() => setIsLoadingNext(false));
    }

    console.log(
      `Visible range: ${startIndex} ~ ${endIndex}`
    );
  }, [offset.x, spacing, scale, oldestTime, newestTime, tickSize, mode, isLoadingPrev, isLoadingNext, candles]);

  /* ===================== Real-time Latest Data ===================== */
  useEffect(() => {
    if (mode !== "realtime") return;

    const interval = setInterval(async () => {
      // Use latest time ref (state is asynchronous, so ref is recommended)
      const afterParam = Number(newestTimeRef.current) + 1;
      if (!afterParam || !containerRef.current) return;

      const newData = await fetchCandles(tickSize, { after: afterParam, limit: SLICE_COUNT });
      if (!newData.length) return;

      setCandles(prev => {
        const existing = new Set(prev.map(c => c.time));
        const filteredNew = newData.filter(c => !existing.has(c.time));
        const updated = [...prev, ...filteredNew];

        // Synchronize times/refs
        const newOldest = updated[0]?.time ?? oldestTimeRef.current;
        const newNewest = updated[updated.length - 1]?.time ?? newestTimeRef.current;

        setOldestTime(newOldest);
        setNewestTime(newNewest);
        oldestTimeRef.current = newOldest;
        newestTimeRef.current = newNewest;

        if (!isMouseDownRef.current) {
          // Stick to the right edge of the screen
          const rightPadCandles = 8;
          const visibleCount = getVisibleCount();
          const curStartIndex = Math.max(0, updated.length - visibleCount + rightPadCandles);
          setOffset({ x: clampOffset(curStartIndex, updated.length, rightPadCandles), y: 0 });
        }

        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [tickSize, mode]);

  /* ===================== Zoom / Mouse Events ===================== */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMove = e => {
      const rect = container.getBoundingClientRect();
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleWheel = e => {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setScale(prev => Math.max(0.5, Math.min(3, prev * zoomFactor)));
      setSpacing(prev => Math.max(3, prev * zoomFactor));
    };

    const handleMouseDown = e => { 
      setIsMouseDown(true); 
      setLastPosition({ x: e.clientX, y: e.clientY }); 
      dragStartX.current = offset.x;
      setMode("scroll");
    };
    const handleMouseUp = () => {
      setIsMouseDown(false); 
      const deltaCandles = offset.x - dragStartX.current;
      console.log("Number of candles moved in one drag:", deltaCandles);
    };
    const handleMouseMove = e => {
      if (!isMouseDown || !lastPosition) return;
      const deltaX = e.clientX - lastPosition.x;
      setLastPosition({ x: e.clientX, y: e.clientY });
      const rightPadCandles = 8;
      const maxOffset = Math.max(0, candles.length - container.clientWidth / spacing + rightPadCandles);
      setOffset(prev => {
        let newX = prev.x - deltaX / spacing;
        if (newX < 0) newX = 0;
        if (newX > maxOffset) newX = maxOffset;
        return { ...prev, x: newX };
      });
    };
    const handleLeaveMouse = () => setIsMouseDown(false);

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleLeaveMouse);

    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('wheel', handleWheel, { passive: true });
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleLeaveMouse);
    };
  }, [isMouseDown, lastPosition, candles, spacing]);

  return (
    <div className="app">
      <div className="app-shell">
        <header className="app-header">
          <div className="title-block">
            <div className="eyebrow">TickChart</div>
            <h1>Candle Chart + Indicator</h1>
            <p>High-contrast market view with realtime loading, drag panning, and precision zoom.</p>
          </div>
          <div className="status-pills">
            <span className={`pill ${mode === "realtime" ? "pill-live" : "pill-scroll"}`}>
              {mode === "realtime" ? "Live" : "Scroll"}
            </span>
            {mode !== "realtime" && (
              <button
                type="button"
                className="pill pill-action"
                onClick={() => {
                  const rightPadCandles = 8;
                  const visibleCount = getVisibleCount();
                  const curStartIndex = Math.max(0, candles.length - visibleCount + rightPadCandles);
                  setOffset({ x: clampOffset(curStartIndex, candles.length, rightPadCandles), y: 0 });
                  setMode("realtime");
                }}
              >
                Go Live
              </button>
            )}
            <span className="pill pill-muted">{tickSize} tick</span>
            <span className="pill pill-muted">{candles.length} candles</span>
          </div>
        </header>

        <section className="controls-card">
          <div className="control">
            <label className="control-label" htmlFor="tick-size">Tick Size</label>
            <div className="select-wrap">
              <select
                id="tick-size"
                value={tickSize}
                onChange={e => setTickSize(Number(e.target.value))}
              >
                <option value={500}>500</option>
                <option value={1500}>1500</option>
                <option value={4500}>4500</option>
              </select>
            </div>
          </div>
          <div className="control">
            <label className="control-label" htmlFor="display-style">Display</label>
            <div className="select-wrap">
              <select
                id="display-style"
                value={displayStyle}
                onChange={e => setDisplayStyle(e.target.value)}
              >
                <option value="candles">Candles</option>
                <option value="ohlc">OHLC</option>
              </select>
            </div>
          </div>

          <div className="control">
            <span className="control-label">Indicators</span>
            <div className="toggle-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showBetterMom}
                  onChange={e => setShowBetterMom(e.target.checked)}
                />
                <span className="toggle-ui" />
                <span className="toggle-text">Better Mom Any</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showProAm}
                  onChange={e => setShowProAm(e.target.checked)}
                />
                <span className="toggle-ui" />
                <span className="toggle-text">Better Pro Am</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showSineSR}
                  onChange={e => setShowSineSR(e.target.checked)}
                />
                <span className="toggle-ui" />
                <span className="toggle-text">Better Sine SR</span>
              </label>
            </div>
          </div>
        </section>

        <section className="chart-card">
          <div ref={containerRef} className="chart-stage">
            <CandleChart
              candles={candles}
              offset={offset}
              spacing={spacing}
              scale={scale}
              displayStyle={displayStyle}
            />
            <OverlayCanvas candles={candles} cursor={cursor} offset={offset} spacing={spacing} scale={scale} />
            <IndicatorChart
              candles={candles}
              offset={offset}
              spacing={spacing}
              scale={scale}
              showBetterMom={showBetterMom}
              showProAm={showProAm}
              showSineSR={showSineSR}
            />
            <SineChart candles={candles} offset={offset} spacing={spacing} scale={scale} />
          </div>
          <div className="chart-footer">
            <div className="legend">Drag to pan - Scroll to zoom</div>
            <div className="legend-values">
              <span>Scale {scale.toFixed(2)}x</span>
              <span>Spacing {spacing.toFixed(1)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
