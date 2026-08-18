import { displayLabel, t } from "./state/i18n-bridge.js";
import type { QuestionAnswer, QuestionData, QuestionnaireResult, QuestionParams } from "./tool/types.js";

const MULTI_SELECT_INSTRUCTIONS =
	'Enter the numbers of all that apply, comma-separated (e.g. "1,3"), or type a custom answer as plain text.';
const CUSTOM_ANSWER_TITLE = "Type your answer:";
const MULTI_SELECT_PLACEHOLDER = "1,3";
const EDIT_OPTION_ROW = "Edit an option";
const MAX_PREVIEW_CHARS = 600;
const editedOptions = new WeakSet<object>();

/** The portable dialog subset available to RPC hosts such as Pendant. */
export type DialogUI = {
	select: (title: string, options: string[]) => Promise<string | undefined>;
	input: (title: string, placeholder?: string) => Promise<string | undefined>;
	editor?: (title: string, prefill?: string) => Promise<string | undefined>;
};

export function hasDialogUI(ui: unknown): ui is DialogUI {
	const u = ui as Partial<Record<"select" | "input", unknown>> | null | undefined;
	return typeof u?.select === "function" && typeof u?.input === "function";
}

type Option = QuestionData["options"][number];

function formatOptionLine(option: Option, index: number): string {
	return `${index + 1}. ${option.label} — ${option.description}`;
}

function parseIndex(token: string, count: number): number | null {
	const i = Number.parseInt(token, 10) - 1;
	return i >= 0 && i < count ? i : null;
}

function buildPreviewBlock(question: QuestionData): string {
	const blocks = question.options.flatMap((o, i) =>
		o.preview && o.preview.length > 0
			? [`--- ${i + 1}. ${o.label} preview ---\n${o.preview.slice(0, MAX_PREVIEW_CHARS)}`]
			: [],
	);
	return blocks.length > 0 ? `\n\n${blocks.join("\n\n")}` : "";
}

/**
 * Lets a Pendant/RPC user revise the label and description of any model-provided
 * option before answering. The edited objects are the same objects later used to
 * build the answer envelope, so only a selected edited description reaches the model.
 */
async function editOption(ui: DialogUI, q: QuestionData, header: string): Promise<boolean | undefined> {
	const choice = await ui.select(`${header}${q.question}\n\nWhich option would you like to edit?`, q.options.map(formatOptionLine));
	if (choice == null) return undefined;
	const index = parseIndex(choice, q.options.length);
	if (index == null) return undefined;
	const option = q.options[index]!;
	const label = ui.editor
		? await ui.editor(`Edit option label: ${option.label}`, option.label)
		: await ui.input(`Edit option label: ${option.label}`, option.label);
	if (label == null) return undefined;
	const description = ui.editor
		? await ui.editor(`Edit description for: ${label.trim() || option.label}`, option.description)
		: await ui.input(`Edit description for: ${label.trim() || option.label}`, option.description);
	if (description == null) return undefined;
	const nextLabel = label.trim();
	if (nextLabel.length === 0) return false;
	option.label = nextLabel;
	option.description = description.trim();
	editedOptions.add(option);
	return true;
}

export async function runRpcQuestionnaire(ui: DialogUI, params: QuestionParams): Promise<QuestionnaireResult> {
	const answers: QuestionAnswer[] = [];
	for (let qi = 0; qi < params.questions.length; qi++) {
		const q = params.questions[qi]!;
		const header = q.header ? `[${q.header}] ` : "";
		const answer = q.multiSelect
			? await askMultiSelect(ui, q, qi, header)
			: await askSingleSelect(ui, q, qi, header);
		if (answer === undefined) return { answers, cancelled: true };
		answers.push(answer);
	}
	return { answers, cancelled: false };
}

async function askSingleSelect(
	ui: DialogUI,
	q: QuestionData,
	questionIndex: number,
	header: string,
): Promise<QuestionAnswer | undefined> {
	for (;;) {
		const options = q.options.map(formatOptionLine);
		options.push(`${q.options.length + 1}. ${displayLabel("other")}`);
		options.push(`${q.options.length + 2}. ${EDIT_OPTION_ROW}`);
		const chosen = await ui.select(`${header}${q.question}${buildPreviewBlock(q)}`, options);
		if (chosen == null) return undefined;
		const idx = parseIndex(chosen, options.length);
		if (idx == null) return undefined;
		if (idx < q.options.length) {
			const o = q.options[idx]!;
			return {
				questionIndex, question: q.question, kind: "option", answer: o.label,
				preview: o.preview && o.preview.length > 0 ? o.preview : undefined,
				editedDescription: editedOptions.has(o) ? o.description : undefined,
			};
		}
		if (idx === q.options.length) {
			const typed = await ui.input(`${header}${q.question}\n\n${t("rpc.custom_answer_title", CUSTOM_ANSWER_TITLE)}`, "");
			if (typed == null) return undefined;
			return { questionIndex, question: q.question, kind: "custom", answer: typed };
		}
		const edited = await editOption(ui, q, header);
		if (edited === undefined) return undefined;
	}
}

async function askMultiSelect(
	ui: DialogUI,
	q: QuestionData,
	questionIndex: number,
	header: string,
): Promise<QuestionAnswer | undefined> {
	for (;;) {
		const action = await ui.select(`${header}${q.question}`, ["Answer question", EDIT_OPTION_ROW]);
		if (action == null) return undefined;
		if (action === EDIT_OPTION_ROW) {
			const edited = await editOption(ui, q, header);
			if (edited === undefined) return undefined;
			continue;
		}
		const list = q.options.map(formatOptionLine).join("\n");
		const value = await ui.input(
			`${header}${q.question}\n\n${list}\n\n${t("rpc.multi_instructions", MULTI_SELECT_INSTRUCTIONS)}`,
			MULTI_SELECT_PLACEHOLDER,
		);
		if (value == null) return undefined;
		const trimmed = value.trim();
		if (trimmed.length === 0) return { questionIndex, question: q.question, kind: "multi", answer: null, selected: [] };
		const tokens = trimmed.split(/[,\s]+/).filter(Boolean);
		const indices = tokens.map((token) => (/^\d+\.?$/.test(token) ? parseIndex(token, q.options.length) : null));
		if (indices.every((i): i is number => i != null)) {
			const selected = [...new Set(indices.map((i) => q.options[i]!.label))];
			return { questionIndex, question: q.question, kind: "multi", answer: null, selected };
		}
		return { questionIndex, question: q.question, kind: "custom", answer: trimmed };
	}
}
