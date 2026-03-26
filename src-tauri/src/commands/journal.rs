use chrono::Utc;
use regex::Regex;
use tauri::State;

use crate::core::journal;
use crate::core::jsonl::append_jsonl;
use crate::core::tasks;
use crate::core::types::{DailyEntry, JournalDateInfo, JournalPage, TaskItem, TaskState};
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
    let task_re = Regex::new(r"^-\s*\[\s*\]\s+(.+)$").unwrap();
    let daily_path = root.join("02-daily/daily-log.jsonl");
    let now = Utc::now();

    for line in content.lines() {
        let trimmed = line.trim();

        // Extract tasks from `- [ ] text` checkboxes
        if let Some(caps) = task_re.captures(trimmed) {
            let title = caps[1].trim().to_string();
            if !title.is_empty() {
                // Check if a task with this exact title already exists
                let existing = tasks::list_tasks(&root, &None).unwrap_or_default();
                let already_exists = existing.iter().any(|t| t.title == title);
                if !already_exists {
                    let task = TaskItem {
                        id: tasks::generate_task_id(),
                        title,
                        state: TaskState::Todo,
                        priority: None,
                        tags: vec![],
                        source_date: Some(date.clone()),
                        source_file: None,
                        created: now,
                        modified: now,
                        notes: String::new(),
                        due: None,
                    };
                    let _ = tasks::create_task(&root, &task);
                }
            }
        }

        // Extract typed bullets to JSONL
        let bullet = trimmed.trim_start_matches('-').trim();
        if let Some(caps) = tag_re.find(bullet) {
            let entry_type = caps.as_str().trim_start_matches('#').to_string();
            let summary = tag_re.replace_all(bullet, "").trim().to_string();
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
