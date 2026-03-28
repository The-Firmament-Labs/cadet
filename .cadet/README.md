# Cadet Augmentation System

Custom skills, agents, and commands for the Cadet autonomous agent platform.

## Structure

```
.cadet/
├── skills/          Autonomous helpers — activate on file patterns
│   ├── agent-manifest.md    Agent manifest validation & authoring
│   ├── workflow-ops.md      Workflow stages, steps, approval gates
│   ├── control-plane.md     Dual control plane API patterns
│   └── memory-system.md     Vector memory pipeline
├── agents/          Specialized sub-agents — named after US launch programs
│   ├── apollo.md    Apollo — Mission control debugger
│   ├── mercury.md   Mercury — Pre-flight manifest validator
│   ├── atlas.md     Atlas — Launch vehicle deployment operator
│   └── titan.md     Titan — Heavy data analyst for SpacetimeDB
└── commands/        Slash commands — invoke with /name
    ├── dispatch.md          Dispatch a job to an agent
    ├── workflow-status.md   Check workflow run status
    ├── agent-catalog.md     List registered agents
    └── spacetime-query.md   Run SpacetimeDB SQL queries
```

## Usage

Skills activate automatically when editing matching files.

```bash
# Agents (named after US launch programs)
@apollo Why is run_01 stuck?
@mercury Check saturn.agent.json
@atlas Deploy to production
@titan Show active runs

# Commands
/dispatch saturn "Triage the deploy incident"
/workflow-status run_01
/agent-catalog
/spacetime-query SELECT * FROM workflow_run WHERE status = 'running'
```

## Integration with Agent Manifests

The `.cadet/` augmentation system works alongside Cadet's `.agent.json` manifests in `examples/agents/`. Skills validate manifest structure, agents debug runtime issues, and commands interact with the control plane.
