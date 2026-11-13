import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Upload, Trash2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePitchDeck } from "@/components/PitchDeckContext";
import { importSlides } from "@/lib/import-slides";
import { validSlideTimes } from "@/lib/deck-timeline";

export const Route = createFileRoute("/deck")({
  head: () => ({ meta: [
    { title: "Pitch deck — PitchPrompter" },
    { name: "description", content: "Upload your pitch slides and set slide cues for a synchronized teleprompter rehearsal." },
    { property: "og:title", content: "Pitch deck — PitchPrompter" },
    { property: "og:description", content: "Review your slides and sync each one to your pitch countdown." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DeckPage,
});

function DeckPage() {
  const { slides, setSlides } = usePitchDeck();
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const touchX = useRef(0);
  const current = slides[selected];
  const valid = validSlideTimes(slides);
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const imported = await importSlides(files);
      setSlides(imported); setSelected(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open this deck."); }
    finally { setBusy(false); }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild title="Back to script"><Link to="/"><ArrowLeft /></Link></Button>
          <div><h1 className="font-display text-xl font-semibold">Pitch deck</h1><p className="text-xs text-muted-foreground">PitchPrompter</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}><Upload />{busy ? "Opening slides…" : slides.length ? "Replace deck" : "Upload slides"}</Button>
          <Button asChild disabled={!valid}><Link to="/">Script <ArrowRight /></Link></Button>
        </div>
        <input ref={inputRef} aria-label="Upload pitch slides" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">
        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
        {!slides.length ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 border border-dashed border-border px-6 text-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) void upload(Array.from(e.dataTransfer.files)); }}>
            <Presentation className="h-12 w-12 text-primary" />
            <h2 className="font-display text-2xl font-semibold">Your pitch, slide by slide</h2>
            <p className="max-w-md text-sm text-muted-foreground">PDF decks or PNG, JPG and WebP images.<br />For PowerPoint or Keynote, export your deck as PDF.</p>
            <Button disabled={busy} onClick={() => inputRef.current?.click()}><Upload />{busy ? "Opening slides…" : "Choose slides"}</Button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="order-2 lg:order-1">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Slide cues · seconds</h2><span className="text-xs text-muted-foreground">{slides.length} slides</span></div>
              {!valid && <p role="alert" className="mb-3 text-sm text-destructive">Start at 0, then use increasing cue times.</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {slides.map((slide, index) => (
                  <div key={slide.id} className={`min-w-0 rounded-md border p-2 ${selected === index ? "border-primary" : "border-border"}`}>
                    <Button variant="ghost" className="h-auto w-full p-0" onClick={() => setSelected(index)} aria-label={`Preview slide ${index + 1}`}><img src={slide.src} alt={`Slide ${index + 1}`} className="aspect-video w-full object-contain" /></Button>
                    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs font-medium">Slide {index + 1}</span><label className="flex items-center gap-1 text-xs text-muted-foreground"><input aria-label={`Slide ${index + 1} start seconds`} type="number" min="0" step="1" disabled={index === 0} value={slide.start} className="w-16 rounded border border-input bg-background px-2 py-1 text-foreground" onChange={(e) => setSlides(slides.map((s, i) => i === index ? { ...s, start: Number(e.target.value) } : s))} />s</label></div>
                  </div>
                ))}
              </div>
            </aside>
            <section className="order-1 min-w-0 lg:order-2">
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted" onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? 0; }} onTouchEnd={(e) => { const delta = (e.changedTouches[0]?.clientX ?? 0) - touchX.current; if (Math.abs(delta) > 45) setSelected((i) => Math.max(0, Math.min(slides.length - 1, i + (delta < 0 ? 1 : -1)))); }}>
                {current && <img src={current.src} alt={`Pitch slide ${selected + 1}`} className="h-full w-full object-contain" />}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button variant="outline" size="icon" title="Previous slide" disabled={selected === 0} onClick={() => setSelected(selected - 1)}><ChevronLeft /></Button>
                <span className="text-sm text-muted-foreground">{selected + 1} / {slides.length} · {current?.start}s</span>
                <Button variant="outline" size="icon" title="Next slide" disabled={selected === slides.length - 1} onClick={() => setSelected(selected + 1)}><ChevronRight /></Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Deck stays available until you refresh or close this tab.</p><Button variant="ghost" onClick={() => { setSlides([]); setSelected(0); }}><Trash2 />Remove deck</Button></div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}