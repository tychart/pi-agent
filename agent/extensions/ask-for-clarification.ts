import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

const ClarificationQuestionSchema = Type.Object({
	question: Type.String({
		description: "A concise clarification question to ask the user.",
	}),
	options: Type.Array(Type.String({ minLength: 1 }), {
		description:
			"Short multiple-choice options for the user. Do not include a generic Other/type-your-own option; the extension always adds that automatically.",
		minItems: 2,
		maxItems: 5,
	}),
	allowOther: Type.Optional(
		Type.Boolean({
			description:
				"Deprecated compatibility field. Custom typed answers are always available through the Other option.",
		}),
	),
	typedFallbackPlaceholder: Type.Optional(
		Type.String({
			description:
				"Optional hint for the typed-answer editor. Kept for compatibility even though the RPC editor has no real placeholder field.",
		}),
	),
});

const AskForClarificationParamsSchema = Type.Object({
	intro: Type.Optional(
		Type.String({
			description: "Optional short explanation shown before the clarification questions.",
		}),
	),
	questions: Type.Array(ClarificationQuestionSchema, {
		description: "One to three clarification questions to ask in sequence.",
		minItems: 1,
		maxItems: 3,
	}),
});

type ClarificationQuestion = Static<typeof ClarificationQuestionSchema>;
type AskForClarificationParams = Static<typeof AskForClarificationParamsSchema>;

interface ClarificationAnswer {
	question: string;
	answer: string;
	source: "choice" | "typed";
	selectedOption?: string;
}

interface ClarificationResultDetails {
	cancelled: boolean;
	intro?: string;
	answers: ClarificationAnswer[];
}

const TOOL_NAME = "ask_for_clarification";
const STATUS_KEY = "ask-for-clarification";
const OTHER_OPTION = "Other / type my own answer";
const OTHER_OPTION_NORMALIZED = "other type my own answer";

function ensureClarificationToolIsActive(pi: ExtensionAPI) {
	const activeTools = pi.getActiveTools();
	if (!activeTools.includes(TOOL_NAME)) {
		pi.setActiveTools([...activeTools, TOOL_NAME]);
	}
}

function normalizeOptionLabel(option: string): string {
	return option
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function isOtherLikeOption(option: string): boolean {
	const normalized = normalizeOptionLabel(option);
	return (
		normalized === OTHER_OPTION_NORMALIZED ||
		normalized === "other" ||
		normalized === "other type your own answer" ||
		normalized === "other type a custom answer" ||
		normalized === "other custom" ||
		normalized === "something else"
	);
}

function formatAnswers(answers: ClarificationAnswer[]): string {
	return [
		"Clarification answers:",
		...answers.map((answer, index) => `${index + 1}. ${answer.question}: ${answer.answer}`),
	].join("\n");
}

function buildCancelledResult(
	intro: string | undefined,
	answers: ClarificationAnswer[],
	message: string,
): {
	content: Array<{ type: "text"; text: string }>;
	details: ClarificationResultDetails;
} {
	return {
		content: [{ type: "text", text: message }],
		details: {
			cancelled: true,
			intro,
			answers,
		},
	};
}

export default function askForClarificationExtension(pi: ExtensionAPI) {
	pi.on("session_start", async () => {
		ensureClarificationToolIsActive(pi);
	});

	pi.on("input", async () => {
		ensureClarificationToolIsActive(pi);
		return { action: "continue" as const };
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "Ask for Clarification",
		description:
			"Ask the user one to three concise clarification questions whenever there is any meaningful uncertainty about intent, scope, constraints, priorities, success criteria, or which implementation they want. This tool is safe to call repeatedly in the same task to drill down, verify assumptions, and confirm understanding before continuing.",
		promptSnippet:
			"Default clarification tool: ask the user one to three concise multiple-choice questions. Do not include a generic Other option in the provided choices because the extension already adds one automatically. Call it repeatedly whenever uncertainty remains.",
		promptGuidelines: [
			"Use ask_for_clarification whenever there is any non-trivial uncertainty about what the user wants; prefer clarifying over guessing.",
			"When supplying question options to ask_for_clarification, do not include a generic Other/custom/free-text choice because the extension already adds one automatically.",
			"Use ask_for_clarification before planning, before implementing, and again later if new uncertainty appears during the task.",
			"Use ask_for_clarification to verify assumptions, confirm priorities, and narrow scope before taking irreversible or time-consuming action.",
			"Use ask_for_clarification repeatedly when needed; multiple passes are better than silently guessing wrong.",
			"Use ask_for_clarification even for follow-up verification such as confirming that your current interpretation still matches the user's intent.",
			"When ask_for_clarification returns answers, use those answers to form the next, more specific clarification questions so you progressively drill down toward the user's exact intent.",
			"After each clarification round, inspect what is still underspecified in the user's answers and call ask_for_clarification again with narrower follow-up questions instead of stopping too early.",
		],
		parameters: AskForClarificationParamsSchema,
		async execute(_toolCallId, params: AskForClarificationParams, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return buildCancelledResult(
					params.intro,
					[],
					"Interactive clarification UI is not available in the current mode.",
				);
			}

			const answers: ClarificationAnswer[] = [];

			if (params.intro?.trim()) {
				ctx.ui.notify(params.intro.trim(), "info");
			}

			for (let i = 0; i < params.questions.length; i++) {
				const question: ClarificationQuestion = params.questions[i];
				const progress = `Clarification ${i + 1}/${params.questions.length}`;
				ctx.ui.setStatus(STATUS_KEY, progress);

				const options = [...question.options.filter((option) => !isOtherLikeOption(option)), OTHER_OPTION];
				const selected = await ctx.ui.select(question.question, options);

				if (!selected) {
					ctx.ui.setStatus(STATUS_KEY, undefined);
					ctx.ui.notify("Clarification cancelled.", "warning");
					return buildCancelledResult(params.intro, answers, "User cancelled clarification.");
				}

				if (selected === OTHER_OPTION) {
					const editorTitle = question.typedFallbackPlaceholder?.trim()
						? `${question.question} — ${question.typedFallbackPlaceholder.trim()}`
						: `${question.question} — type your answer below`;
					const typed = await ctx.ui.editor(editorTitle, "");

					if (!typed?.trim()) {
						ctx.ui.setStatus(STATUS_KEY, undefined);
						ctx.ui.notify("Clarification cancelled.", "warning");
						return buildCancelledResult(params.intro, answers, "User cancelled clarification.");
					}

					answers.push({
						question: question.question,
						answer: typed.trim(),
						source: "typed",
						selectedOption: OTHER_OPTION,
					});
					continue;
				}

				answers.push({
					question: question.question,
					answer: selected,
					source: "choice",
					selectedOption: selected,
				});
			}

			ctx.ui.setStatus(STATUS_KEY, undefined);
			ctx.ui.notify("Clarification complete.", "info");

			return {
				content: [
					{
						type: "text",
						text:
							formatAnswers(answers) +
							"\n\nIf any uncertainty still remains, call ask_for_clarification again before proceeding.",
					},
				],
				details: {
					cancelled: false,
					intro: params.intro,
					answers,
				} satisfies ClarificationResultDetails,
			};
		},
	});

	pi.registerCommand("clarification-status", {
		description: "Show whether ask_for_clarification is registered and active",
		handler: async (_args, ctx) => {
			ensureClarificationToolIsActive(pi);
			const activeTools = pi.getActiveTools();
			const allTools = pi.getAllTools().map((tool) => tool.name).sort();
			const isRegistered = allTools.includes(TOOL_NAME);
			const isActive = activeTools.includes(TOOL_NAME);
			ctx.ui.notify(
				`${TOOL_NAME}: registered=${isRegistered ? "yes" : "no"}, active=${isActive ? "yes" : "no"}`,
				isRegistered && isActive ? "info" : "warning",
			);
		},
	});

	pi.on("before_agent_start", async (event) => ({
		systemPrompt:
			event.systemPrompt +
			`\n\n## Clarification Policy\nThe user strongly prefers clarification and ongoing verification over guessing. Default toward using ${TOOL_NAME} whenever there is uncertainty.\n\nIf you are unsure about the user's exact intent, scope, constraints, priorities, success criteria, target files, preferred implementation, or whether your current interpretation is still correct, call ${TOOL_NAME} before proceeding.\n\nTreat any non-trivial uncertainty as a reason to call ${TOOL_NAME}. It is better to interrupt and verify than to continue on a shaky assumption.\n\nYou may call ${TOOL_NAME} repeatedly in the same task. Use it for:\n- initial clarification before planning or implementation\n- follow-up clarification when new ambiguity appears\n- drilling down from broad goals into specific requirements\n- confirming that your current understanding still matches the user's intent\n- validating an assumption before making edits, choosing an approach, or spending significant effort\n\nWhen a clarification round returns answers, do not treat that as the end by default. Read the user's answers carefully, identify what is still vague, and use those answers to generate the next, narrower set of questions. Each call to ${TOOL_NAME} should usually get more specific than the previous one until the task is well-scoped.\n\nGuidelines:\n- Ask one to three concise questions per call.\n- Prefer short multiple-choice options when possible.\n- Do not include a generic Other/custom/free-text option in ask_for_clarification choices because the extension already adds one automatically.\n- Use typed fallback when the options may not capture the user's intent.\n- After each clarification round, restate your current understanding briefly.\n- Then inspect the answers and decide whether more follow-up clarification is needed.\n- If uncertainty remains after one clarification round, call ${TOOL_NAME} again with more specific questions instead of guessing.\n- When in doubt, verify.`,
	}));
}
