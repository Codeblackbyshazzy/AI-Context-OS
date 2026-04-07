use std::collections::HashMap;

use chrono::Utc;
use petgraph::graph::{Graph, NodeIndex};
use petgraph::Undirected;

use crate::core::decay::decay_score;
use crate::core::types::{GodNode, GraphData, GraphEdge, GraphNode, Memory, MemoryType};

/// Build an undirected graph from explicit memory relationships (related/requires/optional).
pub fn build_graph(memories: &[Memory]) -> Graph<String, String, Undirected> {
    let mut graph = Graph::<String, String, Undirected>::new_undirected();
    let mut id_to_node: HashMap<String, NodeIndex> = HashMap::new();

    for m in memories {
        let idx = graph.add_node(m.meta.id.clone());
        id_to_node.insert(m.meta.id.clone(), idx);
    }

    for m in memories {
        if let Some(&source) = id_to_node.get(&m.meta.id) {
            for related_id in &m.meta.related {
                if let Some(&target) = id_to_node.get(related_id) {
                    if !graph.contains_edge(source, target) {
                        graph.add_edge(source, target, "related".to_string());
                    }
                }
            }
            for req_id in &m.meta.requires {
                if let Some(&target) = id_to_node.get(req_id) {
                    if !graph.contains_edge(source, target) {
                        graph.add_edge(source, target, "requires".to_string());
                    }
                }
            }
            for opt_id in &m.meta.optional {
                if let Some(&target) = id_to_node.get(opt_id) {
                    if !graph.contains_edge(source, target) {
                        graph.add_edge(source, target, "optional".to_string());
                    }
                }
            }
        }
    }

    graph
}

/// Compute community assignments using Label Propagation Algorithm (LPA).
///
/// Edges include:
///   - Explicit links (related, requires, optional)
///   - Implicit tag co-occurrence: two memories sharing ≥2 tags
///
/// Returns a map from memory_id → community_id (0-indexed, sequential).
/// Isolated nodes (no edges) each get their own singleton community.
pub fn compute_community_map(memories: &[Memory]) -> HashMap<String, u32> {
    let n = memories.len();
    if n == 0 {
        return HashMap::new();
    }

    // Build index map for fast lookup
    let idx_map: HashMap<&str, usize> = memories
        .iter()
        .enumerate()
        .map(|(i, m)| (m.meta.id.as_str(), i))
        .collect();

    // Adjacency list (by index), undirected
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];

    // Explicit edges
    for (i, m) in memories.iter().enumerate() {
        for linked_id in m
            .meta
            .related
            .iter()
            .chain(m.meta.requires.iter())
            .chain(m.meta.optional.iter())
        {
            if let Some(&j) = idx_map.get(linked_id.as_str()) {
                if !adj[i].contains(&j) {
                    adj[i].push(j);
                }
                if !adj[j].contains(&i) {
                    adj[j].push(i);
                }
            }
        }
    }

    // Implicit tag co-occurrence edges (≥2 shared tags)
    for i in 0..n {
        for j in (i + 1)..n {
            let shared = memories[i]
                .meta
                .tags
                .iter()
                .filter(|t| memories[j].meta.tags.contains(t))
                .count();
            if shared >= 2 {
                if !adj[i].contains(&j) {
                    adj[i].push(j);
                }
                if !adj[j].contains(&i) {
                    adj[j].push(i);
                }
            }
        }
    }

    // LPA: initialize each node with its own label (index as label)
    let mut labels: Vec<u32> = (0..n as u32).collect();
    let mut changed = true;
    let mut iterations = 0;

    while changed && iterations < 20 {
        changed = false;
        iterations += 1;

        for i in 0..n {
            if adj[i].is_empty() {
                continue;
            }

            // Count neighbor label frequencies
            let mut freq: HashMap<u32, usize> = HashMap::new();
            for &j in &adj[i] {
                *freq.entry(labels[j]).or_insert(0) += 1;
            }

            // Most frequent label; ties broken by smallest label (deterministic)
            let best_label = freq
                .into_iter()
                .max_by(|a, b| a.1.cmp(&b.1).then(b.0.cmp(&a.0)))
                .map(|(label, _)| label)
                .unwrap();

            if labels[i] != best_label {
                labels[i] = best_label;
                changed = true;
            }
        }
    }

    // Normalize raw labels → sequential 0..k community IDs
    let mut label_to_community: HashMap<u32, u32> = HashMap::new();
    let mut next_id = 0u32;
    let mut result: HashMap<String, u32> = HashMap::new();

    for (i, m) in memories.iter().enumerate() {
        let community_id = *label_to_community.entry(labels[i]).or_insert_with(|| {
            let id = next_id;
            next_id += 1;
            id
        });
        result.insert(m.meta.id.clone(), community_id);
    }

    result
}

/// Compute god nodes: memories whose graph degree (explicit links) significantly
/// exceeds their engineer-assigned importance.
///
/// A memory is a god node if:
///   - mismatch_score = normalized_degree - importance > 0.2, OR
///   - degree ≥ 2 (structurally connected regardless of mismatch)
///
/// Returns up to 20 candidates sorted by mismatch_score descending.
pub fn compute_god_nodes(memories: &[Memory]) -> Vec<GodNode> {
    if memories.is_empty() {
        return Vec::new();
    }

    let graph = build_graph(memories);

    // Build node index → memory lookup
    let id_map: HashMap<&str, &Memory> =
        memories.iter().map(|m| (m.meta.id.as_str(), m)).collect();

    let max_degree = graph
        .node_indices()
        .map(|n| graph.neighbors(n).count())
        .max()
        .unwrap_or(1)
        .max(1);

    let mut god_nodes: Vec<GodNode> = Vec::new();

    for node_idx in graph.node_indices() {
        let id = graph[node_idx].as_str();
        let degree = graph.neighbors(node_idx).count();

        let Some(memory) = id_map.get(id) else {
            continue;
        };

        let normalized_degree = degree as f64 / max_degree as f64;
        let mismatch_score = normalized_degree - memory.meta.importance;

        if mismatch_score > 0.2 || degree >= 2 {
            god_nodes.push(GodNode {
                memory_id: id.to_string(),
                l0: memory.meta.l0.clone(),
                memory_type: memory.meta.memory_type.clone(),
                degree,
                importance: memory.meta.importance,
                mismatch_score,
            });
        }
    }

    god_nodes.sort_by(|a, b| {
        b.mismatch_score
            .partial_cmp(&a.mismatch_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.degree.cmp(&a.degree))
    });

    god_nodes.truncate(20);
    god_nodes
}

/// Convert the petgraph graph + memories into serializable GraphData for the frontend.
/// Includes community assignment computed via LPA.
pub fn to_graph_data(memories: &[Memory], _decay_threshold: f64) -> GraphData {
    let graph = build_graph(memories);
    let community_map = compute_community_map(memories);

    let id_map: HashMap<&str, &Memory> =
        memories.iter().map(|m| (m.meta.id.as_str(), m)).collect();

    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    for node_idx in graph.node_indices() {
        let id = graph[node_idx].as_str();
        if let Some(memory) = id_map.get(id) {
            let days_since_last_access =
                (Utc::now() - memory.meta.last_access).num_hours() as f64 / 24.0;
            nodes.push(GraphNode {
                id: id.to_string(),
                label: memory.meta.l0.clone(),
                memory_type: memory.meta.memory_type.clone(),
                importance: memory.meta.importance,
                decay_score: decay_score(
                    memory.meta.decay_rate,
                    memory.meta.access_count,
                    days_since_last_access.max(0.0),
                ),
                community: community_map.get(id).copied(),
            });
        }
    }

    for edge_idx in graph.edge_indices() {
        let (source_idx, target_idx) = graph.edge_endpoints(edge_idx).unwrap();
        let edge_type = graph[edge_idx].clone();
        edges.push(GraphEdge {
            source: graph[source_idx].clone(),
            target: graph[target_idx].clone(),
            edge_type,
        });
    }

    GraphData { nodes, edges }
}

/// Also expose community map for use by the scoring engine.
/// Accepts &[Memory] directly so the engine doesn't need to re-build the graph.
pub fn get_community_map_for_scoring(memories: &[Memory]) -> HashMap<String, u32> {
    compute_community_map(memories)
}

/// Get the count of connections for a memory (undirected graph degree, explicit links only).
#[allow(dead_code)]
pub fn connection_count(memory_id: &str, memories: &[Memory]) -> usize {
    let graph = build_graph(memories);
    let idx_map: HashMap<&str, NodeIndex> = graph
        .node_indices()
        .map(|n| (graph[n].as_str(), n))
        .collect();

    idx_map
        .get(memory_id)
        .map(|&n| graph.neighbors(n).count())
        .unwrap_or(0)
}
