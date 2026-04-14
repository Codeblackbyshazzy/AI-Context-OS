use std::fs;
use std::path::Path;

use tauri::{AppHandle, Emitter, State};

use crate::core::compat::{render_claude_adapter, render_cursor_adapter, render_windsurf_adapter};
use crate::core::index::scan_memories;
use crate::core::router::{
    build_router_manifest, generate_index_yaml, render_catalog_markdown, render_static_router,
};
use crate::core::types::{Config, MemoryMeta};
use crate::state::AppState;

fn regenerate_router_files(
    root: &Path,
    config: &Config,
) -> Result<(String, Vec<(MemoryMeta, String)>), String> {
    let all = scan_memories(root);
    let manifest = build_router_manifest(&all, root, config);

    // Generate static adapter bootstrap from the manifest
    let neutral = render_static_router(&manifest);

    // Write adapter artifacts from neutral content
    let claude_md = render_claude_adapter(&neutral);
    fs::write(root.join("claude.md"), &claude_md)
        .map_err(|e| format!("Failed to write claude.md: {}", e))?;

    let cursorrules = render_cursor_adapter(&neutral);
    fs::write(root.join(".cursorrules"), &cursorrules)
        .map_err(|e| format!("Failed to write .cursorrules: {}", e))?;

    let windsurfrules = render_windsurf_adapter(&neutral);
    fs::write(root.join(".windsurfrules"), &windsurfrules)
        .map_err(|e| format!("Failed to write .windsurfrules: {}", e))?;

    // Generate rich catalog/index artifacts (independent of adapters)
    let paths = crate::core::paths::SystemPaths::new(root);
    let index_yaml = generate_index_yaml(&manifest)?;
    fs::write(paths.index_yaml(), &index_yaml)
        .map_err(|e| format!("Failed to write index.yaml: {}", e))?;
    let catalog_md = render_catalog_markdown(&manifest);
    fs::write(paths.catalog_md(), &catalog_md)
        .map_err(|e| format!("Failed to write catalog.md: {}", e))?;

    Ok((claude_md, all))
}

pub fn regenerate_router_internal(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<String, String> {
    let root = state.get_root();
    let config = state.config.read().unwrap().clone();

    let (claude_md, all) = regenerate_router_files(&root, &config)?;

    // Update memory index in state
    let mut index = state.memory_index.write().unwrap();
    index.clear();
    for (meta, path) in all {
        index.insert(meta.id.clone(), (meta, path));
    }

    let _ = app.emit("router-regenerated", ());
    Ok(claude_md)
}

/// Regenerate claude.md, .ai/index.yaml, .cursorrules, .windsurfrules.
#[tauri::command]
pub fn regenerate_router(app: AppHandle, state: State<AppState>) -> Result<String, String> {
    regenerate_router_internal(&app, &state)
}

/// Get the current claude.md content.
#[tauri::command]
pub fn get_router_content(state: State<AppState>) -> Result<String, String> {
    let root = state.get_root();
    let path = root.join("claude.md");

    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read claude.md: {}", e))
    } else {
        Ok("Router not initialized yet.".to_string())
    }
}
