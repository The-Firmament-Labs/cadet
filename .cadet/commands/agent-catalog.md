---
name: agent-catalog
description: List all registered Cadet agents with their runtime, execution target, and schedules
usage: /agent-catalog
---

List all agents from manifests and SpacetimeDB.

## Steps

1. List all manifest files:
   ```bash
   ls examples/agents/*.agent.json
   ```

2. For each manifest, extract key info:
   ```bash
   cat examples/agents/*.agent.json | jq '{id, name, runtime, controlPlane: .deployment.controlPlane, execution: .deployment.execution, schedules: [.schedules[].id], tags}'
   ```

3. Check SpacetimeDB for registered agents:
   ```bash
   spacetime sql "SELECT agent_id, display_name, runtime, control_plane, execution_target FROM agent_record" --server local --database starbridge-control
   ```

4. Show comparison: which manifests are registered vs unregistered.

## Output Format

```
AGENT.CATALOG
─────────────────────────────────────────────
ID              Runtime        Plane    Status
operator        edge-function  cloud    REGISTERED
researcher      rust-core      local    REGISTERED
<new-agent>     bun-worker     local    UNREGISTERED
─────────────────────────────────────────────
Schedules: 2 active, 0 paused
```
