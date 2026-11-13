import type { PitchSlide } from "./deck-timeline";

const W = 1280;
const H = 720;

const SLIDES: { title: string; body: string[]; start: number }[] = [
  { title: "Northwind", body: ["Prep smarter. Waste less.", "Demand forecasting for independent restaurants"], start: 0 },
  { title: "The problem", body: ["Billions of dollars of food are thrown away every year", "Demand prediction is still guesswork"], start: 15 },
  { title: "The solution", body: ["Learns each restaurant's rhythm", "Weather · local events · seasonality", "Tells chefs exactly how much to prep"], start: 30 },
  { title: "Traction", body: ["12 pilot restaurants", "40% less food waste in 8 weeks", "Live in 3 cities"], start: 45 },
  { title: "The ask", body: ["Raising $2M", "Bring Northwind to every independent restaurant"], start: 60 },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws a small neutral demo deck in the browser, so no files are needed. */
export function createSampleDeck(): PitchSlide[] {
  return SLIDES.map((slide, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { id: crypto.randomUUID(), name: `Sample ${index + 1}`, src: "", start: slide.start };
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, 14, H);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 76px Inter, system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(slide.title, 90, 110);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "400 42px Inter, system-ui, sans-serif";
    let y = 250;
    for (const item of slide.body) {
      for (const line of wrap(ctx, item, W - 180)) {
        ctx.fillText(line, 90, y);
        y += 62;
      }
      y += 22;
    }
    ctx.fillStyle = "#475569";
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillText("SAMPLE DECK", 90, H - 70);
    ctx.textAlign = "right";
    ctx.fillText(`${index + 1} / ${SLIDES.length}`, W - 70, H - 70);
    return {
      id: crypto.randomUUID(),
      name: `Sample ${index + 1}`,
      src: canvas.toDataURL("image/jpeg", 0.9),
      start: slide.start,
    };
  });
}
