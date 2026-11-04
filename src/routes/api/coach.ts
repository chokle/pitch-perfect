import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

type Feedback = { pace: "slow" | "good" | "fast"; tone: "good" | "flat" | "tense" | "unclear"; tip: string };

async function readResponsesText(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta;
      } catch {
        /* partial */
      }
    }
  }
  return text;
}

export const Route = createFileRoute("/api/coach")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "AI is not configured" }, { status: 500 });
        const form = await request.formData();
        const audio = form.get("audio");
        const seconds = Number(form.get("seconds") || 8);
        const targetWpm = Number(form.get("targetWpm") || 130);
        const expected = String(form.get("expected") || "").slice(0, 1200);
        if (!(audio instanceof File) || audio.size < 2000 || audio.size > 4_000_000) {
          return Response.json({ skip: true });
        }

        const stt = new FormData();
        stt.append("model", "openai/gpt-transcribe");
        stt.append("file", audio, "chunk.webm");
        stt.append("response_format", "json");
        const tr = await fetch(`${GATEWAY}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: stt,
        });
        if (!tr.ok) {
          const msg = (await tr.json().catch(() => null))?.message ?? "Transcription failed";
          return Response.json({ error: msg }, { status: tr.status });
        }
        const transcript: string = ((await tr.json()).text ?? "").trim();
        const words = transcript ? transcript.split(/\s+/).length : 0;
        if (words < 3) return Response.json({ skip: true, transcript });
        const wpm = Math.round((words / Math.max(1, seconds)) * 60);

        const res = await fetch(`${GATEWAY}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            instructions:
              "You are a live pitch-delivery coach. Judge the speaker's pace and tone from a short transcript snippet. Pace: compare measured WPM to target (±15% is good). Tone: flag 'flat' (monotone, filler words, hedging), 'tense' (rushed, choppy), 'unclear' (mumbled, words differ a lot from script), else 'good'. tip: one short spoken interruption, max 9 words, imperative (e.g. 'Slow down — let that number land.'). Empty tip if all good.",
            input: `Target WPM: ${targetWpm}\nMeasured WPM: ${wpm}\nScript they should be reading: ${expected}\nWhat they actually said: ${transcript}`,
            text: {
              format: {
                type: "json_schema",
                name: "feedback",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["pace", "tone", "tip"],
                  properties: {
                    pace: { type: "string", enum: ["slow", "good", "fast"] },
                    tone: { type: "string", enum: ["good", "flat", "tense", "unclear"] },
                    tip: { type: "string" },
                  },
                },
              },
            },
          }),
        });
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.message ?? "Coach unavailable";
          return Response.json({ error: msg }, { status: res.status });
        }
        let fb: Feedback;
        try {
          fb = JSON.parse(await readResponsesText(res));
        } catch {
          return Response.json({ skip: true });
        }
        return Response.json({ ...fb, wpm, transcript });
      },
    },
  },
});
