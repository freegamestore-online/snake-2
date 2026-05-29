import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, GameTopbar, GameAuth } from "@freegamestore/games";

const CELL = 20;
const COLS = 24;
const ROWS = 24;
const W = COLS * CELL;
const H = ROWS * CELL;
const TICK = 120;

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Point = { x: number; y: number };

const rand = (max: number) => Math.floor(Math.random() * max);
const newFood = (snake: Point[]): Point => {
  let f: Point;
  do { f = { x: rand(COLS), y: rand(ROWS) }; }
  while (snake.some(s => s.x === f.x && s.y === f.y));
  return f;
};

const COLORS = {
  bg: "var(--bg, #0a0a0f)",
  grid: "#12121a",
  head: "var(--accent, #00ffaa)",
  headGlow: "#00ffaa88",
  body: "#00cc88",
  tail: "#007755",
  food: "#ff4466",
  foodGlow: "#ff446688",
  text: "var(--ink, #e0ffe0)",
  dim: "#334433",
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"idle" | "playing" | "dead">("idle");
  const [paused, setPaused] = useState(false);

  const snake = useRef<Point[]>([{ x: 12, y: 12 }]);
  const dir = useRef<Dir>("RIGHT");
  const nextDir = useRef<Dir>("RIGHT");
  const food = useRef<Point>(newFood(snake.current));
  const scoreRef = useRef(0);
  const animRef = useRef<number>(0);
  const lastTick = useRef(0);
  const holdStart = useRef<number | null>(null);
  const holdDir = useRef<Dir | null>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const touchHoldStart = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.grid;
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const s = snake.current;

    for (let i = s.length - 1; i >= 1; i--) {
      const t = i / s.length;
      const seg = s[i]!;
      const prev = s[i - 1]!;

      const alpha = Math.round((0.4 + 0.6 * (1 - t)) * 255).toString(16).padStart(2, "0");
      ctx.fillStyle = i === s.length - 1 ? COLORS.tail : COLORS.body + alpha;

      const pad = i === s.length - 1 ? 5 : 3;
      const size = CELL - pad * 2;
      const rx = seg.x * CELL + pad;
      const ry = seg.y * CELL + pad;

      ctx.beginPath();
      ctx.roundRect(rx, ry, size, size, i === s.length - 1 ? 6 : 4);
      ctx.fill();

      if (i < s.length - 1) {
        const cx = Math.min(seg.x, prev.x) * CELL + (seg.x === prev.x ? pad : 0);
        const cy = Math.min(seg.y, prev.y) * CELL + (seg.y === prev.y ? pad : 0);
        const cw = seg.x === prev.x ? size : CELL;
        const ch = seg.y === prev.y ? size : CELL;
        ctx.fillStyle = COLORS.body + alpha;
        ctx.fillRect(cx, cy, cw, ch);
      }
    }

    const head = s[0]!;
    ctx.shadowColor = COLORS.headGlow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#00ffaa";
    ctx.beginPath();
    ctx.roundRect(head.x * CELL + 2, head.y * CELL + 2, CELL - 4, CELL - 4, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    const d = dir.current;
    let eye1: Point, eye2: Point;
    if (d === "RIGHT") { eye1 = { x: 13, y: 5 }; eye2 = { x: 13, y: 13 }; }
    else if (d === "LEFT") { eye1 = { x: 5, y: 5 }; eye2 = { x: 5, y: 13 }; }
    else if (d === "UP") { eye1 = { x: 5, y: 5 }; eye2 = { x: 13, y: 5 }; }
    else { eye1 = { x: 5, y: 13 }; eye2 = { x: 13, y: 13 }; }

    ctx.fillStyle = "#0a0a0f";
    [eye1, eye2].forEach(e => {
      ctx.beginPath();
      ctx.arc(head.x * CELL + e.x, head.y * CELL + e.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const appleX = food.current.x * CELL + CELL / 2;
    const appleY = food.current.y * CELL + CELL / 2;
    const appleRadius = CELL / 2 - 4;
    const appleGradient = ctx.createRadialGradient(appleX - 4, appleY - 6, 2, appleX, appleY, appleRadius);
    appleGradient.addColorStop(0, "#ff7a8e");
    appleGradient.addColorStop(0.6, "#ff4466");
    appleGradient.addColorStop(1, "#c92442");

    ctx.shadowColor = COLORS.foodGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = appleGradient;
    ctx.beginPath();
    ctx.arc(appleX, appleY, appleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#6a3c1d";
    ctx.fillRect(appleX + 2, appleY - appleRadius + 2, 2, 8);

    ctx.fillStyle = "#61c06a";
    ctx.beginPath();
    ctx.ellipse(appleX - 5, appleY - appleRadius + 3, 6, 3.5, -0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(appleX - 5, appleY - 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const reset = useCallback(() => {
    snake.current = [{ x: 12, y: 12 }];
    dir.current = "RIGHT";
    nextDir.current = "RIGHT";
    food.current = newFood(snake.current);
    scoreRef.current = 0;
    setScore(0);
    setPaused(false);
    pausedRef.current = false;
    setStatus("playing");
  }, []);

  const handlePlayPause = useCallback(() => {
    if (status === "idle" || status === "dead") {
      reset();
      return;
    }
    setPaused(p => {
      pausedRef.current = !p;
      return !p;
    });
  }, [status, reset]);

  const setDirection = useCallback((d: Dir) => {
    const opposite: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
    if (d !== opposite[dir.current]) {
      nextDir.current = d;
    }
    holdStart.current = performance.now();
    holdDir.current = d;
    if (status === "idle" || status === "dead") {
      reset();
    }
  }, [reset, status]);

  const gameLoop = useCallback((ts: number) => {
    draw();

    if (!pausedRef.current) {
      const holdTimestamp = holdStart.current ?? touchHoldStart.current;
      const held = holdTimestamp !== null && (performance.now() - holdTimestamp) >= 1000;
      const speedFactor = held ? 0.55 : 1;
      const tick = Math.max(40, (TICK + snake.current.length * 5) * speedFactor);

      if (ts - lastTick.current > tick) {
        lastTick.current = ts;

        if (status === "playing") {
          dir.current = nextDir.current;
          const head = snake.current[0]!;
          const next: Point = {
            x: head.x + (dir.current === "RIGHT" ? 1 : dir.current === "LEFT" ? -1 : 0),
            y: head.y + (dir.current === "DOWN" ? 1 : dir.current === "UP" ? -1 : 0),
          };

          if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
            setStatus("dead");
            setBest(b => Math.max(b, scoreRef.current));
            animRef.current = requestAnimationFrame(gameLoop);
            return;
          }

          if (snake.current.some(s => s.x === next.x && s.y === next.y)) {
            setStatus("dead");
            setBest(b => Math.max(b, scoreRef.current));
            animRef.current = requestAnimationFrame(gameLoop);
            return;
          }

          snake.current = [next, ...snake.current];

          if (next.x === food.current.x && next.y === food.current.y) {
            scoreRef.current += 1;
            setScore(scoreRef.current);
            food.current = newFood(snake.current);
          } else {
            snake.current.pop();
          }
        }
      }
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, [status, draw]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
      w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") { handlePlayPause(); return; }
      if (status !== "playing") return;
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      setDirection(d);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const d = map[e.key];
      if (!d) return;
      if (holdDir.current === d) {
        holdStart.current = null;
        holdDir.current = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
      touchHoldStart.current = performance.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStartPoint.current) {
        touchHoldStart.current = null;
        return;
      }
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartPoint.current.x;
      const dy = touch.clientY - touchStartPoint.current.y;
      touchStartPoint.current = null;
      touchHoldStart.current = null;
      const minDistance = 24;
      if (Math.abs(dx) < minDistance && Math.abs(dy) < minDistance) {
        if (status === "idle" || status === "dead") reset();
        return;
      }
      const d: Dir = Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? "RIGHT" : "LEFT"
        : dy > 0 ? "DOWN" : "UP";
      setDirection(d);
    };

    const onTouchCancel = () => {
      touchStartPoint.current = null;
      touchHoldStart.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchCancel);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [reset, setDirection, handlePlayPause, status]);

  const instructionText = "Swipe or use Arrow keys to steer. Hold to accelerate.";

  const rules = (
    <div style={{ fontSize: 12, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {instructionText}
    </div>
  );

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Snake"
          score={score}
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best", value: best },
          ]}
          onPlayPause={handlePlayPause}
          paused={paused}
          onRestart={reset}
          rules={rules}
          actions={<GameAuth />}
        />
      }
    >
      <div style={{
        width: "100%",
        minHeight: "100%",
        background: "#0a0a0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Courier New', monospace",
        gap: 16,
        padding: 16,
        boxSizing: "border-box",
      }}>
        {/* Canvas */}
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(90vw, 760px)",
          aspectRatio: "1 / 1",
          maxHeight: "calc(100vh - 140px)",
          paddingInline: 12,
          boxSizing: "border-box",
        }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              border: "1px solid #1a2a1a",
              borderRadius: 4,
              boxShadow: "0 0 40px #00ffaa11",
              touchAction: "none",
            }}
          />

          {(status === "idle" || status === "dead" || paused) && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: "#0a0a0fcc",
              borderRadius: 4,
              gap: 12,
            }}>
              {status === "dead" && <div style={{ fontSize: 28, color: "#ff4466", letterSpacing: 4 }}>GAME OVER</div>}
              {status === "idle" && <div style={{ fontSize: 28, color: "#00ffaa", letterSpacing: 4 }}>SNAKE</div>}
              {paused && status === "playing" && <div style={{ fontSize: 28, color: "#00ffaa", letterSpacing: 4 }}>PAUSED</div>}
              <div style={{ fontSize: 12, color: "#334433", letterSpacing: 2 }}>
                {paused
                  ? "PRESS SPACE TO RESUME"
                  : `PRESS SPACE OR TAP TO ${status === "dead" ? "RESTART" : "START"}`}
              </div>
              {status === "dead" && <div style={{ fontSize: 13, color: "#e0ffe0" }}>Score: {score}</div>}
            </div>
          )}
        </div>

        <div style={{ width: "100%", textAlign: "center", fontSize: 12, color: "#334433", letterSpacing: 1.2, paddingInline: 12, boxSizing: "border-box" }}>
          {instructionText}
        </div>

        {/* Store link
        <a
          href="https://freegamestore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#334433", letterSpacing: 1, textDecoration: "none" }}
        >
          Built for freegamestore.online
        </a> */}
      </div>
    </GameShell>
  );
}
