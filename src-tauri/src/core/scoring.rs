use chrono::{DateTime, Utc};

use crate::core::search::{bm25_score, build_doc_freq, l0_keyword_score, tag_match_score};
use crate::core::types::{Memory, MemoryType, ScoreBreakdown};

/// Compute the hybrid score for a memory given a query.
/// Weights: semantic=0.30, bm25=0.15, recency=0.15, importance=0.20, access_freq=0.10, graph_prox=0.10
pub fn compute_score(
    query: &str,
    memory: &Memory,
    all_memories: &[Memory],
    selected_ids: &[String],
    now: DateTime<Utc>,
) -> ScoreBreakdown {
    let semantic = semantic_score_free(query, memory);
    let bm25 = compute_bm25(query, memory, all_memories);
    let recency = recency_score(&memory.meta.last_access, now);
    let importance = memory.meta.importance;
    let access_frequency = access_frequency_score(memory.meta.access_count, max_access_count(all_memories));
    let graph_proximity = graph_proximity_score(memory, selected_ids);

    let final_score = 0.30 * semantic
        + 0.15 * bm25
        + 0.15 * recency
        + 0.20 * importance
        + 0.10 * access_frequency
        + 0.10 * graph_proximity;

    ScoreBreakdown {
        semantic,
        bm25,
        recency,
        importance,
        access_frequency,
        graph_proximity,
        final_score,
    }
}

/// Free-tier semantic approximation:
/// 40% tag matching + 35% L0 keyword overlap + 25% type bonus
fn semantic_score_free(query: &str, memory: &Memory) -> f64 {
    let tag_score = tag_match_score(query, &memory.meta.tags);
    let l0_score = l0_keyword_score(query, &memory.meta.l0);
    let type_bonus = type_bonus_score(query, &memory.meta.memory_type);

    0.40 * tag_score + 0.35 * l0_score + 0.25 * type_bonus
}

/// Heuristic type bonus — if query seems to match a type category, boost it.
fn type_bonus_score(query: &str, memory_type: &MemoryType) -> f64 {
    let q = query.to_lowercase();
    let code_terms = ["code", "coding", "debug", "function", "api", "bug", "test", "programa", "código"];
    let writing_terms = ["write", "post", "article", "blog", "linkedin", "newsletter", "escrib", "redact"];
    let analysis_terms = ["analy", "research", "compet", "market", "investig", "tendencia"];

    match memory_type {
        MemoryType::Skill | MemoryType::Rule => {
            if code_terms.iter().any(|t| q.contains(t)) {
                return 0.8;
            }
            if writing_terms.iter().any(|t| q.contains(t)) {
                return 0.8;
            }
            0.3
        }
        MemoryType::Context => {
            0.4 // Generally useful
        }
        MemoryType::Intelligence => {
            if analysis_terms.iter().any(|t| q.contains(t)) {
                return 0.9;
            }
            0.2
        }
        MemoryType::Project => {
            0.3
        }
        _ => 0.1,
    }
}

/// BM25 score using all memories as corpus.
fn compute_bm25(query: &str, memory: &Memory, all_memories: &[Memory]) -> f64 {
    let documents: Vec<&str> = all_memories
        .iter()
        .map(|m| m.raw_content.as_str())
        .collect();

    if documents.is_empty() {
        return 0.0;
    }

    let avg_len = documents.iter().map(|d| d.split_whitespace().count()).sum::<usize>() as f64 / documents.len() as f64;
    let doc_freq = build_doc_freq(&documents);
    let content = format!("{} {} {}", memory.meta.l0, memory.l1_content, memory.l2_content);

    let raw = bm25_score(query, &content, avg_len, documents.len(), &doc_freq);
    // Normalize to 0-1 range (cap at 10)
    (raw / 10.0).min(1.0)
}

/// Recency score: exp(-0.05 * days_since_last_access)
fn recency_score(last_access: &DateTime<Utc>, now: DateTime<Utc>) -> f64 {
    let days = (now - *last_access).num_hours() as f64 / 24.0;
    (-0.05 * days).exp()
}

/// Normalized access frequency: log(1 + count) / log(1 + max_count)
fn access_frequency_score(access_count: u32, max_count: u32) -> f64 {
    if max_count == 0 {
        return 0.0;
    }
    (1.0 + access_count as f64).ln() / (1.0 + max_count as f64).ln()
}

fn max_access_count(memories: &[Memory]) -> u32 {
    memories.iter().map(|m| m.meta.access_count).max().unwrap_or(1)
}

/// Graph proximity: how many of the selected memories are in this memory's `related` field.
fn graph_proximity_score(memory: &Memory, selected_ids: &[String]) -> f64 {
    if selected_ids.is_empty() {
        return 0.0;
    }
    let matches = memory
        .meta
        .related
        .iter()
        .filter(|r| selected_ids.contains(r))
        .count();
    (matches as f64 / selected_ids.len() as f64).min(1.0)
}
