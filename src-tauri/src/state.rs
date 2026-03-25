use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;

use crate::core::types::{Config, MemoryMeta};

pub struct AppState {
    pub root_dir: RwLock<PathBuf>,
    pub memory_index: RwLock<HashMap<String, (MemoryMeta, String)>>, // id -> (meta, file_path)
    pub config: RwLock<Config>,
}

impl AppState {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let root = home.join("AI-Context-OS");

        Self {
            root_dir: RwLock::new(root),
            memory_index: RwLock::new(HashMap::new()),
            config: RwLock::new(Config {
                root_dir: "~/AI-Context-OS".to_string(),
                default_token_budget: 4000,
                decay_threshold: 0.1,
                scratch_ttl_days: 7,
                active_tools: vec!["claude".to_string()],
            }),
        }
    }

    pub fn get_root(&self) -> PathBuf {
        self.root_dir.read().unwrap().clone()
    }
}
