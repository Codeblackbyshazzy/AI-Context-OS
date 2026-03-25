use tauri::State;

use crate::core::journal;
use crate::core::types::{JournalDateInfo, JournalPage};
use crate::state::AppState;

/// Get a journal page for a specific date.
#[tauri::command]
pub fn get_journal_page(date: String, state: State<AppState>) -> Result<JournalPage, String> {
    let root = state.get_root();
    if !journal::validate_date(&date) {
        return Err(format!("Invalid date format: {}", date));
    }
    journal::read_journal_page(&root, &date)
}

/// Save journal page content for a specific date.
#[tauri::command]
pub fn save_journal_page(
    date: String,
    content: String,
    state: State<AppState>,
) -> Result<String, String> {
    let root = state.get_root();
    if !journal::validate_date(&date) {
        return Err(format!("Invalid date format: {}", date));
    }
    journal::save_journal_page(&root, &date, &content)
}

/// List all journal dates with metadata.
#[tauri::command]
pub fn list_journal_dates(state: State<AppState>) -> Result<Vec<JournalDateInfo>, String> {
    let root = state.get_root();
    journal::list_journal_dates(&root)
}

/// Get today's date string.
#[tauri::command]
pub fn get_today() -> String {
    journal::today_str()
}
