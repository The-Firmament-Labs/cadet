use std::collections::{BTreeSet, HashMap};

use dioxus::prelude::*;
use starbridge_core::{
    MemoryChunkRecord, MemoryEmbeddingRecord, MissionControlSnapshot, RetrievalTraceRecord,
};

use crate::ui::{
    models::memory_namespaces,
    shared::{list_item_class, tone_pill_class, EmptyState, InspectorCard, RetrievalTraceRow},
};

#[derive(Clone, Debug, PartialEq)]
struct ProjectionPoint {
    chunk_id: String,
    label: String,
    x_pct: f64,
    y_pct: f64,
    scale: f64,
    opacity: f64,
    depth: f64,
    active: bool,
}

#[derive(Clone, Debug, PartialEq)]
struct QueryMarker {
    x_pct: f64,
    y_pct: f64,
    scale: f64,
}

#[derive(Clone, Debug, PartialEq)]
struct ProjectionScene {
    points: Vec<ProjectionPoint>,
    x_bounds: (f64, f64),
    y_bounds: (f64, f64),
    z_bounds: (f64, f64),
}

#[derive(Clone, Debug, PartialEq)]
struct DimensionSample {
    index: usize,
    value: f64,
    height_pct: f64,
}

#[component]
pub fn MemoryView(snapshot: MissionControlSnapshot) -> Element {
    let documents = snapshot.memory_documents.clone();
    let chunks = snapshot.memory_chunks.clone();
    let embeddings = snapshot.memory_embeddings.clone();
    let traces = snapshot.retrieval_traces.clone();
    let namespaces = memory_namespaces(&snapshot);
    let models = embeddings
        .iter()
        .map(|embedding| embedding.model.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();

    let mut selected_document_id =
        use_signal(|| documents.first().map(|document| document.document_id.clone()));
    let active_document_id = selected_document_id()
        .clone()
        .or_else(|| documents.first().map(|document| document.document_id.clone()));
    let selected_document = active_document_id
        .as_ref()
        .and_then(|document_id| {
            documents
                .iter()
                .find(|document| &document.document_id == document_id)
        })
        .cloned();

    let document_chunks = selected_document
        .as_ref()
        .map(|document| chunks_for_document(&chunks, &document.document_id))
        .unwrap_or_default();
    let chunk_lookup = document_chunks
        .iter()
        .cloned()
        .map(|chunk| (chunk.chunk_id.clone(), chunk))
        .collect::<HashMap<_, _>>();
    let embedding_lookup = embeddings
        .iter()
        .cloned()
        .map(|embedding| (embedding.chunk_id.clone(), embedding))
        .collect::<HashMap<_, _>>();

    let mut selected_chunk_id =
        use_signal(|| document_chunks.first().map(|chunk| chunk.chunk_id.clone()));
    let active_chunk_id = selected_chunk_id()
        .clone()
        .filter(|chunk_id| chunk_lookup.contains_key(chunk_id))
        .or_else(|| document_chunks.first().map(|chunk| chunk.chunk_id.clone()));
    let selected_chunk = active_chunk_id
        .as_ref()
        .and_then(|chunk_id| chunk_lookup.get(chunk_id))
        .cloned();
    let selected_embedding = active_chunk_id
        .as_ref()
        .and_then(|chunk_id| embedding_lookup.get(chunk_id))
        .cloned();

    let active_namespace = selected_document
        .as_ref()
        .map(|document| document.namespace.clone())
        .or_else(|| selected_embedding.as_ref().map(|embedding| embedding.namespace.clone()));
    let namespace_embeddings = active_namespace
        .as_ref()
        .map(|namespace| {
            embeddings
                .iter()
                .filter(|embedding| &embedding.namespace == namespace)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| embeddings.clone());
    let field_embeddings = if namespace_embeddings.len() >= 4 {
        namespace_embeddings.clone()
    } else {
        embeddings.clone()
    };
    let projection_scene = build_projection_scene(&field_embeddings, active_chunk_id.as_deref());
    let related_trace = active_chunk_id
        .as_ref()
        .and_then(|chunk_id| trace_for_chunk(&traces, chunk_id))
        .cloned();
    let query_marker = related_trace
        .as_ref()
        .and_then(|trace| project_query_marker(trace, &projection_scene));
    let dimension_samples = selected_embedding
        .as_ref()
        .map(|embedding| dimension_samples(&embedding.vector, 24))
        .unwrap_or_default();
    let selected_vector_preview = selected_embedding
        .as_ref()
        .map(|embedding| format_vector_preview(&embedding.vector))
        .unwrap_or_else(|| "[]".to_string());
    let selected_metadata = selected_chunk
        .as_ref()
        .map(|chunk| pretty_json(&chunk.metadata_json))
        .unwrap_or_else(|| "{}".to_string());
    let selected_norm = selected_embedding
        .as_ref()
        .map(|embedding| l2_norm(&embedding.vector))
        .unwrap_or(0.0);

    rsx! {
        div { class: "page-grid page-grid-memory",
            div { class: "panel-stack",
                section { class: "panel",
                    div { class: "panel-head",
                        p { class: "section-eyebrow", "Memory atlas" }
                        h3 { class: "card-title", "Documents" }
                        p { class: "row-copy", "{documents.len()} indexed sources across {namespaces.len()} namespaces." }
                    }
                    div { class: "panel-body list-stack",
                        if documents.is_empty() {
                            EmptyState {
                                title: "No memory documents".to_string(),
                                body: "Learning workers have not written any memory records yet.".to_string(),
                            }
                        } else {
                            for document in documents.clone() {
                                button {
                                    class: list_item_class(
                                        active_document_id
                                            .as_ref()
                                            .map(|value| value == &document.document_id)
                                            .unwrap_or(false)
                                    ),
                                    onclick: {
                                        let document_id = document.document_id.clone();
                                        move |_| selected_document_id.set(Some(document_id.clone()))
                                    },
                                    div { class: "list-item-head",
                                        strong { class: "list-item-title", "{document.title}" }
                                        span { class: "pill pill-subtle", "{document.namespace}" }
                                    }
                                    p { class: "list-item-meta", "{document.source_kind} · {document.agent_id}" }
                                    p { class: "list-item-copy", "{document.content}" }
                                }
                            }
                        }
                    }
                }

                section { class: "panel",
                    div { class: "panel-head",
                        p { class: "section-eyebrow", "Chunk lattice" }
                        h3 { class: "card-title", "Fragments in scope" }
                        p { class: "row-copy", "{document_chunks.len()} chunks are visible for the active document." }
                    }
                    div { class: "panel-body list-stack",
                        if document_chunks.is_empty() {
                            EmptyState {
                                title: "No chunks in scope".to_string(),
                                body: "Choose a document with chunked memory to inspect its vectors.".to_string(),
                            }
                        } else {
                            for chunk in document_chunks.clone() {
                                button {
                                    class: list_item_class(
                                        active_chunk_id
                                            .as_ref()
                                            .map(|value| value == &chunk.chunk_id)
                                            .unwrap_or(false)
                                    ),
                                    onclick: {
                                        let chunk_id = chunk.chunk_id.clone();
                                        move |_| selected_chunk_id.set(Some(chunk_id.clone()))
                                    },
                                    div { class: "list-item-head",
                                        strong { class: "list-item-title", "{short_chunk_label(&chunk.chunk_id)}" }
                                        span { class: "pill pill-subtle", "ord {chunk.ordinal + 1}" }
                                    }
                                    p { class: "list-item-meta", "{chunk.namespace}" }
                                    p { class: "list-item-copy", "{chunk.content}" }
                                }
                            }
                        }
                    }
                }
            }

            section { class: "panel memory-stage-panel",
                div { class: "panel-head memory-stage-head",
                    div {
                        p { class: "section-eyebrow", "Vector telemetry" }
                        h3 { class: "card-title", "3D memory field" }
                        p { class: "row-copy", "Real embedding vectors projected from the active namespace using the live Spacetime control plane." }
                    }
                    div { class: "chip-row",
                        if let Some(namespace) = active_namespace.clone() {
                            span { class: "pill pill-accent", "{namespace}" }
                        }
                        if let Some(embedding) = selected_embedding.clone() {
                            span { class: "pill pill-warn", "{embedding.model}" }
                        }
                        span { class: "pill pill-subtle", "{field_embeddings.len()} vectors" }
                    }
                }

                div { class: "panel-body memory-stage-body",
                    div { class: "memory-field-shell",
                        if projection_scene.points.is_empty() {
                            EmptyState {
                                title: "No vectors available".to_string(),
                                body: "The selected namespace does not have any parsed embeddings yet.".to_string(),
                            }
                        } else {
                            div { class: "memory-field",
                                div { class: "memory-field-grid" }
                                div { class: "memory-field-axis axis-x" }
                                div { class: "memory-field-axis axis-y" }
                                if let Some(marker) = query_marker {
                                    div {
                                        class: "memory-query-marker",
                                        style: format!(
                                            "left: {:.2}%; top: {:.2}%; transform: translate(-50%, -50%) scale({:.3});",
                                            marker.x_pct,
                                            marker.y_pct,
                                            marker.scale
                                        ),
                                    }
                                }
                                for point in projection_scene.points.clone() {
                                    button {
                                        class: if point.active {
                                            "memory-point memory-point-active"
                                        } else {
                                            "memory-point"
                                        },
                                        style: format!(
                                            "left: {:.2}%; top: {:.2}%; transform: translate(-50%, -50%) scale({:.3}); opacity: {:.3};",
                                            point.x_pct,
                                            point.y_pct,
                                            point.scale,
                                            point.opacity
                                        ),
                                        onclick: {
                                            let chunk_id = point.chunk_id.clone();
                                            move |_| selected_chunk_id.set(Some(chunk_id.clone()))
                                        },
                                        span { class: "memory-point-core" }
                                        span { class: "memory-point-label", "{point.label}" }
                                    }
                                }
                            }
                        }
                    }

                    div { class: "memory-stage-stat-grid",
                        article { class: "memory-stat-card" ,
                            p { class: "section-eyebrow", "Field density" }
                            strong { class: "memory-stat-value", "{projection_scene.points.len()}" }
                            p { class: "row-copy", "Projected vectors in the current namespace." }
                        }
                        article { class: "memory-stat-card" ,
                            p { class: "section-eyebrow", "Vector norm" }
                            strong { class: "memory-stat-value", "{format_decimal(selected_norm)}" }
                            p { class: "row-copy", "L2 magnitude of the selected embedding." }
                        }
                        article { class: "memory-stat-card" ,
                            p { class: "section-eyebrow", "Query linkage" }
                            strong { class: "memory-stat-value", "{related_trace.as_ref().map(|trace| trace.chunk_ids.len()).unwrap_or(0)}" }
                            p { class: "row-copy", "Chunks attached to the active retrieval trace." }
                        }
                    }

                    div { class: "memory-detail-grid",
                        article { class: "memory-detail-card",
                            p { class: "section-eyebrow", "Selected fragment" }
                            if let Some(document) = selected_document.clone() {
                                h3 { class: "card-title", "{document.title}" }
                            } else {
                                h3 { class: "card-title", "No active document" }
                            }
                            if let Some(chunk) = selected_chunk.clone() {
                                p { class: "row-copy", "{chunk.content}" }
                                ul { class: "key-value-list",
                                    li { span { "Chunk" } strong { "{chunk.chunk_id}" } }
                                    li { span { "Ordinal" } strong { "{chunk.ordinal + 1}" } }
                                    li { span { "Namespace" } strong { "{chunk.namespace}" } }
                                }
                                pre { class: "memory-json", "{selected_metadata}" }
                            } else {
                                p { class: "row-copy", "Select a projected vector or chunk fragment to inspect its metadata." }
                            }
                        }

                        article { class: "memory-detail-card",
                            p { class: "section-eyebrow", "Embedding profile" }
                            if let Some(embedding) = selected_embedding.clone() {
                                h3 { class: "card-title", "{embedding.embedding_id}" }
                                ul { class: "key-value-list",
                                    li { span { "Model" } strong { "{embedding.model}" } }
                                    li { span { "Dimensions" } strong { "{embedding.dimensions}" } }
                                    li { span { "Checksum" } strong { "{embedding.checksum}" } }
                                }
                                div { class: "dimension-strip",
                                    for sample in dimension_samples {
                                        div { class: "dimension-cell",
                                            div {
                                                class: "dimension-bar",
                                                style: format!("height: {:.2}%;", sample.height_pct),
                                            }
                                            span { class: "dimension-index", "d{sample.index + 1}" }
                                        }
                                    }
                                }
                                pre { class: "memory-json", "{selected_vector_preview}" }
                            } else {
                                p { class: "row-copy", "Select a chunk with an attached embedding to inspect the raw vector values." }
                            }
                        }
                    }
                }
            }

            aside { class: "inspector-stack",
                InspectorCard {
                    eyebrow: "Namespaces".to_string(),
                    title: "Coverage".to_string(),
                    div { class: "chip-row",
                        for namespace in namespaces {
                            span { class: "pill pill-subtle", "{namespace}" }
                        }
                    }
                }

                InspectorCard {
                    eyebrow: "Embedding models".to_string(),
                    title: "Runtime".to_string(),
                    if models.is_empty() {
                        p { class: "row-copy", "No embedding models available yet." }
                    } else {
                        div { class: "chip-row",
                            for model in models {
                                span { class: "pill pill-warn", "{model}" }
                            }
                        }
                    }
                }

                InspectorCard {
                    eyebrow: "Selected trace".to_string(),
                    title: "Query vector".to_string(),
                    if let Some(trace) = related_trace.clone() {
                        div { class: "panel-stack",
                            p { class: "row-copy", "{trace.query_text}" }
                            div { class: "chip-row",
                                span { class: tone_pill_class("accent"), "{trace.query_embedding.len()} dims" }
                                span { class: "pill pill-subtle", "{trace.chunk_ids.len()} chunk refs" }
                            }
                            pre { class: "memory-json", "{format_vector_preview(&trace.query_embedding)}" }
                        }
                    } else {
                        p { class: "row-copy", "Select a chunk that participates in a retrieval trace to inspect its query embedding." }
                    }
                }

                InspectorCard {
                    eyebrow: "Retrieval traces".to_string(),
                    title: "Lineage".to_string(),
                    if traces.is_empty() {
                        p { class: "row-copy", "No retrieval traces were recorded for this snapshot." }
                    } else {
                        div { class: "panel-stack",
                            for trace in traces {
                                RetrievalTraceRow { trace }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn chunks_for_document(chunks: &[MemoryChunkRecord], document_id: &str) -> Vec<MemoryChunkRecord> {
    let mut scoped = chunks
        .iter()
        .filter(|chunk| chunk.document_id == document_id)
        .cloned()
        .collect::<Vec<_>>();
    scoped.sort_by(|left, right| {
        left.ordinal
            .cmp(&right.ordinal)
            .then_with(|| left.chunk_id.cmp(&right.chunk_id))
    });
    scoped
}

fn trace_for_chunk<'a>(
    traces: &'a [RetrievalTraceRecord],
    chunk_id: &str,
) -> Option<&'a RetrievalTraceRecord> {
    traces
        .iter()
        .find(|trace| trace.chunk_ids.iter().any(|trace_chunk_id| trace_chunk_id == chunk_id))
}

fn build_projection_scene(
    embeddings: &[MemoryEmbeddingRecord],
    active_chunk_id: Option<&str>,
) -> ProjectionScene {
    if embeddings.is_empty() {
        return ProjectionScene {
            points: Vec::new(),
            x_bounds: (0.0, 0.0),
            y_bounds: (0.0, 0.0),
            z_bounds: (0.0, 0.0),
        };
    }

    let coordinates = embeddings
        .iter()
        .map(|embedding| (embedding.clone(), embedding_coordinates(&embedding.vector)))
        .collect::<Vec<_>>();
    let x_bounds = bounds(coordinates.iter().map(|(_, (x, _, _))| *x));
    let y_bounds = bounds(coordinates.iter().map(|(_, (_, y, _))| *y));
    let z_bounds = bounds(coordinates.iter().map(|(_, (_, _, z))| *z));

    let points = coordinates
        .into_iter()
        .map(|(embedding, (x, y, z))| {
            let x_pct = normalize_to_range(x, x_bounds, 10.0, 90.0);
            let y_pct = normalize_to_range(y, y_bounds, 14.0, 86.0);
            let depth = normalize_to_range(z, z_bounds, 0.2, 1.0);
            ProjectionPoint {
                label: short_chunk_label(&embedding.chunk_id),
                chunk_id: embedding.chunk_id.clone(),
                x_pct,
                y_pct,
                scale: 0.76 + (depth * 0.92),
                opacity: 0.4 + (depth * 0.55),
                depth,
                active: active_chunk_id
                    .map(|chunk_id| chunk_id == embedding.chunk_id.as_str())
                    .unwrap_or(false),
            }
        })
        .collect::<Vec<_>>();

    ProjectionScene {
        points,
        x_bounds,
        y_bounds,
        z_bounds,
    }
}

fn project_query_marker(trace: &RetrievalTraceRecord, scene: &ProjectionScene) -> Option<QueryMarker> {
    if trace.query_embedding.is_empty() || scene.points.is_empty() {
        return None;
    }

    let (x, y, z) = embedding_coordinates(&trace.query_embedding);
    Some(QueryMarker {
        x_pct: normalize_to_range(x, scene.x_bounds, 10.0, 90.0),
        y_pct: normalize_to_range(y, scene.y_bounds, 14.0, 86.0),
        scale: 0.9 + normalize_to_range(z, scene.z_bounds, 0.0, 0.6),
    })
}

fn embedding_coordinates(vector: &[f64]) -> (f64, f64, f64) {
    if vector.is_empty() {
        return (0.0, 0.0, 0.0);
    }

    let mut x_total = 0.0;
    let mut y_total = 0.0;
    let mut z_total = 0.0;
    let mut x_count = 0.0_f64;
    let mut y_count = 0.0_f64;
    let mut z_count = 0.0_f64;

    for (index, value) in vector.iter().enumerate() {
        match index % 3 {
            0 => {
                x_total += value;
                x_count += 1.0;
            }
            1 => {
                y_total += value;
                y_count += 1.0;
            }
            _ => {
                z_total += value;
                z_count += 1.0;
            }
        }
    }

    (
        x_total / x_count.max(1.0),
        y_total / y_count.max(1.0),
        z_total / z_count.max(1.0),
    )
}

fn bounds(values: impl Iterator<Item = f64>) -> (f64, f64) {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;

    for value in values {
        min = min.min(value);
        max = max.max(value);
    }

    if !min.is_finite() || !max.is_finite() {
        (0.0, 0.0)
    } else {
        (min, max)
    }
}

fn normalize_to_range(value: f64, bounds: (f64, f64), floor: f64, ceiling: f64) -> f64 {
    let (min, max) = bounds;
    if (max - min).abs() < f64::EPSILON {
        return (floor + ceiling) / 2.0;
    }

    let normalized = (value - min) / (max - min);
    floor + ((ceiling - floor) * normalized)
}

fn dimension_samples(vector: &[f64], limit: usize) -> Vec<DimensionSample> {
    let max_abs = vector
        .iter()
        .map(|value| value.abs())
        .fold(0.0_f64, f64::max)
        .max(1.0);

    vector
        .iter()
        .take(limit)
        .enumerate()
        .map(|(index, value)| DimensionSample {
            index,
            value: *value,
            height_pct: ((value.abs() / max_abs) * 100.0).max(6.0),
        })
        .collect()
}

fn l2_norm(vector: &[f64]) -> f64 {
    vector.iter().map(|value| value * value).sum::<f64>().sqrt()
}

fn short_chunk_label(chunk_id: &str) -> String {
    let suffix = chunk_id
        .split('-')
        .last()
        .filter(|value| !value.is_empty())
        .unwrap_or(chunk_id);
    format!("V{}", suffix.to_uppercase())
}

fn format_vector_preview(vector: &[f64]) -> String {
    let preview = vector
        .iter()
        .take(18)
        .map(|value| format!("{value:.4}"))
        .collect::<Vec<_>>()
        .join(", ");

    if vector.len() > 18 {
        format!("[{preview}, …]")
    } else {
        format!("[{preview}]")
    }
}

fn pretty_json(raw: &str) -> String {
    serde_json::from_str::<serde_json::Value>(raw)
        .and_then(|value| serde_json::to_string_pretty(&value))
        .unwrap_or_else(|_| raw.to_string())
}

fn format_decimal(value: f64) -> String {
    format!("{value:.3}")
}

#[cfg(test)]
mod tests {
    use super::{build_projection_scene, dimension_samples, embedding_coordinates, short_chunk_label};
    use starbridge_core::MemoryEmbeddingRecord;

    #[test]
    fn embedding_coordinates_split_dimensions_across_three_axes() {
        let coordinates = embedding_coordinates(&[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
        assert!((coordinates.0 - 0.25).abs() < 1e-9);
        assert!((coordinates.1 - 0.35).abs() < 1e-9);
        assert!((coordinates.2 - 0.45).abs() < 1e-9);
    }

    #[test]
    fn build_projection_scene_keeps_points_in_stage_bounds() {
        let scene = build_projection_scene(
            &[
                MemoryEmbeddingRecord {
                    embedding_id: "embedding-a".to_string(),
                    chunk_id: "chunk-a".to_string(),
                    agent_id: "agent".to_string(),
                    namespace: "cadet/test".to_string(),
                    model: "deterministic".to_string(),
                    dimensions: 6,
                    vector: vec![0.1, 0.4, 0.3, 0.6, 0.2, 0.5],
                    checksum: "a".to_string(),
                    created_at_micros: 1,
                },
                MemoryEmbeddingRecord {
                    embedding_id: "embedding-b".to_string(),
                    chunk_id: "chunk-b".to_string(),
                    agent_id: "agent".to_string(),
                    namespace: "cadet/test".to_string(),
                    model: "deterministic".to_string(),
                    dimensions: 6,
                    vector: vec![0.7, 0.8, 0.2, 0.5, 0.3, 0.9],
                    checksum: "b".to_string(),
                    created_at_micros: 2,
                },
            ],
            Some("chunk-b"),
        );

        assert_eq!(scene.points.len(), 2);
        assert!(scene.points.iter().all(|point| (10.0..=90.0).contains(&point.x_pct)));
        assert!(scene.points.iter().all(|point| (14.0..=86.0).contains(&point.y_pct)));
        assert!(scene.points.iter().any(|point| point.active));
        assert_eq!(short_chunk_label("chunk-42"), "V42");
    }

    #[test]
    fn dimension_samples_preserve_small_non_zero_dimensions() {
        let samples = dimension_samples(&[0.1, 0.2, 0.05], 8);
        assert_eq!(samples.len(), 3);
        assert!(samples.iter().all(|sample| sample.height_pct >= 6.0));
    }
}
