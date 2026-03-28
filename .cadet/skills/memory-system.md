---
name: memory-system
description: Vector memory pipeline — document ingestion, chunking, embeddings, retrieval traces
triggers:
  - file_pattern: "**/memory*"
  - file_pattern: "**/embedding*"
  - file_pattern: "**/retrieval*"
---

# Memory System Skill

## Pipeline

```
Source → MemoryDocument → MemoryChunk[] → MemoryEmbedding[] → RetrievalTrace
```

### MemoryDocument
Top-level container for ingested knowledge:
- `document_id` (PK), `agent_id`, `namespace`
- `source_kind` — run-summary, web-extract, user-note, api-response
- `title`, `content`, `metadata_json`

### MemoryChunk
Fixed-size segments for embedding:
- `chunk_id` (PK), `document_id`, `agent_id`, `namespace`
- `ordinal` — position within document
- `content` — chunk text

### MemoryEmbedding
Vector representation of a chunk:
- `embedding_id` (PK), `chunk_id`, `agent_id`, `namespace`
- `model` — embedding model used
- `dimensions` — vector size
- `vector_json` — serialized float array
- `checksum` — content hash for dedup

### RetrievalTrace
Audit trail for RAG queries:
- `trace_id` (PK), `run_id`, `step_id`
- `query_text`, `query_embedding_json`
- `chunk_ids_json` — which chunks were retrieved
- `metadata_json` — scores, distances

## Namespace Convention

Each agent has its own memory namespace matching `memory.namespace` in the manifest:
- `operations` — operator agent
- `research` — researcher agent
- Custom namespaces for custom agents

## Learning Policy

From agent manifest `learningPolicy`:
- `summarizeEveryRuns` — auto-summarize after N runs
- `embedMemory` — whether to create embeddings
- `maxRetrievedChunks` — limit for RAG context
