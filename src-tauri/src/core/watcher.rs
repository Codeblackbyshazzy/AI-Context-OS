use std::path::PathBuf;
use std::time::Duration;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_mini::new_debouncer;
use tauri::{AppHandle, Emitter};

/// Start a file watcher on the workspace directory.
/// Emits Tauri events when files change.
#[allow(dead_code)]
pub fn start_watcher(
    root: PathBuf,
    app_handle: AppHandle,
) -> Result<RecommendedWatcher, String> {
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

                // Determine event type
                if event.path.exists() {
                    if path_str.ends_with(".md")
                        || path_str.ends_with(".yaml")
                        || path_str.ends_with(".jsonl")
                    {
                        let _ = app_handle.emit("memory-changed", &path_str);
                    }
                } else {
                    let _ = app_handle.emit("file-deleted", &path_str);
                }
            }
        }
    });

    // Return a dummy watcher to satisfy the return type — the real one lives in the thread
    let watcher = RecommendedWatcher::new(|_| {}, Config::default())
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    Ok(watcher)
}
