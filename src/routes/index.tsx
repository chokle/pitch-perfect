import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Upload,
  FlipHorizontal2,
  FlipVertical2,
  Maximize,
  Minimize,
  X,
  RotateCcw,
  Gauge,
  Type,
  MoveHorizontal,
  Timer,
  FileText,
  Sparkles,
  Lock,
  LockOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchPrompter — Drop in your pitch, hit play" },
      {
        name: "description",
        content:
          "A free teleprompter for your pitch: paste your script, adjust speed and type, mirror for prompter glass, and present in fullscreen.",
      },
      { property: "og:title", content: "PitchPrompter — Drop in your pitch, hit play" },
      {
        property: "og:description",
        content:
          "A free teleprompter for your pitch: paste your script, adjust speed and type, mirror for prompter glass, and present in fullscreen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/* ---------------------------------- data ---------------------------------- */

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Elevator pitch",
    text: `Hi, I'm Alex, and I want to tell you about Northwind.

Every year, small restaurants throw away billions of dollars of food — not because they want to, but because predicting demand is basically guesswork.

Northwind changes that. Our software learns each restaurant's rhythm — weather, local events, seasonality — and tells chefs exactly how much to prep, every single day.

In our pilot program, twelve restaurants cut food waste by forty percent in eight weeks. That's real money back in their pockets, and real food out of landfills.

We've raised a small pre-seed round, we're live in three cities, and today we're raising two million dollars to bring Northwind to every independent restaurant in the country.

Thank you. I'd love to take your questions.`,
  },
  {
    label: "Investor intro",
    text: `Thank you for having me today.

Over the next few minutes, I'll walk you through three things: the problem we've obsessed over for two years, the product our customers already love, and the plan to turn early traction into a category-defining company.

Let's start with the problem.

Today, frontline workers still coordinate with paper schedules, group texts, and sticky notes. The result is chaos: missed shifts, overtime overruns, and managers spending ten hours a week on scheduling alone.

Our product replaces all of that with a single app. Schedules publish in seconds. Swaps happen with one tap. And managers get their evenings back.

Sixty thousand workers use us every day, retention is ninety-four percent, and revenue has tripled year over year.

Now let me show you where we're going next.`,
  },
  {
    label: "Product demo talk",
    text: `Welcome, everyone. Let's jump straight into the demo.

Here on my screen is the dashboard your team will see every morning. Everything that matters — today's numbers, open tasks, and anything that needs your attention — is right here, front and center.

Watch what happens when I create a new project. One click, a name, and we're off. No setup wizard. No ten-step onboarding. It just works.

Now, the part our users love most: automation. I'll set a rule — when a task is approved, notify the client automatically. Done. That rule just saved someone on your team twenty minutes a day, forever.

Everything you've seen today is available in the free tier. You can sign up before this call ends.

Let's open it up for questions.`,
  },
];

type ThemeKey = "dark" | "light" | "contrast" | "studio";

const THEMES: Record<
  ThemeKey,
  { label: string; bg: string; fg: string; dim: string; accent: string }
> = {
  dark: { label: "Dark", bg: "#0b0b0d", fg: "#f4f4f5", dim: "#71717a", accent: "#4ade80" },
  light: { label: "Light", bg: "#fafafa", fg: "#111113", dim: "#a1a1aa", accent: "#16a34a" },
  contrast: { label: "Hi-Contrast", bg: "#000000", fg: "#fde047", dim: "#a16207", accent: "#fde047" },
  studio: { label: "Studio", bg: "#050d1a", fg: "#bae6fd", dim: "#38618c", accent: "#38bdf8" },
};

type ThresholdUnit = "sec" | "pct";
type AlertMode = "visual" | "sound" | "both";

interface Settings {
  speed: number; // 1-10
  fontSize: number; // px
  margin: number; // % side margin
  theme: ThemeKey;
  mirrorH: boolean;
  mirrorV: boolean;
  eyeLine: boolean;
  wpm: number;
  targetTime: number; // seconds, 0 = off
  timeLocked: boolean;
  thresholdUnit: ThresholdUnit;
  warnAt: number; // remaining seconds (or % of target) for first cue
  finalAt: number; // remaining seconds (or %) for final cue
  alertMode: AlertMode;
}

const DEFAULT_SETTINGS: Settings = {
  speed: 4,
  fontSize: 56,
  margin: 18,
  theme: "dark",
  mirrorH: false,
  mirrorV: false,
  eyeLine: true,
  wpm: 130,
  targetTime: 0,
  timeLocked: false,
  thresholdUnit: "sec",
  warnAt: 30,
  finalAt: 10,
  alertMode: "both",
};

/* ---------------------------- audio alert cues ---------------------------- */

let audioCtx: AudioContext | null = null;

function playBeeps(count: number, freq: number) {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx;
    for (let i = 0; i < count; i++) {
      const start = ctx.currentTime + i * 0.24;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    /* audio unavailable — visual cues still apply */
  }
}

const SETTINGS_KEY = "pitchprompter-settings";
const SCRIPT_KEY = "pitchprompter-script";

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Accepts "90", "1:30", "2:05" and returns total seconds (0 when invalid). */
function parseTimeInput(value: string): number {
  const v = value.trim();
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Number(v);
  const m = v.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return 0;
}

/* ---------------------------------- app ----------------------------------- */

function Index() {
  const [script, setScript] = useState<string>("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<"edit" | "prompt">("edit");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setScript(localStorage.getItem(SCRIPT_KEY) ?? "");
    setSettings(loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SCRIPT_KEY, script);
  }, [script, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  const words = useMemo(() => countWords(script), [script]);

  if (!hydrated) return null;

  if (mode === "prompt") {
    return (
      <Prompter
        script={script}
        settings={settings}
        onSettings={setSettings}
        onExit={() => setMode("edit")}
      />
    );
  }

  return (
    <Editor
      script={script}
      onScript={setScript}
      words={words}
      onStart={() => setMode("prompt")}
    />
  );
}

/* --------------------------------- editor --------------------------------- */

function Editor({
  script,
  onScript,
  words,
  onStart,
}: {
  script: string;
  onScript: (s: string) => void;
  words: number;
  onStart: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onScript(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight">
              PitchPrompter
            </h1>
            <p className="text-xs text-muted-foreground">
              Drop in your pitch. Hit play. Nail the delivery.
            </p>
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={words === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          Start prompting
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Try a sample
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => onScript(s.text)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-card-foreground transition-colors hover:bg-accent"
            >
              {s.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-card-foreground transition-colors hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5" /> Upload .txt
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,text/plain"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <textarea
          value={script}
          onChange={(e) => onScript(e.target.value)}
          placeholder="Paste or type your pitch here…

Tip: short paragraphs read best on a prompter. Add a blank line wherever you want to breathe."
          className="min-h-[50vh] w-full flex-1 resize-y rounded-xl border border-border bg-card p-6 font-mono text-base leading-relaxed text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{words}</strong> words
          </span>
          <span>
            ≈ <strong className="text-foreground">{formatTime((words / 130) * 60)}</strong>{" "}
            at 130 wpm
          </span>
          <span className="ml-auto hidden text-xs sm:block">
            In the prompter: Space = play/pause · ↑ ↓ = speed · Esc = exit
          </span>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------- prompter -------------------------------- */

function Prompter({
  script,
  settings,
  onSettings,
  onExit,
}: {
  script: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onExit: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const playingRef = useRef(false);
  const settingsRef = useRef(settings);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  settingsRef.current = settings;
  playingRef.current = playing;

  const theme = THEMES[settings.theme];
  const words = useMemo(() => countWords(script), [script]);
  const estimatedTotal = (words / settings.wpm) * 60;

  const pxPerSecond = 15 + settings.speed * settings.speed * 4;

  /* countdown thresholds, resolved to seconds remaining */
  const hasTarget = settings.targetTime > 0;
  const remaining = settings.targetTime - elapsed;
  const toSeconds = (v: number) =>
    settings.thresholdUnit === "pct" ? (settings.targetTime * v) / 100 : v;
  const warnSec = Math.max(0, toSeconds(settings.warnAt));
  const finalSec = Math.min(Math.max(0, toSeconds(settings.finalAt)), warnSec);

  const stage: "none" | "warn" | "final" | "over" = !hasTarget
    ? "none"
    : remaining < 0
      ? "over"
      : remaining <= finalSec
        ? "final"
        : remaining <= warnSec
          ? "warn"
          : "none";

  const visualAlerts = settings.alertMode !== "sound";
  const soundAlerts = settings.alertMode !== "visual";

  /* fire audio cues on stage changes — only while running, so pausing freezes them */
  const lastStageRef = useRef(stage);
  useEffect(() => {
    const prev = lastStageRef.current;
    if (stage === prev) return;
    lastStageRef.current = stage;
    if (!playing || !soundAlerts) return;
    if (stage === "warn") playBeeps(1, 660);
    else if (stage === "final") playBeeps(2, 880);
    else if (stage === "over") playBeeps(3, 440);
  }, [stage, playing, soundAlerts]);

  /* rAF scroll loop */
  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = performance.now();
    const tick = (ts: number) => {
      const dt = Math.min(0.1, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      const el = scrollRef.current;
      if (el) {
        el.scrollTop += pxPerSecond * dt;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          setPlaying(false);
          return;
        }
      }
      setElapsed((e) => e + dt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, pxPerSecond]);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        onSettings({
          ...settingsRef.current,
          speed: Math.min(10, settingsRef.current.speed + 1),
        });
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        onSettings({
          ...settingsRef.current,
          speed: Math.max(1, settingsRef.current.speed - 1),
        });
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        onExit();
      } else if (e.key === "r" || e.key === "R") {
        scrollRef.current?.scrollTo({ top: 0 });
        setElapsed(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettings, onExit]);

  /* fullscreen tracking */
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  /* auto-hide controls while playing */
  useEffect(() => {
    const poke = () => {
      setShowControls(true);
      clearTimeout(hideTimerRef.current);
      if (playingRef.current) {
        hideTimerRef.current = setTimeout(() => setShowControls(false), 2200);
      }
    };
    poke();
    window.addEventListener("mousemove", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  const [progress, setProgress] = useState(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
  };

  const reset = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setElapsed(0);
  };

  const upd = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch });

  const flipTransform = `${settings.mirrorH ? "scaleX(-1)" : ""} ${settings.mirrorV ? "scaleY(-1)" : ""}`.trim();

  return (
    <div
      className="fixed inset-0 flex flex-col select-none"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-1" style={{ backgroundColor: theme.dim + "33" }}>
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress * 100}%`, backgroundColor: theme.accent }}
        />
      </div>

      {/* overtime banner */}
      {stage === "over" && visualAlerts && (
        <div className="pointer-events-none absolute inset-x-0 top-1 z-30 flex justify-center">
          <div
            className={cn(
              "rounded-b-lg px-6 py-2 font-mono text-sm font-bold tracking-widest",
              playing && "animate-pulse"
            )}
            style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
          >
            OVERTIME +{formatTime(-remaining)}
          </div>
        </div>
      )}

      {/* time-remaining pill (top corner, visible even when controls hide) */}
      {hasTarget && stage !== "over" && (
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
          {!playing && (
            <div
              className="rounded-full px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: theme.dim + "22", color: theme.dim }}
            >
              Paused
            </div>
          )}
          <div
            className={cn(
              "rounded-full px-4 py-1.5 font-mono text-sm font-bold",
              visualAlerts && stage === "final" && playing && "animate-pulse"
            )}
            style={{
              backgroundColor: theme.dim + "22",
              color: !visualAlerts
                ? theme.fg
                : stage === "final"
                  ? "#f87171"
                  : stage === "warn"
                    ? "#fbbf24"
                    : theme.fg,
              border: `1px solid ${
                visualAlerts && stage === "final"
                  ? "#f87171aa"
                  : visualAlerts && stage === "warn"
                    ? "#fbbf2488"
                    : theme.dim + "44"
              }`,
            }}
          >
            -{formatTime(remaining)}
          </div>
        </div>
      )}

      {/* scrolling script */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onClick={() => setPlaying((p) => !p)}
        className="flex-1 cursor-pointer overflow-y-auto"
        style={{ scrollbarWidth: "none", transform: flipTransform || undefined }}
      >
        <div
          className="mx-auto font-display font-medium"
          style={{
            maxWidth: `${100 - settings.margin * 2}%`,
            fontSize: `${settings.fontSize}px`,
            lineHeight: 1.45,
            paddingTop: "45vh",
            paddingBottom: "70vh",
            whiteSpace: "pre-wrap",
            letterSpacing: "0.01em",
          }}
        >
          {script}
        </div>
      </div>

      {/* eye-line indicator */}
      {settings.eyeLine && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20"
          style={{ top: "38%" }}
        >
          <div className="flex items-center justify-between px-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "10px solid transparent",
                  borderBottom: "10px solid transparent",
                  [i === 0 ? "borderLeft" : "borderRight"]: `14px solid ${theme.accent}`,
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
          <div
            className="mx-6 border-t border-dashed"
            style={{ borderColor: theme.accent + "55" }}
          />
        </div>
      )}

      {/* controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{
          background: `linear-gradient(to top, ${theme.bg}f2 55%, transparent)`,
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 pb-5 pt-10">
          {/* transport row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex h-12 w-12 items-center justify-center rounded-full font-semibold"
              style={{ backgroundColor: theme.accent, color: theme.bg }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button
              onClick={reset}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: theme.dim + "66", color: theme.fg }}
              aria-label="Back to start (R)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {(() => {
              const over = stage === "over";
              const alerting = visualAlerts && (stage === "warn" || stage === "final");
              const chipColor = !visualAlerts
                ? theme.accent
                : over || stage === "final"
                  ? "#f87171"
                  : stage === "warn"
                    ? "#fbbf24"
                    : theme.accent;
              return (
                <div
                  className={cn(
                    "ml-2 flex items-center gap-2 rounded-full px-4 py-2 font-mono text-sm",
                    over && visualAlerts && playing && "animate-pulse"
                  )}
                  style={{
                    backgroundColor: over && visualAlerts ? "#f8717126" : theme.dim + "22",
                    color: theme.fg,
                    border:
                      over && visualAlerts
                        ? "1px solid #f87171"
                        : alerting
                          ? `1px solid ${chipColor}88`
                          : "1px solid transparent",
                  }}
                >
                  {hasTarget && settings.timeLocked && (
                    <Lock className="h-3.5 w-3.5" style={{ color: chipColor }} />
                  )}
                  <Timer className="h-4 w-4" style={{ color: chipColor }} />
                  <span>{formatTime(elapsed)}</span>
                  {hasTarget ? (
                    <>
                      <span style={{ color: theme.dim }}>/</span>
                      <span style={{ color: chipColor, fontWeight: 700 }}>
                        {over ? `+${formatTime(-remaining)} over` : `-${formatTime(remaining)}`}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: theme.dim }}>/ ~{formatTime(estimatedTotal)}</span>
                  )}
                  {!playing && (
                    <span className="text-xs uppercase tracking-wider" style={{ color: theme.dim }}>
                      paused
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="flex-1" />

            <button
              onClick={toggleFullscreen}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: theme.dim + "66", color: theme.fg }}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                onExit();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: theme.dim + "66", color: theme.fg }}
              aria-label="Exit prompter (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* settings row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs" style={{ color: theme.dim }}>
            <label className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              <span className="font-medium">Speed {settings.speed}</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={settings.speed}
                onChange={(e) => upd({ speed: Number(e.target.value) })}
                className="w-24 accent-current"
                style={{ color: theme.accent }}
              />
            </label>
            <label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <span className="font-medium">{settings.fontSize}px</span>
              <input
                type="range"
                min={24}
                max={110}
                step={2}
                value={settings.fontSize}
                onChange={(e) => upd({ fontSize: Number(e.target.value) })}
                className="w-24 accent-current"
                style={{ color: theme.accent }}
              />
            </label>
            <label className="flex items-center gap-2">
              <MoveHorizontal className="h-4 w-4" />
              <span className="font-medium">Margins</span>
              <input
                type="range"
                min={2}
                max={35}
                step={1}
                value={settings.margin}
                onChange={(e) => upd({ margin: Number(e.target.value) })}
                className="w-24 accent-current"
                style={{ color: theme.accent }}
              />
            </label>

            <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: theme.dim + "55" }} />

            <button
              onClick={() => upd({ mirrorH: !settings.mirrorH })}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium"
              style={{
                borderColor: settings.mirrorH ? theme.accent : theme.dim + "66",
                color: settings.mirrorH ? theme.accent : theme.fg,
              }}
            >
              <FlipHorizontal2 className="h-3.5 w-3.5" /> Flip H
            </button>
            <button
              onClick={() => upd({ mirrorV: !settings.mirrorV })}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium"
              style={{
                borderColor: settings.mirrorV ? theme.accent : theme.dim + "66",
                color: settings.mirrorV ? theme.accent : theme.fg,
              }}
            >
              <FlipVertical2 className="h-3.5 w-3.5" /> Flip V
            </button>
            <button
              onClick={() => upd({ eyeLine: !settings.eyeLine })}
              className="rounded-full border px-3 py-1.5 font-medium"
              style={{
                borderColor: settings.eyeLine ? theme.accent : theme.dim + "66",
                color: settings.eyeLine ? theme.accent : theme.fg,
              }}
            >
              Eye-line
            </button>

            <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: theme.dim + "55" }} />

            <div className="flex items-center gap-1.5">
              {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => upd({ theme: k })}
                  title={THEMES[k].label}
                  className="h-6 w-6 rounded-full border-2"
                  style={{
                    backgroundColor: THEMES[k].bg,
                    borderColor: settings.theme === k ? theme.accent : theme.dim + "55",
                    boxShadow:
                      settings.theme === k ? `0 0 0 2px ${theme.bg}, 0 0 0 4px ${theme.accent}` : undefined,
                  }}
                />
              ))}
            </div>

            <label className="flex items-center gap-2">
              <span className="font-medium">WPM</span>
              <input
                type="number"
                min={60}
                max={260}
                step={5}
                value={settings.wpm}
                onChange={(e) => upd({ wpm: Math.max(40, Number(e.target.value) || 130) })}
                className="w-16 rounded border bg-transparent px-1.5 py-1 font-mono"
                style={{ borderColor: theme.dim + "66", color: theme.fg }}
              />
            </label>

            <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: theme.dim + "55" }} />

            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <span className="font-medium">Pitch time</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="mm:ss"
                disabled={settings.timeLocked}
                key={settings.timeLocked ? `locked-${settings.targetTime}` : "unlocked"}
                defaultValue={settings.targetTime > 0 ? formatTime(settings.targetTime) : ""}
                onBlur={(e) => upd({ targetTime: parseTimeInput(e.target.value) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-16 rounded border bg-transparent px-1.5 py-1 font-mono disabled:opacity-60"
                style={{ borderColor: settings.timeLocked ? theme.accent : theme.dim + "66", color: theme.fg }}
                title="Seconds or mm:ss, e.g. 90 or 1:30"
              />
              <button
                onClick={() => upd({ timeLocked: !settings.timeLocked })}
                disabled={!settings.timeLocked && settings.targetTime <= 0}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: settings.timeLocked ? theme.accent : theme.dim + "66",
                  color: settings.timeLocked ? theme.accent : theme.fg,
                }}
                title={settings.timeLocked ? "Unlock pitch time" : "Lock pitch time"}
              >
                {settings.timeLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Locked
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5" /> Lock
                  </>
                )}
              </button>
            </div>

            <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: theme.dim + "55" }} />

            {/* countdown warning thresholds */}
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-medium">Warn at</span>
              <input
                type="number"
                min={0}
                step={settings.thresholdUnit === "pct" ? 1 : 5}
                value={settings.warnAt}
                onChange={(e) => upd({ warnAt: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded border bg-transparent px-1.5 py-1 font-mono"
                style={{ borderColor: theme.dim + "66", color: theme.fg }}
                title="First warning cue, by time remaining"
              />
              <span className="font-medium">then</span>
              <input
                type="number"
                min={0}
                step={settings.thresholdUnit === "pct" ? 1 : 5}
                value={settings.finalAt}
                onChange={(e) => upd({ finalAt: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded border bg-transparent px-1.5 py-1 font-mono"
                style={{ borderColor: theme.dim + "66", color: theme.fg }}
                title="Final warning cue, by time remaining"
              />
              <div className="flex items-center gap-1">
                {(["sec", "pct"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => upd({ thresholdUnit: u })}
                    className="rounded-full border px-2.5 py-1 font-medium"
                    style={{
                      borderColor: settings.thresholdUnit === u ? theme.accent : theme.dim + "66",
                      color: settings.thresholdUnit === u ? theme.accent : theme.fg,
                    }}
                  >
                    {u === "sec" ? "sec left" : "% left"}
                  </button>
                ))}
              </div>
              {[30, 15, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => upd({ thresholdUnit: "sec", warnAt: s, finalAt: Math.round(s / 3) })}
                  className="rounded-full border px-2.5 py-1 font-medium"
                  style={{ borderColor: theme.dim + "44", color: theme.dim }}
                  title={`Warn at ${s}s left`}
                >
                  {s}s
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-medium">Alerts</span>
              {(
                [
                  { k: "visual", label: "Visual", Icon: Eye },
                  { k: "sound", label: "Sound", Icon: Volume2 },
                  { k: "both", label: "Both", Icon: Bell },
                ] as const
              ).map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => {
                    upd({ alertMode: k });
                    if (k !== "visual") playBeeps(1, 880);
                  }}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium"
                  style={{
                    borderColor: settings.alertMode === k ? theme.accent : theme.dim + "66",
                    color: settings.alertMode === k ? theme.accent : theme.fg,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
