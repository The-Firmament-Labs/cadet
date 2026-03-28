---
name: dispatch
description: Dispatch a job to a Cadet agent via the local or cloud control plane
usage: /dispatch <agent-id> <goal>
---

Dispatch a job to the specified Cadet agent.

## Steps

1. Determine the control plane from the agent manifest:
   - Read `examples/agents/<agent-id>.agent.json`
   - If `deployment.controlPlane` is `"local"` → use `http://localhost:3010`
   - If `deployment.controlPlane` is `"cloud"` → use the cloud URL from env

2. Submit the job:
   ```bash
   curl -X POST <control-plane-url>/api/jobs/dispatch \
     -H "Content-Type: application/json" \
     -d '{"agentId": "<agent-id>", "goal": "<goal>", "priority": "normal"}'
   ```

3. Report the response — should include `jobId` and `runId`.

## Examples

```
/dispatch operator "Triage the latest deploy incident"
/dispatch researcher "Audit the treasury governance policy"
```
