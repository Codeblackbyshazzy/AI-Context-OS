use tauri::State;

use crate::core::jsonl::{append_jsonl, read_jsonl};
use crate::core::types::DailyEntry;
use crate::state::AppState;

/// Get daily log entries.
#[tauri::command]
pub fn get_daily_entries(
    date: Option<String>,
    state: State<AppState>,
) -> Result<Vec<DailyEntry>, String> {
    let root = state.get_root();
    let daily_path = crate::core::paths::SystemPaths::new(&root).daily_log();

    let entries: Vec<DailyEntry> = read_jsonl(&daily_path)?;

    if let Some(date_str) = date {
        Ok(entries
            .into_iter()
            .filter(|e| e.timestamp.format("%Y-%m-%d").to_string() == date_str)
            .collect())
    } else {
        Ok(entries)
    }
}

/// Append a new entry to the daily log.
#[tauri::command]
pub fn append_daily_entry(entry: DailyEntry, state: State<AppState>) -> Result<(), String> {
    let root = state.get_root();
    let daily_path = crate::core::paths::SystemPaths::new(&root).daily_log();
    append_jsonl(&daily_path, &entry)
}
