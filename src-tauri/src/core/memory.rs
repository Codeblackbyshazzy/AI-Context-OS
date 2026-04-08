use std::fs;
use std::path::Path;

use crate::core::frontmatter::{parse_frontmatter, serialize_frontmatter};
use crate::core::levels::{join_levels, split_levels};
use crate::core::paths::enrich_memory_meta;
use crate::core::types::Memory;

/// Read a Memory from a .md file on disk.
pub fn read_memory(root: &Path, path: &Path) -> Result<Memory, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let (mut meta, body) = parse_frontmatter(&raw)
        .map_err(|e| format!("Failed to parse frontmatter in {}: {}", path.display(), e))?;
    enrich_memory_meta(&mut meta, path, root);

    let (l1, l2) = split_levels(&body);

    Ok(Memory {
        meta,
        l1_content: l1,
        l2_content: l2,
        raw_content: body,
        file_path: path.to_string_lossy().to_string(),
    })
}

/// Write a Memory to a .md file on disk.
pub fn write_memory(path: &Path, memory: &Memory) -> Result<(), String> {
    let body = join_levels(&memory.l1_content, &memory.l2_content);
    let content = serialize_frontmatter(&memory.meta, &body)
        .map_err(|e| format!("Failed to serialize memory: {}", e))?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, content).map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    Ok(())
}
