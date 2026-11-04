import { useEffect, useRef, useState } from "react";
import { Bot, Lock, X } from "lucide-react";

const WINDOW_MS = 8000;
const TRIAL_SECONDS = 60;
const TRIAL_KEY = "pitchprompter-coach-trial-used";

export type CoachTip = { pace: string; tone: string; tip: string; wpm: number; at: number };

/** Records short mic windows while active+playing and asks the server for pace/tone feedback. */
export function useAiCoach(opts: {
  active: boolean;
  playing: boolean;
  targetWpm: number;
  getExpected: () => string;
  onTrialEnd: () => void;
  trial: boolean;
}) {
  const [tip, setTip] = useState<CoachTip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const run = opts.active && opts.playing;

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rec: MediaRecorder | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const cycle = () => {
      if (cancelled || !stream) return;
      const chunks: Blob[] = [];
      const began = Date.now();
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        const secs = (Date.now() - began) / 1000;
        if (!cancelled) cycle();
        const blob = new Blob(chunks, { type: rec?.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("audio", new File([blob], "chunk.webm", { type: blob.type.split(";")[0] || "audio/webm" }));
        fd.append("seconds", String(secs));
        fd.append("targetWpm", String(optsRef.current.targetWpm));
        fd.append("expected", optsRef.current.getExpected());
        try {
          const r = await fetch("/api/coach", { method: "POST", body: fd });
          const j = await r.json();
          if (!r.ok) {
            setError(j.error || "Coach unavailable");
            return;
          }
          setError(null);
          if (j.skip || cancelled) return;
          const t: CoachTip = { ...j, at: Date.now() };
          setTip(t);
          if (t.tip && "speechSynthesis" in window) {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(t.tip);
            u.rate = 1.1;
            u.volume = 0.8;
            speechSynthesis.speak(u);
          }
        } catch {
          setError("Coach connection lost");
        }
      };
      rec.start();
      timer = setTimeout(() => {
        if (optsRef.current.trial && Date.now() - startedAt > TRIAL_SECONDS * 1000) {
          localStorage.setItem(TRIAL_KEY, "1");
          cancelled = true;
          optsRef.current.onTrialEnd();
        }
        if (rec?.state === "recording") rec.stop();
      }, WINDOW_MS);
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setListening(true);
        cycle();
      })
      .catch(() => setError("Microphone access is needed for the coach."));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
      setListening(false);
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [run]);

  return { tip, error, listening };
}

export const coachTrialUsed = () =>
  typeof window !== "undefined" && localStorage.getItem(TRIAL_KEY) === "1";

export function CoachPaywall({
  onClose,
  onTrial,
  trialUsed,
}: {
  onClose: () => void;
  onTrial: () => void;
  trialUsed: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl font-semibold">AI Coach · Pro</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A live coach listens while you read and interrupts when you rush, drag, or go flat — so you
          walk in sounding sharp.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li>• Live pace check against your target words-per-minute</li>
          <li>• Tone alerts for monotone, filler words and tension</li>
          <li>• Short spoken cues + on-screen nudges</li>
          <li>• Turn it on only when you want — normal rehearsing stays free</li>
        </ul>
        <button
          disabled
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground opacity-60"
        >
          <Lock className="h-4 w-4" /> Subscribe — coming soon
        </button>
        <button
          onClick={onTrial}
          disabled={trialUsed}
          className="mt-2 w-full rounded-lg border border-border py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {trialUsed ? "Free trial used" : `Try it free for ${TRIAL_SECONDS} seconds`}
        </button>
      </div>
    </div>
  );
}
