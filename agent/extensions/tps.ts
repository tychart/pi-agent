/**
 * TPS Extension - real-time tokens/sec with 10-second moving average.
 *
 * Widget shows (during streaming):
 *   • 10-second moving-average TPS (all LLM output: text, thinking, etc.)
 *   • TTFT (time to first text token)
 *
 * After each turn, notifies with:
 *   • 10-second moving-average TPS
 *   • Actual totalTokens from API usage stats
 *   • TTFT
 *
 * Usage: pi -e ./tps.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

const WINDOW_MS = 5_000; // 5-second sliding window (configurable)

interface StreamingState {
  firstTextDeltaMs: number;
  ttftMs: number;
  // Timestamps of every delta received (text + thinking)
  deltaTimestamps: number[];
  // Moving-average TPS over the past WINDOW_MS
  movingAvgTps: number;
}

export default function (pi: ExtensionAPI) {
  let state: StreamingState | null = null;
  let agentStartMs = 0;
  let turnIndex = 0;

  pi.on("session_start", async (_event, ctx) => {
    state = null;
    agentStartMs = 0;
    turnIndex++;
    ctx.ui.setWidget("tps", undefined);
  });

  pi.on("agent_start", async (_event, _ctx) => {
    agentStartMs = Date.now();
  });

  pi.on("message_update", async (event, ctx) => {
    // Only track assistant messages
    if (event.message.role !== "assistant") return;

    const ae = event.assistantMessageEvent;
    const now = Date.now();

    if (ae.type === "text_delta" || ae.type === "thinking_delta") {
      if (!state) {
        // First delta — streaming begins
        state = {
          firstTextDeltaMs: now,
          ttftMs: now - agentStartMs,
          deltaTimestamps: [now],
          movingAvgTps: 0,
        };
      } else {
        state.deltaTimestamps.push(now);
      }

      // Prune timestamps outside the 10-second window
      const cutoff = now - WINDOW_MS;
      const idx = lowerBound(state.deltaTimestamps, cutoff);
      state.deltaTimestamps.splice(0, idx);

      // TPS = deltas in window / window duration (seconds)
      state.movingAvgTps = state.deltaTimestamps.length / (WINDOW_MS / 1000);
    }

    // Update widget in real-time
    if (state) {
      const tpsStr = state.movingAvgTps < 10
        ? state.movingAvgTps.toFixed(2)
        : state.movingAvgTps.toFixed(1);
      ctx.ui.setWidget("tps", [
        `⚡ ${tpsStr} tok/s  TTFT: ${state.ttftMs}ms`,
      ]);
    }
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    const totalTokens = event.message.usage?.totalTokens ?? 0;

    // Notify with final stats
    if (state) {
      const tpsStr = state.movingAvgTps < 10
        ? state.movingAvgTps.toFixed(2)
        : state.movingAvgTps.toFixed(1);
      ctx.ui.notify(
        `Turn ${turnIndex} — ${tpsStr} tok/s\n` +
        `  ${totalTokens} total tokens, TTFT: ${state.ttftMs}ms`
      );
    }
  });

  pi.registerCommand("tps", {
    description: "Show last TPS stats",
    handler: async (_args, ctx) => {
      if (state) {
        const tpsStr = state.movingAvgTps < 10
          ? state.movingAvgTps.toFixed(2)
          : state.movingAvgTps.toFixed(1);
        ctx.ui.notify(
          `⚡ ${tpsStr} tok/s (10s moving avg)\n` +
          `  ${state.deltaTimestamps.length} deltas in window, TTFT: ${state.ttftMs}ms`
        );
      } else {
        ctx.ui.notify("No streaming data yet.", "info");
      }
    },
  });
}

/** Find the first index where arr[i] >= value (binary search). */
function lowerBound(arr: number[], value: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
