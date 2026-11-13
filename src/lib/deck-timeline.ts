export type PitchSlide = { id: string; name: string; src: string; start: number };

export function slideAtTime(slides: PitchSlide[], seconds: number): number {
  let index = 0;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].start <= seconds) index = i;
  }
  return index;
}

export function validSlideTimes(slides: PitchSlide[]): boolean {
  return slides.every((slide, i) => Number.isFinite(slide.start) &&
    (i === 0 ? slide.start === 0 : slide.start > slides[i - 1].start));
}