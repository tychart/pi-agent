import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAskForClarificationTool } from "./ask-for-clarification.js";
import { registerAskForClarificationReconciler } from "./reconcile.js";

/** Local custom fork of @juicesharp/custom-ask-for-clarification (MIT). */
export default function askForClarificationExtension(pi: ExtensionAPI) {
  registerAskForClarificationTool(pi);
  registerAskForClarificationReconciler(pi);
}
