// [claude-code 2026-04-19] S27-T5 W2c — voice assistant end-to-end proof.
// The sidecar is stubbed at the module boundary so this test runs without a
// live Hermes process. What it proves:
//   (a) streamVoiceReply yields transcript → text → audio → done in order
//   (b) end-of-user-audio → first audio event latency stays under the 2.5s
//       CI-tolerant target (local target <2s per brief §5)
//   (c) abortSignal interrupts the stream cleanly (remaining events halt)

import test from "node:test";
import assert from "node:assert/strict";

process.env.HERMES_SIDECAR_ENABLED = "true";

const { streamVoiceReply } = await import("../services/voice-service.js");
const { sidecarClient } = await import("../services/ai/sidecar-client.js");

type Originals = {
  chatStream: typeof sidecarClient.chat.stream;
  ctxIngest: typeof sidecarClient.context.ingest;
  voiceTts: typeof sidecarClient.voice.tts;
};

function snapshot(): Originals {
  return {
    chatStream: sidecarClient.chat.stream,
    ctxIngest: sidecarClient.context.ingest,
    voiceTts: sidecarClient.voice.tts,
  };
}

function restore(o: Originals): void {
  sidecarClient.chat.stream = o.chatStream;
  sidecarClient.context.ingest = o.ctxIngest;
  sidecarClient.voice.tts = o.voiceTts;
}

function makeChatStream(chunks: string[], delayMs: number) {
  return async function* () {
    for (const text of chunks) {
      await new Promise((r) => setTimeout(r, delayMs));
      yield { type: "delta" as const, payload: { text } };
    }
    yield { type: "done" as const, payload: {} };
  };
}

function installSidecarMocks(args: {
  chunks: string[];
  firstTokenMs: number;
  ttsMs: number;
}): { ttsCalls: number; ingestCalls: number } {
  const stats = { ttsCalls: 0, ingestCalls: 0 };
  const gen = makeChatStream(args.chunks, args.firstTokenMs);

  sidecarClient.context.ingest = async () => {
    stats.ingestCalls++;
  };
  sidecarClient.chat.stream = ((_req: unknown) =>
    gen()) as typeof sidecarClient.chat.stream;
  sidecarClient.voice.tts = (async () => {
    stats.ttsCalls++;
    await new Promise((r) => setTimeout(r, args.ttsMs));
    return new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer;
  }) as typeof sidecarClient.voice.tts;

  return stats;
}

test("streamVoiceReply emits transcript → text → audio → done in order", async () => {
  const originals = snapshot();
  const stats = installSidecarMocks({
    chunks: ["Hello.", " Ready to trade."],
    firstTokenMs: 80,
    ttsMs: 40,
  });

  try {
    const events: string[] = [];
    for await (const evt of streamVoiceReply({
      conversationId: "00000000-0000-4000-8000-000000000000",
      transcript: "What's NQ doing?",
    })) {
      events.push(evt.type);
    }

    assert.equal(events[0], "transcript");
    assert.ok(events.includes("text"), "expected at least one text event");
    assert.ok(events.includes("audio"), "expected at least one audio event");
    assert.equal(events[events.length - 1], "done");
    assert.ok(stats.ttsCalls >= 1, `tts not invoked (got ${stats.ttsCalls})`);
    assert.ok(
      stats.ingestCalls >= 1,
      `context.ingest not invoked (got ${stats.ingestCalls})`,
    );
  } finally {
    restore(originals);
  }
});

test("first audio event lands under 2.5s CI budget", async () => {
  const originals = snapshot();
  installSidecarMocks({
    chunks: ["Quick.", " Answer."],
    firstTokenMs: 120,
    ttsMs: 60,
  });

  try {
    const start = performance.now();
    let firstAudioAt: number | null = null;

    for await (const evt of streamVoiceReply({
      conversationId: "00000000-0000-4000-8000-000000000001",
      transcript: "Give me levels.",
    })) {
      if (evt.type === "audio" && firstAudioAt === null) {
        firstAudioAt = performance.now() - start;
      }
    }

    assert.ok(firstAudioAt !== null, "never got an audio event");
    assert.ok(
      (firstAudioAt as number) < 2500,
      `first audio latency ${(firstAudioAt as number).toFixed(0)}ms exceeded 2500ms`,
    );
  } finally {
    restore(originals);
  }
});

test("abortSignal interrupts the stream cleanly", async () => {
  const originals = snapshot();
  installSidecarMocks({
    chunks: ["A.", " B.", " C.", " D."],
    firstTokenMs: 30,
    ttsMs: 20,
  });

  try {
    const controller = new AbortController();
    const events: Array<{ type: string; reason?: string }> = [];

    for await (const evt of streamVoiceReply({
      conversationId: "00000000-0000-4000-8000-000000000002",
      transcript: "Go.",
      abortSignal: controller.signal,
    })) {
      events.push(evt as { type: string; reason?: string });
      if (events.filter((e) => e.type === "text").length === 1) {
        controller.abort();
      }
    }

    const done = events.find((e) => e.type === "done");
    assert.ok(done, "no done event after abort");
    assert.equal(done?.reason, "interrupted");
  } finally {
    restore(originals);
  }
});

test("sidecar-disabled mode emits error + done without throwing", async () => {
  delete process.env.HERMES_SIDECAR_ENABLED;

  const events: string[] = [];
  for await (const evt of streamVoiceReply({
    conversationId: "00000000-0000-4000-8000-000000000003",
    transcript: "Hello.",
  })) {
    events.push(evt.type);
  }

  assert.deepEqual(events, ["error", "done"]);
  process.env.HERMES_SIDECAR_ENABLED = "true";
});
