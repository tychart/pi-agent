---
description: Use scout then architect then worker to complete a scoped coding task
---
Use the subagent tool with the chain parameter to handle this task.

Workflow:
1. Use the `scout` agent to gather the relevant code and context for: $@
2. Use the `architect` agent to create a concrete implementation plan for: $@
3. Use the `worker` agent to implement the plan from the previous step

Execute this as a chain, passing output between steps via `{previous}`.
Keep the task narrowly scoped and summarize the result clearly.
