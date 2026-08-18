import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { runRpcQuestionnaire } = await jiti.import("../rpc-fallback.ts");
const { buildQuestionnaireResponse } = await jiti.import("../tool/response-envelope.ts");

const responses = [
  "4. Edit an option",
  "1. Keep REST — Existing API",
  "Expanded REST",
  "Preserve clients and add caching.",
  "1. Expanded REST — Preserve clients and add caching.",
];
const ui = {
  async select() { return responses.shift(); },
  async input() { throw new Error("input should not be used in this scenario"); },
  async editor() { return responses.shift(); },
};
const params = {
  questions: [{
    question: "Which API?",
    header: "API",
    options: [
      { label: "Keep REST", description: "Existing API" },
      { label: "GraphQL", description: "New schema" },
    ],
  }],
};
const result = await runRpcQuestionnaire(ui, params);
const response = buildQuestionnaireResponse(result, params);
assert.equal(result.cancelled, false);
assert.equal(result.answers[0].answer, "Expanded REST");
assert.match(response.content[0].text, /edited selected-option description: Preserve clients and add caching\./);
console.log("RPC option-edit flow passed");
