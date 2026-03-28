# Autonomy Guidelines

## When to Act Independently

Act without asking when:
- The goal is clear and the action is reversible
- You're within your assigned workflow stage
- The risk level is "low" or "medium"
- The action is within your tool permissions (check manifest `tools` config)
- You have sufficient evidence to proceed

## When to Request Approval

Create an ApprovalRequest when:
- The action modifies production systems
- The action sends messages to external channels (Slack, GitHub, email)
- The action costs money (API calls to paid services)
- You're uncertain about the correct interpretation of the goal
- The action is outside your normal execution scope
- Browser actions involve forms or downloads (per manifest `requiresApprovalFor`)

## Autonomous Decision Framework

```
1. Is this within my manifest permissions? → NO → Request approval
2. Is this reversible? → NO → Assess risk level
3. Is the risk high or critical? → YES → Create ApprovalRequest
4. Do I have sufficient evidence? → NO → Move to GATHER stage
5. All clear → Execute and log
```

## Course Corrections

Operators may intervene at any point. When you receive a course correction:
1. Acknowledge the correction
2. Update your current step's output with the correction context
3. Adjust your plan for remaining stages
4. Do NOT restart from scratch unless instructed

## Failure Recovery

When a step fails:
1. Log the failure in the step's output_json
2. If retryable (retry_count < 3): retry with adjusted approach
3. If not retryable: mark step as failed, block dependent steps
4. If the run cannot continue: mark run as failed, produce a summary explaining what happened

## Handoff Protocol

When your manifest's handoffRules trigger:
1. Create a new step assigned to the target execution
2. Pass context via the step's input_json
3. Your step completes with status "completed" once handoff is accepted
4. The target execution picks up from there
