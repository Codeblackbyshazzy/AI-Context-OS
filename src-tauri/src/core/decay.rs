/// Calculate the effective decay rate based on the Ebbinghaus-modified formula.
/// effective_decay = base_decay_rate ^ (1 / (1 + 0.1 * access_count))
/// More access = slower decay.
pub fn effective_decay(base_rate: f64, access_count: u32) -> f64 {
    let exponent = 1.0 / (1.0 + 0.1 * access_count as f64);
    base_rate.powf(exponent)
}

/// Calculate the current decay score of a memory.
/// decay_score = effective_decay ^ days_since_last_access
pub fn decay_score(base_rate: f64, access_count: u32, days_since_last_access: f64) -> f64 {
    let rate = effective_decay(base_rate, access_count);
    rate.powf(days_since_last_access)
}

/// Check if a memory should be flagged for archival based on decay.
pub fn should_archive(base_rate: f64, access_count: u32, days_since: f64, threshold: f64) -> bool {
    decay_score(base_rate, access_count, days_since) < threshold
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_effective_decay_high_access() {
        // High access count → decay rate closer to 1 (slower decay)
        let rate = effective_decay(0.995, 50);
        assert!(rate > 0.999);
    }

    #[test]
    fn test_effective_decay_low_access() {
        // Low access count → decay rate closer to base
        let rate = effective_decay(0.995, 2);
        assert!(rate < 0.997);
        assert!(rate > 0.994);
    }

    #[test]
    fn test_decay_score() {
        let score = decay_score(0.995, 10, 30.0);
        // After 30 days with moderate access, should still have decent score
        assert!(score > 0.5);
    }
}
