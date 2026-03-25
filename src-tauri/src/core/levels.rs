/// Split body content into L1 and L2 sections.
/// L1: content between <!-- L1 --> and <!-- L2 --> markers
/// L2: content after <!-- L2 --> marker
pub fn split_levels(body: &str) -> (String, String) {
    let l1_marker = "<!-- L1 -->";
    let l2_marker = "<!-- L2 -->";

    let l1_start = body.find(l1_marker);
    let l2_start = body.find(l2_marker);

    match (l1_start, l2_start) {
        (Some(l1_pos), Some(l2_pos)) => {
            let l1 = body[l1_pos + l1_marker.len()..l2_pos]
                .trim()
                .to_string();
            let l2 = body[l2_pos + l2_marker.len()..].trim().to_string();
            (l1, l2)
        }
        (Some(l1_pos), None) => {
            let l1 = body[l1_pos + l1_marker.len()..].trim().to_string();
            (l1, String::new())
        }
        (None, Some(l2_pos)) => {
            let before = body[..l2_pos].trim().to_string();
            let l2 = body[l2_pos + l2_marker.len()..].trim().to_string();
            (before, l2)
        }
        (None, None) => {
            // No markers — treat everything as L1
            (body.trim().to_string(), String::new())
        }
    }
}

/// Reconstruct body with level markers from L1 and L2 content.
pub fn join_levels(l1: &str, l2: &str) -> String {
    let mut body = String::new();
    body.push_str("<!-- L1 -->\n");
    body.push_str(l1);
    if !l2.is_empty() {
        body.push_str("\n\n<!-- L2 -->\n");
        body.push_str(l2);
    }
    body.push('\n');
    body
}

/// Estimate token count from text using simple heuristic: words × 1.3
pub fn estimate_tokens(text: &str) -> u32 {
    let word_count = text.split_whitespace().count();
    (word_count as f64 * 1.3).ceil() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_levels() {
        let body = "<!-- L1 -->\nThis is L1.\n\n<!-- L2 -->\n## Full\nThis is L2.";
        let (l1, l2) = split_levels(body);
        assert_eq!(l1, "This is L1.");
        assert_eq!(l2, "## Full\nThis is L2.");
    }

    #[test]
    fn test_no_markers() {
        let body = "Just plain text content.";
        let (l1, l2) = split_levels(body);
        assert_eq!(l1, "Just plain text content.");
        assert!(l2.is_empty());
    }

    #[test]
    fn test_estimate_tokens() {
        assert_eq!(estimate_tokens("hello world"), 3); // 2 words * 1.3 = 2.6 → 3
    }
}
