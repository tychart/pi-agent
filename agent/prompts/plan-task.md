---
description: Use scout then architect to produce a scoped plan
---
Use the subagent tool with the chain parameter to handle this task.

Workflow:
1. Use the `scout` agent to gather only the most relevant code and context for: $@
2. Use the `architect` agent to turn the scout output into a concrete implementation plan for: $@

Execute this as a chain, passing output between steps via `{previous}`.
Do NOT implement changes yet unless I explicitly ask.
