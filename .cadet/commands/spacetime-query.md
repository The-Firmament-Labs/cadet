---
name: spacetime-query
description: Run SpacetimeDB SQL queries against the Cadet control database
usage: /spacetime-query <sql>
---

Execute a SQL query against the SpacetimeDB control database.

## Execution

```bash
spacetime sql "<sql>" --server local --database starbridge-control
```

If the local server is not available, try the cloud:
```bash
spacetime sql "<sql>" --server maincloud --database cadet-control
```

## Quick References

```
/spacetime-query SELECT * FROM agent_record
/spacetime-query SELECT * FROM workflow_run WHERE status = 'running'
/spacetime-query SELECT * FROM approval_request WHERE status = 'pending'
/spacetime-query SELECT COUNT(*) FROM memory_document GROUP BY agent_id
/spacetime-query SELECT * FROM runner_presence WHERE status = 'active'
```

## Table Names

agent_record, job_record, workflow_run, workflow_step, approval_request,
browser_task, browser_artifact, thread_record, message_event, runner_presence,
schedule_record, tool_call_record, memory_document, memory_chunk,
memory_embedding, retrieval_trace, delivery_attempt, operator_account,
webauthn_credential, auth_challenge
