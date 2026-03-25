use std::fs;
use std::path::Path;

use tauri::State;

use crate::core::types::{FileNode, MemoryType};
use crate::state::AppState;

/// Get the file tree of the workspace.
#[tauri::command]
pub fn get_file_tree(state: State<AppState>) -> Result<Vec<FileNode>, String> {
    let root = state.get_root();
    if !root.exists() {
        return Ok(Vec::new());
    }
    let children = read_dir_recursive(&root, 0)?;
    Ok(children)
}

fn read_dir_recursive(dir: &Path, depth: u32) -> Result<Vec<FileNode>, String> {
    if depth > 5 {
        return Ok(Vec::new()); // Prevent infinite recursion
    }

    let mut entries: Vec<FileNode> = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs (except .cache)
        if name.starts_with('.') && name != ".cache" {
            continue;
        }

        // Skip _index.yaml, _config.yaml, claude.md at root level — they're system files
        // but we still show them

        let is_dir = path.is_dir();
        let memory_type = if is_dir {
            MemoryType::from_folder(&name)
        } else {
            None
        };

        let children = if is_dir {
            read_dir_recursive(&path, depth + 1)?
        } else {
            Vec::new()
        };

        entries.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
            memory_type,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(entries)
}

/// Read a file's raw content.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Write raw content to a file.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}
