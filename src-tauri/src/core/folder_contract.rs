use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::core::types::MemoryMeta;

/// Lifecycle policy for memories stored in a folder.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FolderLifecycle {
    /// Temporary staging area — memories are expected to be promoted or discarded.
    Transient,
    /// Normal long-lived memories.
    Permanent,
    /// Original reference material — should not be modified after ingestion.
    Immutable,
}

/// Declarative contract for a workspace folder.
/// Stored as `.folder.yaml` in the folder root.
/// Folders without a contract are treated as plain user folders — no restrictions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderContract {
    /// Short role identifier (e.g. "inbox", "skill", "rule", "source").
    pub role: String,
    /// Human-readable description of the folder's purpose.
    pub description: String,
    /// Lifecycle policy for memories in this folder.
    pub lifecycle: FolderLifecycle,
    /// Whether the scanner should index .md files here as memories.
    #[serde(default = "default_true")]
    pub scannable: bool,
    /// Whether MCP save_memory is allowed to write here.
    #[serde(default = "default_true")]
    pub writable_by_mcp: bool,
    /// Frontmatter fields that must be present and non-empty.
    #[serde(default)]
    pub required_fields: Vec<String>,
    /// Frontmatter fields that are valid but optional.
    #[serde(default)]
    pub optional_fields: Vec<String>,
    /// Default values applied when a memory is created in this folder.
    #[serde(default)]
    pub default_values: HashMap<String, serde_yaml::Value>,
}

fn default_true() -> bool {
    true
}

/// Load the folder contract for a given directory, if one exists.
/// Returns None for plain user folders (no .folder.yaml).
pub fn load_folder_contract(dir: &Path) -> Option<FolderContract> {
    let contract_path = dir.join(".folder.yaml");
    if !contract_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&contract_path).ok()?;
    serde_yaml::from_str(&content).ok()
}

/// Check whether a memory's metadata satisfies the required fields declared in a contract.
/// Returns a list of violation messages (empty = valid).
/// Unknown field names are silently ignored — forward-compatible.
pub fn check_required_fields(meta: &MemoryMeta, contract: &FolderContract) -> Vec<String> {
    let mut violations = Vec::new();
    for field in &contract.required_fields {
        let ok = match field.as_str() {
            "id" => !meta.id.is_empty(),
            "type" => true, // enum — always present
            "l0" => !meta.l0.is_empty(),
            "status" => meta.status.is_some(),
            "triggers" => !meta.triggers.is_empty(),
            "confidence" => true, // always has a default value
            "importance" => true, // always has a default value
            _ => true,            // unknown fields pass — forward-compatible
        };
        if !ok {
            violations.push(format!("required field '{}' is missing or empty", field));
        }
    }
    violations
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::types::{MemoryMeta, MemoryOntology};
    use chrono::Utc;

    fn make_meta(id: &str) -> MemoryMeta {
        MemoryMeta {
            id: id.to_string(),
            ontology: MemoryOntology::Concept,
            l0: "test summary".to_string(),
            importance: 0.5,
            decay_rate: 0.998,
            last_access: Utc::now(),
            access_count: 0,
            confidence: 0.9,
            tags: vec![],
            related: vec![],
            created: Utc::now(),
            modified: Utc::now(),
            version: 1,
            triggers: vec![],
            requires: vec![],
            optional: vec![],
            output_format: None,
            status: None,
            protected: false,
            derived_from: vec![],
            folder_category: None,
            system_role: None,
        }
    }

    fn inbox_contract() -> FolderContract {
        FolderContract {
            role: "inbox".to_string(),
            description: "Staging area".to_string(),
            lifecycle: FolderLifecycle::Transient,
            scannable: true,
            writable_by_mcp: true,
            required_fields: vec![
                "id".to_string(),
                "type".to_string(),
                "l0".to_string(),
                "status".to_string(),
            ],
            optional_fields: vec![],
            default_values: HashMap::new(),
        }
    }

    #[test]
    fn valid_memory_passes_inbox_contract() {
        let mut meta = make_meta("my-note");
        meta.status = Some(crate::core::types::MemoryStatus::Unprocessed);
        let violations = check_required_fields(&meta, &inbox_contract());
        assert!(violations.is_empty());
    }

    #[test]
    fn missing_status_fails_inbox_contract() {
        let meta = make_meta("my-note"); // status = None
        let violations = check_required_fields(&meta, &inbox_contract());
        assert_eq!(violations.len(), 1);
        assert!(violations[0].contains("status"));
    }

    #[test]
    fn skill_contract_requires_triggers() {
        let contract = FolderContract {
            role: "skill".to_string(),
            description: "Skills".to_string(),
            lifecycle: FolderLifecycle::Permanent,
            scannable: true,
            writable_by_mcp: true,
            required_fields: vec!["id".to_string(), "l0".to_string(), "triggers".to_string()],
            optional_fields: vec![],
            default_values: HashMap::new(),
        };
        let meta = make_meta("my-skill"); // triggers = []
        let violations = check_required_fields(&meta, &contract);
        assert_eq!(violations.len(), 1);
        assert!(violations[0].contains("triggers"));
    }

    #[test]
    fn unknown_required_field_is_ignored() {
        let contract = FolderContract {
            role: "custom".to_string(),
            description: "Custom".to_string(),
            lifecycle: FolderLifecycle::Permanent,
            scannable: true,
            writable_by_mcp: true,
            required_fields: vec!["future_field".to_string()],
            optional_fields: vec![],
            default_values: HashMap::new(),
        };
        let meta = make_meta("my-note");
        let violations = check_required_fields(&meta, &contract);
        assert!(violations.is_empty(), "unknown fields should pass silently");
    }
}
