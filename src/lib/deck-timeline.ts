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