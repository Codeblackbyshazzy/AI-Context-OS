use chrono::Utc;
use regex::Regex;
use tauri::State;

use crate::core::journal;
use crate::core::jsonl::append_jsonl;
use crate::core::types::{DailyEntry, JournalDateInfo, JournalPage};
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
/// Also extracts typed bullets (#decision, #idea, #meeting, etc.) → daily-log.jsonl
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
    let result = journal::save_journal_page(&root, &date, &content)?;

    // Extract typed bullets and append to daily-log.jsonl
    let tag_re = Regex::new(r"#(decision|idea|meeting|goal|blocker|insight|question)")
        .unwrap();
    let daily_path = root.join("02-daily/daily-log.jsonl");
    let now = Utc::now();

    for line in content.lines() {
        let trimmed = line.trim().trim_start_matches('-').trim();
        if let Some(caps) = tag_re.find(trimmed) {
            let entry_type = caps.as_str().trim_start_matches('#').to_string();
            let summary = tag_re.replace_all(trimmed, "").trim().to_string();
            if !summary.is_empty() {
                let entry = DailyEntry {
                    timestamp: now,
                    entry_type,
                    summary,
                    tags: vec![],
                    source: format!("journal:{}", date),
                };
                let _ = append_jsonl(&daily_path, &entry);
            }
        }
    }

    Ok(result)
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
