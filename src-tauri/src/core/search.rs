use std::collections::{HashMap, HashSet};

/// Common Spanish and English stopwords to exclude from matching.
const STOPWORDS: &[&str] = &[
    "el", "la", "los", "las", "un", "una", "de", "del", "en", "con", "por", "para",
    "que", "es", "y", "o", "a", "the", "is", "in", "of", "and", "to", "for", "a",
    "an", "it", "on", "at", "by", "or", "as", "be", "was", "are", "this", "that",
    "with", "from", "not", "but", "have", "has", "had", "do", "does", "did",
];

/// Tokenize text into lowercase words, filtering stopwords.
pub fn tokenize(text: &str) -> Vec<String> {
    let stopwords: HashSet<&str> = STOPWORDS.iter().copied().collect();
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
        .filter(|w| w.len() > 1 && !stopwords.contains(w))
        .map(|w| w.to_string())
        .collect()
}

/// Simple BM25 scoring for a query against a document.
/// k1 = 1.2, b = 0.75 (standard parameters).
pub fn bm25_score(query: &str, document: &str, avg_doc_len: f64, total_docs: usize, doc_freq: &HashMap<String, usize>) -> f64 {
    let k1 = 1.2;
    let b = 0.75;

    let query_terms = tokenize(query);
    let doc_terms = tokenize(document);
    let doc_len = doc_terms.len() as f64;

    let mut term_counts: HashMap<String, usize> = HashMap::new();
    for term in &doc_terms {
        *term_counts.entry(term.clone()).or_insert(0) += 1;
    }

    let mut score = 0.0;
    for qt in &query_terms {
        let tf = *term_counts.get(qt).unwrap_or(&0) as f64;
        let df = *doc_freq.get(qt).unwrap_or(&0) as f64;

        if tf == 0.0 || df == 0.0 {
            continue;
        }

        let idf = ((total_docs as f64 - df + 0.5) / (df + 0.5) + 1.0).ln();
        let tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * doc_len / avg_doc_len));
        score += idf * tf_norm;
    }

    score
}

/// Score tag overlap between query keywords and memory tags.
/// Returns 0.0 to 1.0.
pub fn tag_match_score(query: &str, tags: &[String]) -> f64 {
    let query_terms: HashSet<String> = tokenize(query).into_iter().collect();
    let tag_terms: HashSet<String> = tags.iter().flat_map(|t| tokenize(t)).collect();

    if query_terms.is_empty() || tag_terms.is_empty() {
        return 0.0;
    }

    let overlap = query_terms.intersection(&tag_terms).count();
    overlap as f64 / query_terms.len().max(1) as f64
}

/// Score keyword overlap between query and L0 summary.
/// Returns 0.0 to 1.0.
pub fn l0_keyword_score(query: &str, l0: &str) -> f64 {
    let query_terms: HashSet<String> = tokenize(query).into_iter().collect();
    let l0_terms: HashSet<String> = tokenize(l0).into_iter().collect();

    if query_terms.is_empty() || l0_terms.is_empty() {
        return 0.0;
    }

    let overlap = query_terms.intersection(&l0_terms).count();
    overlap as f64 / query_terms.len().max(1) as f64
}

/// Build document frequency map from a corpus of documents.
pub fn build_doc_freq(documents: &[&str]) -> HashMap<String, usize> {
    let mut doc_freq: HashMap<String, usize> = HashMap::new();
    for doc in documents {
        let unique_terms: HashSet<String> = tokenize(doc).into_iter().collect();
        for term in unique_terms {
            *doc_freq.entry(term).or_insert(0) += 1;
        }
    }
    doc_freq
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize() {
        let tokens = tokenize("Hello World! This is a test.");
        assert!(tokens.contains(&"hello".to_string()));
        assert!(tokens.contains(&"world".to_string()));
        assert!(tokens.contains(&"test".to_string()));
        assert!(!tokens.contains(&"is".to_string())); // stopword
    }

    #[test]
    fn test_tag_match() {
        let score = tag_match_score("write linkedin post", &["linkedin".into(), "writing".into()]);
        assert!(score > 0.0);
    }
}
