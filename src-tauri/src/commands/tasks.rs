use chrono::Utc;
use tauri::State;

use crate::core::tasks;
use crate::core::types::{TaskFilter, TaskItem, TaskState};
use crate::state::AppState;

/// List all tasks with optional filtering.
#[tauri::command]
pub fn list_tasks(
    filter: Option<TaskFilter>,
    state: State<AppState>,
) -> Result<Vec<TaskItem>, String> {
    let root = state.get_root();
    tasks::list_tasks(&root, &filter)
}

/// Create a new task.
#[tauri::command]
pub fn create_task(task: TaskItem, state: State<AppState>) -> Result<TaskItem, String> {
    let root = state.get_root();
    let mut t = task;
    if t.id.is_empty() {
        t.id = tasks::generate_task_id();
    }
    t.created = Utc::now();
    t.modified = Utc::now();
    tasks::create_task(&root, &t)?;
    Ok(t)
}

/// Update an existing task.
#[tauri::command]
pub fn update_task(task: TaskItem, state: State<AppState>) -> Result<TaskItem, String> {
    let root = state.get_root();
    let mut t = task;
    t.modified = Utc::now();
    tasks::update_task(&root, &t)?;
    Ok(t)
}

/// Delete a task.
#[tauri::command]
pub fn delete_task(id: String, state: State<AppState>) -> Result<(), String> {
    let root = state.get_root();
    tasks::delete_task(&root, &id)
}

/// Toggle task state (cycle: TODO → IN-PROGRESS → DONE).
#[tauri::command]
pub fn toggle_task_state(id: String, state: State<AppState>) -> Result<TaskItem, String> {
    let root = state.get_root();
    let all_tasks = tasks::list_tasks(&root, &None)?;
    let task = all_tasks
        .into_iter()
        .find(|t| t.id == id)
        .ok_or(format!("Task not found: {}", id))?;

    let new_state = match task.state {
        TaskState::Todo => TaskState::InProgress,
        TaskState::InProgress => TaskState::Done,
        TaskState::Done => TaskState::Todo,
        TaskState::Cancelled => TaskState::Todo,
    };

    let mut updated = task;
    updated.state = new_state;
    updated.modified = Utc::now();
    tasks::update_task(&root, &updated)?;
    Ok(updated)
}

/// Generate a new task ID.
#[tauri::command]
pub fn generate_task_id() -> String {
    tasks::generate_task_id()
}
