export type PitchSlide = { id: string; name: string; src: string; start: number };

export function deckDuration(slides: PitchSlide[], finalSlideSeconds = 15): number {
  if (!slides.length || !validSlideTimes(slides) || !Number.isFinite(finalSlideSeconds) || finalSlideSeconds <= 0) return 0;
  return (slides[slides.length - 1]?.start ?? 0) + finalSlideSeconds;
}

export function slideAtTime(slides: PitchSlide[], seconds: number): number {
  let index = 0;
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide && slide.start <= seconds) index = i;
  }
  return index;
}

export function validSlideTimes(slides: PitchSlide[]): boolean {
  return slides.every((slide, i) => Number.isFinite(slide.start) &&
    (i === 0 ? slide.start === 0 : slide.start > (slides[i - 1]?.start ?? Infinity)));
}
export type PitchTimeLock = { targetTime: number; timeLocked: boolean; deckLocked?: boolean };

/** Applies deck timing to the countdown; releases only locks the deck itself set. */
export function syncDeckTimeLock<T extends PitchTimeLock>(settings: T, totalTime: number): T {
  if (totalTime > 0) return { ...settings, targetTime: totalTime, timeLocked: true, deckLocked: true };
  if (!settings.deckLocked) return settings;
  return { ...settings, targetTime: 0, timeLocked: false, deckLocked: false };
}

/** Maps reading progress (0–1 through the script) onto slide cues, scaled to the deck's planned length. */
export function slideAtProgress(slides: PitchSlide[], progress: number, finalSlideSeconds = 15): number {
  const total = deckDuration(slides, finalSlideSeconds);
  if (!total) return 0;
  return slideAtTime(slides, Math.min(1, Math.max(0, progress)) * total);
}
