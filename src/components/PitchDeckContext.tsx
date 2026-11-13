import { createContext, useContext, useState, type ReactNode } from "react";
import type { PitchSlide } from "@/lib/deck-timeline";

const DeckContext = createContext<{
  slides: PitchSlide[];
  setSlides: (slides: PitchSlide[]) => void;
} | null>(null);

export function PitchDeckProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<PitchSlide[]>([]);
  return <DeckContext.Provider value={{ slides, setSlides }}>{children}</DeckContext.Provider>;
}

export function usePitchDeck() {
  const value = useContext(DeckContext);
  if (!value) throw new Error("PitchDeckProvider is missing");
  return value;
}