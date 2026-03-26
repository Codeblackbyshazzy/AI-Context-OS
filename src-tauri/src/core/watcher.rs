use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use chrono::Utc;
use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use tauri::{AppHandle, Emitter};

use crate::core::types::MemoryMeta;

/// Shared memory index type: id -> (meta, file_path)
pub type MemoryIndex = Arc<RwLock<HashMap<String, (MemoryMeta, String)>>>;

/// Start a file watcher on the workspace directory.
/// Emits Tauri events when files change.
/// When an external process modifies a .md memory file, updates last_access in the index.
#[allow(dead_code)]
pub fn start_watcher(
    root: PathBuf,
    app_handle: AppHandle,
    memory_index: Option<MemoryIndex>,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }

    let (tx, rx) = std::sync::mpsc::channel();

    let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

    debouncer
        .watcher()
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // Spawn a thread to handle events
    std::thread::spawn(move || {
        // Keep debouncer alive
        let _debouncer = debouncer;

        while let Ok(Ok(events)) = rx.recv() {
            for event in events {
                let path_str = event.path.to_string_lossy().to_string();

                // Skip hidden files and .cache
                if path_str.contains("/.cache/") || path_str.contains("\\.cache\\") {
                    continue;
                }
                if path_str.ends_with("/claude.md")
                    || path_str.ends_with("\\claude.md")
                    || path_str.ends_with("/_index.yaml")
                    || path_str.ends_with("\\_index.yaml")
                    || path_str.ends_with("/.cursorrules")
                    || path_str.ends_with("\\.cursorrules")
                    || path_str.ends_with("/.windsurfrules")
                    || path_str.ends_with("\\.windsurfrules")
                {
                    continue;
                }

                // Determine event type
                if event.path.exists() {
                    if path_str.ends_with(".md")
                        || path_str.ends_with(".yaml")
                        || path_str.ends_with(".jsonl")
                    {
                        // Track external access: update last_access in memory index
                        if path_str.ends_with(".md") {
                            if let Some(ref index) = memory_index {
                                if let Ok(mut idx) = index.write() {
                                    let now = Utc::now();
                                    for (_id, (meta, stored_path)) in idx.iter_mut() {
                                        if *stored_path == path_str {
                                            meta.access_count += 1;
                                            meta.last_access = now;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        let _ = app_handle.emit("memory-changed", &path_str);
                    }
                } else {
                    let _ = app_handle.emit("file-deleted", &path_str);
                }
            }
        }
    });

    Ok(())
}
