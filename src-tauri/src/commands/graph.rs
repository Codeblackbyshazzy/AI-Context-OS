use tauri::State;

use crate::core::graph::to_graph_data;
use crate::core::index::scan_memories;
use crate::core::memory::read_memory;
use crate::core::types::GraphData;
use crate::state::AppState;

/// Get graph data for visualization.
#[tauri::command]
pub fn get_graph_data(state: State<AppState>) -> Result<GraphData, String> {
    let root = state.get_root();
    let config = state.config.read().unwrap();
    let all_entries = scan_memories(&root);

    let mut memories = Vec::new();
    for (_meta, path) in &all_entries {
        if let Ok(mem) = read_memory(std::path::Path::new(path)) {
            memories.push(mem);
        }
    }

    Ok(to_graph_data(&memories, config.decay_threshold))
}
