---
name: workflow-status
description: Check the status of workflow runs, stages, steps, and approval gates
usage: /workflow-status [run-id]
---

Show workflow run status from SpacetimeDB.

## Without run-id — show all active runs

```bash
spacetime sql "SELECT run_id, agent_id, goal, status, current_stage FROM workflow_run WHERE status IN ('running', 'blocked', 'awaiting-approval') ORDER BY updated_at_micros DESC" --server local --database starbridge-control
```

## With run-id — show detailed run view

```bash
# Run details
spacetime sql "SELECT * FROM workflow_run WHERE run_id = '<run-id>'" --server local --database starbridge-control

# Steps
spacetime sql "SELECT step_id, stage, status, owner_execution, depends_on_step_id FROM workflow_step WHERE run_id = '<run-id>' ORDER BY created_at_micros" --server local --database starbridge-control

# Approvals
spacetime sql "SELECT approval_id, title, status, risk FROM approval_request WHERE run_id = '<run-id>'" --server local --database starbridge-control

# Browser tasks
spacetime sql "SELECT task_id, status, url FROM browser_task WHERE run_id = '<run-id>'" --server local --database starbridge-control
```

Format the output as a clear status report with stage pipeline visualization.
