import { createContext, useContext, useState, type ReactNode } from "react";
import { deckDuration, type PitchSlide } from "@/lib/deck-timeline";

const DeckContext = createContext<{
  slides: PitchSlide[];
  setSlides: (slides: PitchSlide[]) => void;
  finalSlideSeconds: number;
  setFinalSlideSeconds: (seconds: number) => void;
  totalTime: number;
} | null>(null);

export function PitchDeckProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<PitchSlide[]>([]);
  const [finalSlideSeconds, setFinalSlideSeconds] = useState(15);
  const totalTime = deckDuration(slides, finalSlideSeconds);
  return <DeckContext.Provider value={{ slides, setSlides, finalSlideSeconds, setFinalSlideSeconds, totalTime }}>{children}</DeckContext.Provider>;
}

export function usePitchDeck() {
  const value = useContext(DeckContext);
  if (!value) throw new Error("PitchDeckProvider is missing");
  return value;
}