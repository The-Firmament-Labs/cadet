export interface MemoryDocument {
  documentId: string;
  agentId: string;
  namespace: string;
  sourceKind: string;
  title: string;
  content: string;
  metadataJson: string;
  createdAtMicros: number;
  updatedAtMicros: number;
}

export interface MemoryChunk {
  chunkId: string;
  documentId: string;
  agentId: string;
  namespace: string;
  ordinal: number;
  content: string;
  metadataJson: string;
  createdAtMicros: number;
}

export interface MemoryEmbedding {
  embeddingId: string;
  chunkId: string;
  agentId: string;
  namespace: string;
  model: string;
  dimensions: number;
  vector: number[];
  checksum: string;
  createdAtMicros: number;
}

export interface RetrievalTrace {
  traceId: string;
  runId: string;
  stepId: string;
  queryText: string;
  queryEmbedding: number[];
  chunkIds: string[];
  metadataJson: string;
  createdAtMicros: number;
}

export interface MemorySearchResult {
  chunk: MemoryChunk;
  embedding: MemoryEmbedding;
  score: number;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function searchMemoryByEmbedding(
  queryEmbedding: number[],
  chunks: MemoryChunk[],
  embeddings: MemoryEmbedding[],
  topK: number
): MemorySearchResult[] {
  const chunksById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk] as const));

  return embeddings
    .map((embedding) => {
      const chunk = chunksById.get(embedding.chunkId);
      if (!chunk) {
        return null;
      }

      return {
        chunk,
        embedding,
        score: cosineSimilarity(queryEmbedding, embedding.vector)
      } satisfies MemorySearchResult;
    })
    .filter((candidate): candidate is MemorySearchResult => candidate !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, topK));
}
