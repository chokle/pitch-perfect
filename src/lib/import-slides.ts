import type { PitchSlide } from "./deck-timeline";

export async function importSlides(files: File[]): Promise<PitchSlide[]> {
  const slides: PitchSlide[] = [];
  for (const file of files) {
    if (file.size > 40 * 1024 * 1024) throw new Error("Each file must be smaller than 40 MB.");
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist");
      const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      try {
        if (pdf.numPages + slides.length > 60) throw new Error("Upload up to 60 slides at a time.");
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const initial = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2, 1920 / initial.width) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          slides.push({ id: crypto.randomUUID(), name: `${file.name} · ${n}`, src: canvas.toDataURL("image/jpeg", 0.9), start: slides.length * 15 });
          page.cleanup();
        }
      } finally { await pdf.destroy(); }
    } else if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this slide image."));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = src;
      await image.decode();
      slides.push({ id: crypto.randomUUID(), name: file.name, src, start: slides.length * 15 });
    } else throw new Error("Use a PDF deck or PNG, JPG, or WebP slides. Export PowerPoint or Keynote as PDF first.");
    if (slides.length > 60) throw new Error("Upload up to 60 slides at a time.");
  }
  return slides;
}