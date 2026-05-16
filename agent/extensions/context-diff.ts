/**
 * /compact-show: Shows all compaction entries and dumps summaries to files
 * so you can diff them.
 *
 * Usage:
 *   /compact-show  — prints all compaction summaries
 *   /compact-diff  — writes numbered files and tells you to diff them
 */

export default function contextDiff(pi: import("@mariozechner/pi-coding-agent").ExtensionAPI) {
  pi.registerCommand("compact-show", {
    description: "Show all compaction summaries from this session",
    handler: async (_args: string, ctx: import("@mariozechner/pi-coding-agent").ExtensionContext) => {
      const entries = ctx.sessionManager.getEntries();
      const compactEntries = entries.filter((e) => e.type === "compaction");

      if (compactEntries.length === 0) {
        ctx.ui.notify("No compaction has occurred yet.", "info");
        return;
      }

      let output = `=== Compaction Entries (${compactEntries.length}) ===\n\n`;
      compactEntries.forEach((entry: any, i: number) => {
        output += `--- Compaction #${i + 1} ---\n`;
        output += `Tokens replaced: ${entry.tokensBefore}\n`;
        output += `Keeps messages from entry: ${entry.firstKeptEntryId}\n`;
        output += `${entry.summary}\n\n`;
      });

      ctx.ui.notify(output, "info");
    },
  });

  pi.registerCommand("compact-diff", {
    description: "Write compaction summaries to files for diffing",
    handler: async (_args: string, ctx: import("@mariozechner/pi-coding-agent").ExtensionContext) => {
      const entries = ctx.sessionManager.getEntries();
      const compactEntries = entries.filter((e) => e.type === "compaction");

      if (compactEntries.length < 2) {
        ctx.ui.notify(
          `Only ${compactEntries.length} compaction(s). Need at least 2 to diff.\nRun /compact again to create another.`,
          "info",
        );
        return;
      }

      const fs = await import("fs");
      const path = await import("path");

      const files: string[] = [];
      compactEntries.forEach((entry: any, i: number) => {
        const outFile = path.default.join(ctx.cwd || process.cwd(), `.pi-compaction-v${i + 1}.md`);
        fs.default.writeFileSync(
          outFile,
          `# Compaction #${i + 1}\nTokens replaced: ${entry.tokensBefore}\n\n${entry.summary}\n`
        );
        files.push(outFile);
      });

      const diffCmd = `diff -u ${files.join(" ")}`;
      ctx.ui.notify(
        `Compaction summaries written:\n${files.map((f) => `  ${f}`).join("\n")}\n\nRun: ${diffCmd}`,
        "info",
      );
    },
  });
}
