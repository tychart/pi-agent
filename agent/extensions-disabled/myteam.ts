import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { spawn } from "node:child_process";

const TOOL_NAME = "myteam";
const STATUS_KEY = "myteam";
const STATE_ENTRY_TYPE = "myteam-state";
const TOOL_ACTIONS = ["load_role", "load_skill", "status", "reset"] as const;

type ToolAction = (typeof TOOL_ACTIONS)[number];

const MyTeamToolParamsSchema = Type.Object({
	action: Type.Union(
		TOOL_ACTIONS.map((action) => Type.Literal(action)),
		{ description: "The MyTeam action to perform." },
	),
	path: Type.Optional(
		Type.String({
			description:
				"Role or skill path to load. Omit for load_role to load the root role. Required for load_skill.",
		}),
	),
});

type MyTeamToolParams = Static<typeof MyTeamToolParamsSchema>;

interface LoadedNode {
	path: string;
	displayPath: string;
	output: string;
	loadedAt: number;
}

interface MyTeamState {
	version: 1;
	role: LoadedNode | null;
	skills: LoadedNode[];
}

interface AvailabilityState {
	available: boolean;
	version?: string;
	error?: string;
}

interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

function emptyState(): MyTeamState {
	return {
		version: 1,
		role: null,
		skills: [],
	};
}

function ensureToolIsActive(pi: ExtensionAPI) {
	const activeTools = pi.getActiveTools();
	if (!activeTools.includes(TOOL_NAME)) {
		pi.setActiveTools([...activeTools, TOOL_NAME]);
	}
}

function getMyTeamCommand(): string {
	return process.env.MYTEAM_BIN?.trim() || "myteam";
}

function buildMissingMyTeamMessage(): string {
	const binary = getMyTeamCommand();
	return [
		`MyTeam CLI not found. Tried to run '${binary}'.`,
		"Install MyTeam so the native Python CLI is available on PATH, or set MYTEAM_BIN to the correct executable.",
		"Example: pip install myteam",
	].join(" ");
}

function formatRoleDisplay(path: string): string {
	return path.trim() ? path.trim() : "(root)";
}

function normalizePath(path: string | undefined): string {
	return path?.trim() ?? "";
}

function sanitizeOutput(text: string): string {
	return text.trim();
}

function formatStateSummary(state: MyTeamState, availability: AvailabilityState): string {
	if (!availability.available) {
		return "myteam: unavailable";
	}

	const parts: string[] = [];
	if (state.role) parts.push(`role ${state.role.displayPath}`);
	if (state.skills.length > 0) parts.push(`${state.skills.length} skill${state.skills.length === 1 ? "" : "s"}`);
	return parts.length > 0 ? `myteam: ${parts.join(" · ")}` : "myteam: ready";
}

function formatStatusReport(cwd: string, state: MyTeamState, availability: AvailabilityState): string {
	const lines = [
		"MyTeam bridge status",
		`cwd: ${cwd}`,
		`cli: ${availability.available ? availability.version || "available" : availability.error || "unavailable"}`,
		`role: ${state.role ? state.role.displayPath : "(none)"}`,
		`skills: ${state.skills.length > 0 ? state.skills.map((skill) => skill.displayPath).join(", ") : "(none)"}`,
	];

	if (state.role) {
		lines.push("", `Loaded role output (${state.role.displayPath}):`, state.role.output);
	}

	if (state.skills.length > 0) {
		for (const skill of state.skills) {
			lines.push("", `Loaded skill output (${skill.displayPath}):`, skill.output);
		}
	}

	return lines.join("\n");
}

function buildContextBlock(state: MyTeamState): string | null {
	if (!state.role && state.skills.length === 0) {
		return null;
	}

	const sections: string[] = [
		"## Active MyTeam Context",
		"The following role and skill context was loaded through the native MyTeam CLI by the myteam pi extension.",
		"Preserve the hierarchy and assumptions from this loaded MyTeam context.",
		"If you need broader or more specific MyTeam guidance, use the myteam tool to load another role or skill instead of guessing.",
	];

	if (state.role) {
		sections.push("", `### Active role: ${state.role.displayPath}`, state.role.output);
	}

	for (const skill of state.skills) {
		sections.push("", `### Loaded skill: ${skill.displayPath}`, skill.output);
	}

	return sections.join("\n");
}

function isLoadedNode(value: unknown): value is LoadedNode {
	if (!value || typeof value !== "object") return false;
	const node = value as Partial<LoadedNode>;
	return (
		typeof node.path === "string" &&
		typeof node.displayPath === "string" &&
		typeof node.output === "string" &&
		typeof node.loadedAt === "number"
	);
}

function isMyTeamState(value: unknown): value is MyTeamState {
	if (!value || typeof value !== "object") return false;
	const state = value as Partial<MyTeamState>;
	return (
		state.version === 1 &&
		(state.role === null || isLoadedNode(state.role)) &&
		Array.isArray(state.skills) &&
		state.skills.every(isLoadedNode)
	);
}

function persistState(pi: ExtensionAPI, state: MyTeamState) {
	pi.appendEntry(STATE_ENTRY_TYPE, state);
}

function restoreState(ctx: ExtensionContext): MyTeamState {
	const entries = [...ctx.sessionManager.getEntries()].reverse();
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) continue;
		if (isMyTeamState(entry.data)) return entry.data;
	}
	return emptyState();
}

function setStatus(ctx: ExtensionContext | ExtensionCommandContext, state: MyTeamState, availability: AvailabilityState) {
	ctx.ui.setStatus(STATUS_KEY, formatStateSummary(state, availability));
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	signal?: AbortSignal,
): Promise<CommandResult> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			signal,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("error", (error) => {
			reject(error);
		});
		child.on("close", (code) => {
			resolve({
				stdout,
				stderr,
				exitCode: code ?? 1,
			});
		});
	});
}

export default function myTeamExtension(pi: ExtensionAPI) {
	let state: MyTeamState = emptyState();
	let availability: AvailabilityState = {
		available: false,
		error: buildMissingMyTeamMessage(),
	};

	async function refreshAvailability(cwd: string, signal?: AbortSignal): Promise<AvailabilityState> {
		try {
			const result = await runCommand(getMyTeamCommand(), ["--version"], cwd, signal);
			if (result.exitCode === 0) {
				availability = {
					available: true,
					version: sanitizeOutput(result.stdout || result.stderr) || "myteam available",
				};
				return availability;
			}

			availability = {
				available: false,
				error: sanitizeOutput(result.stderr || result.stdout) || "MyTeam CLI returned a non-zero exit code.",
			};
			return availability;
		} catch (error) {
			const message =
				error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"
					? buildMissingMyTeamMessage()
					: error instanceof Error
						? error.message
						: String(error);
			availability = {
				available: false,
				error: message,
			};
			return availability;
		}
	}

	async function ensureAvailability(cwd: string, signal?: AbortSignal): Promise<void> {
		const current = await refreshAvailability(cwd, signal);
		if (!current.available) {
			throw new Error(current.error || buildMissingMyTeamMessage());
		}
	}

	async function loadRole(path: string | undefined, cwd: string, signal?: AbortSignal): Promise<LoadedNode> {
		await ensureAvailability(cwd, signal);
		const normalized = normalizePath(path);
		const args = ["get", "role"];
		if (normalized) args.push(normalized);
		const result = await runCommand(getMyTeamCommand(), args, cwd, signal);
		if (result.exitCode !== 0) {
			throw new Error(sanitizeOutput(result.stderr || result.stdout) || `Failed to load MyTeam role ${formatRoleDisplay(normalized)}.`);
		}

		const node: LoadedNode = {
			path: normalized,
			displayPath: formatRoleDisplay(normalized),
			output: sanitizeOutput(result.stdout),
			loadedAt: Date.now(),
		};
		state = {
			...state,
			role: node,
		};
		persistState(pi, state);
		return node;
	}

	async function loadSkill(path: string | undefined, cwd: string, signal?: AbortSignal): Promise<LoadedNode> {
		await ensureAvailability(cwd, signal);
		const normalized = normalizePath(path);
		if (!normalized) {
			throw new Error("MyTeam skill path is required. Example: python/testing");
		}

		const result = await runCommand(getMyTeamCommand(), ["get", "skill", normalized], cwd, signal);
		if (result.exitCode !== 0) {
			throw new Error(sanitizeOutput(result.stderr || result.stdout) || `Failed to load MyTeam skill ${normalized}.`);
		}

		const node: LoadedNode = {
			path: normalized,
			displayPath: normalized,
			output: sanitizeOutput(result.stdout),
			loadedAt: Date.now(),
		};
		state = {
			...state,
			skills: [...state.skills.filter((skill) => skill.path !== normalized), node],
		};
		persistState(pi, state);
		return node;
	}

	function resetState() {
		state = emptyState();
		persistState(pi, state);
	}

	function notifyError(ctx: ExtensionContext | ExtensionCommandContext, error: unknown) {
		ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
	}

	pi.on("session_start", async (_event, ctx) => {
		ensureToolIsActive(pi);
		state = restoreState(ctx);
		await refreshAvailability(ctx.cwd);
		setStatus(ctx, state, availability);
	});

	pi.on("input", async () => {
		ensureToolIsActive(pi);
		return { action: "continue" as const };
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		setStatus(ctx, state, availability);
		const contextBlock = buildContextBlock(state);
		if (!contextBlock) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${contextBlock}`,
		};
	});

	pi.registerCommand("myteam-role", {
		description: "Load a MyTeam role into the active pi session. Omit the path to load the root role.",
		handler: async (args, ctx) => {
			try {
				const role = await loadRole(args, ctx.cwd);
				setStatus(ctx, state, availability);
				ctx.ui.notify(`Loaded MyTeam role: ${role.displayPath}`, "success");
			} catch (error) {
				await refreshAvailability(ctx.cwd);
				setStatus(ctx, state, availability);
				notifyError(ctx, error);
			}
		},
	});

	pi.registerCommand("myteam-skill", {
		description: "Load a MyTeam skill into the active pi session.",
		handler: async (args, ctx) => {
			try {
				const skill = await loadSkill(args, ctx.cwd);
				setStatus(ctx, state, availability);
				ctx.ui.notify(`Loaded MyTeam skill: ${skill.displayPath}`, "success");
			} catch (error) {
				await refreshAvailability(ctx.cwd);
				setStatus(ctx, state, availability);
				notifyError(ctx, error);
			}
		},
	});

	pi.registerCommand("myteam-status", {
		description: "Show the active MyTeam bridge state for this pi session.",
		handler: async (_args, ctx) => {
			await refreshAvailability(ctx.cwd);
			setStatus(ctx, state, availability);
			ctx.ui.notify(formatStatusReport(ctx.cwd, state, availability), availability.available ? "info" : "warning");
		},
	});

	pi.registerCommand("myteam-reset", {
		description: "Clear all loaded MyTeam role and skill context from this pi session.",
		handler: async (_args, ctx) => {
			resetState();
			await refreshAvailability(ctx.cwd);
			setStatus(ctx, state, availability);
			ctx.ui.notify("Cleared loaded MyTeam role and skill context for this session.", "info");
		},
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "MyTeam",
		description:
			"Load native MyTeam roles and skills into the active pi session, inspect the current MyTeam context, or reset it.",
		promptSnippet:
			"Use native MyTeam roles/skills from the current project via the myteam tool; this preserves MyTeam hierarchy while keeping the loaded context active in pi.",
		promptGuidelines: [
			"Use the myteam tool when the project has MyTeam-defined roles or skills and you need to load or inspect them.",
			"Use the myteam tool to load a more specific MyTeam skill instead of guessing when deeper hierarchical guidance may exist.",
			"Use myteam action=status when you need to check which MyTeam role or skills are already active in the current pi session.",
		],
		parameters: MyTeamToolParamsSchema,
		async execute(_toolCallId, params: MyTeamToolParams, signal, _onUpdate, ctx) {
			try {
				switch (params.action as ToolAction) {
					case "load_role": {
						const role = await loadRole(params.path, ctx.cwd, signal);
						setStatus(ctx, state, availability);
						return {
							content: [
								{
									type: "text",
									text: `Loaded MyTeam role: ${role.displayPath}\n\n${role.output}`,
								},
							],
							details: {
								action: params.action,
								path: role.path,
								state,
							},
						};
					}
					case "load_skill": {
						const skill = await loadSkill(params.path, ctx.cwd, signal);
						setStatus(ctx, state, availability);
						return {
							content: [
								{
									type: "text",
									text: `Loaded MyTeam skill: ${skill.displayPath}\n\n${skill.output}`,
								},
							],
							details: {
								action: params.action,
								path: skill.path,
								state,
							},
						};
					}
					case "status": {
						await refreshAvailability(ctx.cwd, signal);
						setStatus(ctx, state, availability);
						return {
							content: [{ type: "text", text: formatStatusReport(ctx.cwd, state, availability) }],
							details: {
								action: params.action,
								state,
								availability,
							},
						};
					}
					case "reset": {
						resetState();
						await refreshAvailability(ctx.cwd, signal);
						setStatus(ctx, state, availability);
						return {
							content: [{ type: "text", text: "Cleared active MyTeam role and skill context for this pi session." }],
							details: {
								action: params.action,
								state,
							},
						};
					}
				}

				throw new Error(`Unsupported myteam action: ${params.action}`);
			} catch (error) {
				await refreshAvailability(ctx.cwd, signal);
				setStatus(ctx, state, availability);
				throw error;
			}
		},
	});
}
