use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

use serde::de::DeserializeOwned;
use serde::Serialize;

/// Read JSONL file, skipping the first line (schema definition).
pub fn read_jsonl<T: DeserializeOwned>(path: &Path) -> Result<Vec<T>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file =
        fs::File::open(path).map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for (i, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Skip first line (schema)
        if i == 0 && trimmed.starts_with("{\"_schema\"") {
            continue;
        }
        match serde_json::from_str::<T>(trimmed) {
            Ok(entry) => entries.push(entry),
            Err(_) => continue, // Skip malformed lines
        }
    }

    Ok(entries)
}

/// Append a single entry to a JSONL file.
pub fn append_jsonl<T: Serialize>(path: &Path, entry: &T) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let json = serde_json::to_string(entry).map_err(|e| format!("Failed to serialize: {}", e))?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;

    writeln!(file, "{}", json).map_err(|e| format!("Failed to write: {}", e))?;

    Ok(())
}

/// Create a new JSONL file with a schema line.
pub fn create_jsonl_with_schema(path: &Path, schema: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let schema_line = format!("{{\"_schema\": \"{}\"}}\n", schema);
    fs::write(path, schema_line)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    Ok(())
}
