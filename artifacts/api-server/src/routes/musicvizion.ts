import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  CreateCompanionReplyBody,
  CreateCompanionReplyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const connectors = new ReplitConnectors();

type LanguageModel = {
  id?: string;
  name?: string;
  input_modalities?: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function extractReply(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => asRecord(part)?.text)
      .filter((part): part is string => typeof part === "string")
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

router.post("/musicvizion/companion", async (req, res): Promise<void> => {
  const parsed = CreateCompanionReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const catalogResponse = await connectors.proxy(
      "xai",
      "/v1/language-models",
      { method: "GET" },
    );
    if (!catalogResponse.ok) {
      req.log.warn(
        { status: catalogResponse.status },
        "Could not load xAI model catalog",
      );
      res.status(502).json({ error: "Grok is unavailable right now." });
      return;
    }

    const catalog = asRecord(await catalogResponse.json());
    const models = Array.isArray(catalog?.models)
      ? (catalog.models as LanguageModel[])
      : [];
    const model = models.find(
      (candidate) =>
        typeof candidate.id === "string" &&
        candidate.id.toLowerCase().includes("grok") &&
        (!candidate.input_modalities ||
          candidate.input_modalities.some((modality) =>
            modality.toLowerCase().includes("text"),
          )),
    );
    if (!model?.id) {
      req.log.warn("No text-capable Grok model was returned by xAI");
      res.status(502).json({ error: "No Grok text model is available." });
      return;
    }

    const { title, artist, userMessage, positionSeconds, analysis, preferences } =
      parsed.data;
    const context = {
      track: `${title} — ${artist}`,
      playbackPositionSeconds: Math.round(positionSeconds),
      measuredAudio: analysis,
      companionPreferences: preferences,
      listenerComment: userMessage,
    };
    const system = [
      "You are MusicVizion, a thoughtful music-listening companion.",
      "Respond to the listener's question with warmth, curiosity, and specific musical reasoning. Be vivid when appreciating sound, but do not claim to have human consciousness or literal feelings.",
      "You have not directly heard the song. You only receive the supplied title, playback position, audio-analysis measurements, listener comment, and preference notes. Never imply otherwise.",
      "Treat browser measurements as rough clues, not definitive transcription. Do not invent lyrics, artist facts, chart positions, stream counts, or historical influence.",
      "If comparing musical history, frame it as a listening comparison (such as pulse, phrase, harmony, or timbre), not proof that one artist influenced another. Beethoven may be used as a reference point when relevant.",
      "Return only a JSON object with keys reply (a concise conversational response) and preferenceSignal (a short durable taste observation, or null). Only create a preferenceSignal from a clear user preference; never infer sensitive traits.",
    ].join(" ");
    const completionResponse = await connectors.proxy(
      "xai",
      "/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(context) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.75,
          max_completion_tokens: 500,
        }),
      },
    );

    if (!completionResponse.ok) {
      req.log.warn(
        { status: completionResponse.status },
        "xAI companion request failed",
      );
      res.status(502).json({ error: "Grok could not answer right now." });
      return;
    }

    const completion = asRecord(await completionResponse.json());
    const choices = Array.isArray(completion?.choices) ? completion.choices : [];
    const firstChoice = asRecord(choices[0]);
    const message = asRecord(firstChoice?.message);
    const rawReply = extractReply(message?.content);
    if (!rawReply) {
      req.log.warn("xAI returned an empty companion response");
      res.status(502).json({ error: "Grok returned an empty response." });
      return;
    }

    let result: { reply?: unknown; preferenceSignal?: unknown };
    try {
      result = JSON.parse(rawReply) as {
        reply?: unknown;
        preferenceSignal?: unknown;
      };
    } catch {
      result = { reply: rawReply, preferenceSignal: null };
    }

    res.json(
      CreateCompanionReplyResponse.parse({
        reply:
          typeof result.reply === "string" ? result.reply : rawReply,
        preferenceSignal:
          typeof result.preferenceSignal === "string"
            ? result.preferenceSignal.slice(0, 120)
            : null,
      }),
    );
  } catch (error) {
    req.log.error(
      { error: error instanceof Error ? error.message : String(error) },
      "MusicVizion companion request failed",
    );
    res.status(502).json({ error: "Grok could not answer right now." });
  }
});

export default router;
