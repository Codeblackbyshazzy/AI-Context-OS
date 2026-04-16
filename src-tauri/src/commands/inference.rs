use std::fs;
use std::path::Path;
use reqwest::{header, Client};
use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;
use crate::core::paths::SystemPaths;
use crate::core::types::{
    ChatCompletionRequest, ChatCompletionResponse, ChatMessage, DiscoveredProvider,
    InferenceCapability, InferenceProviderConfig, InferenceProviderKind, InferenceProviderPreset,
    InferenceProviderStatus, ProviderModel,
};

const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434/v1";
const DEFAULT_LM_STUDIO_BASE_URL: &str = "http://127.0.0.1:1234/v1";
const DEFAULT_ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com";

pub fn load_provider_config(root: &Path) -> Result<Option<InferenceProviderConfig>, String> {
    let path = SystemPaths::new(root).inference_provider_json();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read inference provider config: {}", e))?;
    let config = serde_json::from_str::<InferenceProviderConfig>(&raw)
        .map_err(|e| format!("Failed to parse inference provider config: {}", e))?;
    Ok(Some(normalize_provider_config(config)))
}

pub fn persist_provider_config(root: &Path, config: &InferenceProviderConfig) -> Result<InferenceProviderConfig, String> {
    let path = SystemPaths::new(root).inference_provider_json();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create provider config directory: {}", e))?;
    }
    let normalized = normalize_provider_config(config.clone());
    let content = serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("Failed to serialize provider config: {}", e))?;
    fs::write(path, content).map_err(|e| format!("Failed to persist provider config: {}", e))?;
    Ok(normalized)
}

pub fn default_capabilities(preset: &InferenceProviderPreset, kind: &InferenceProviderKind) -> Vec<InferenceCapability> {
    let mut caps = vec![
        InferenceCapability::Proposal,
        InferenceCapability::Classification,
        InferenceCapability::Summary,
        InferenceCapability::Chat,
        InferenceCapability::Streaming,
    ];
    match (kind, preset) {
        (InferenceProviderKind::Anthropic, _) => caps.push(InferenceCapability::Vision),
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::OpenAi)
        | (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::OpenRouter) => {
            caps.push(InferenceCapability::Vision)
        }
        _ => {}
    }
    caps
}

pub fn default_base_url(kind: &InferenceProviderKind, preset: &InferenceProviderPreset) -> Option<String> {
    match (kind, preset) {
        (InferenceProviderKind::Anthropic, _) => Some(DEFAULT_ANTHROPIC_BASE_URL.to_string()),
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::OpenAi) => {
            Some(DEFAULT_OPENAI_BASE_URL.to_string())
        }
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::OpenRouter) => {
            Some(DEFAULT_OPENROUTER_BASE_URL.to_string())
        }
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::Ollama) => {
            Some(DEFAULT_OLLAMA_BASE_URL.to_string())
        }
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::LmStudio) => {
            Some(DEFAULT_LM_STUDIO_BASE_URL.to_string())
        }
        _ => None,
    }
}

pub fn normalize_provider_config(mut config: InferenceProviderConfig) -> InferenceProviderConfig {
    if config.base_url.as_ref().map(|value| value.trim().is_empty()).unwrap_or(true) {
        config.base_url = default_base_url(&config.kind, &config.preset);
    }
    if config.capabilities.is_empty() {
        config.capabilities = default_capabilities(&config.preset, &config.kind);
    }
    config
}

pub fn config_to_status(config: Option<&InferenceProviderConfig>) -> InferenceProviderStatus {
    match config {
        Some(config) => InferenceProviderStatus {
            configured: true,
            enabled: config.enabled,
            healthy: false,
            kind: Some(config.kind.clone()),
            preset: Some(config.preset.clone()),
            base_url: config.base_url.clone(),
            model: Some(config.model.clone()),
            capabilities: config.capabilities.clone(),
            message: if config.enabled {
                "Provider configured. Running live inference is optional and can fall back to heuristics.".to_string()
            } else {
                "Provider saved but disabled. Inbox will use heuristic proposals.".to_string()
            },
        },
        None => InferenceProviderStatus {
            configured: false,
            enabled: false,
            healthy: false,
            kind: None,
            preset: None,
            base_url: None,
            model: None,
            capabilities: Vec::new(),
            message: "No provider configured. Inbox uses deterministic heuristic proposals.".to_string(),
        },
    }
}

pub async fn provider_chat_completion(
    config: &InferenceProviderConfig,
    request: &ChatCompletionRequest,
) -> Result<ChatCompletionResponse, String> {
    let normalized = normalize_provider_config(config.clone());
    if !normalized.enabled {
        return Err("Provider is disabled".to_string());
    }
    match normalized.kind {
        InferenceProviderKind::OpenAiCompatible => openai_compatible_chat(&normalized, request).await,
        InferenceProviderKind::Anthropic => anthropic_chat(&normalized, request).await,
    }
}

pub async fn openai_compatible_chat(
    config: &InferenceProviderConfig,
    request: &ChatCompletionRequest,
) -> Result<ChatCompletionResponse, String> {
    let base_url = config
        .base_url
        .clone()
        .ok_or_else(|| "Missing base URL for OpenAI-compatible provider".to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    
    let timeout_secs = if matches!(config.preset, InferenceProviderPreset::Ollama | InferenceProviderPreset::LmStudio) {
        120
    } else {
        30
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut messages = Vec::new();
    if let Some(system_prompt) = &request.system_prompt {
        messages.push(json!({ "role": "system", "content": system_prompt }));
    }
    messages.extend(request.messages.iter().map(|message| {
        json!({ "role": message.role, "content": message.content })
    }));

    let payload = json!({
        "model": request.model.clone().unwrap_or_else(|| config.model.clone()),
        "messages": messages,
        "temperature": 0.2,
    });

    let mut req = client.post(endpoint).json(&payload);
    if let Some(api_key) = &config.api_key {
        if !api_key.trim().is_empty() {
            req = req.bearer_auth(api_key);
        }
    }
    if matches!(config.preset, InferenceProviderPreset::OpenRouter) {
        req = req.header("HTTP-Referer", "https://github.com/alexdcd/AI-Context-OS");
        req = req.header("X-Title", "AI Context OS");
    }

    let response = req.send().await.map_err(|e| format!("Chat request failed: {}", e))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse chat response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Provider error {}: {}", status, body));
    }

    let text = body
        .get("choices")
        .and_then(|choices| choices.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(|content| clean_json_markdown(content))
        .unwrap_or_default()
        .to_string();

    Ok(ChatCompletionResponse {
        text,
        model: body
            .get("model")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .or_else(|| Some(config.model.clone())),
    })
}

pub async fn anthropic_chat(
    config: &InferenceProviderConfig,
    request: &ChatCompletionRequest,
) -> Result<ChatCompletionResponse, String> {
    let base_url = config
        .base_url
        .clone()
        .unwrap_or_else(|| DEFAULT_ANTHROPIC_BASE_URL.to_string());
    let endpoint = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let api_key = config
        .api_key
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Anthropic requires an API key".to_string())?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let payload = json!({
        "model": request.model.clone().unwrap_or_else(|| config.model.clone()),
        "max_tokens": 1024,
        "temperature": 0.2,
        "system": request.system_prompt.clone().unwrap_or_default(),
        "messages": request.messages.iter().map(|message| {
            json!({
                "role": if message.role == "assistant" { "assistant" } else { "user" },
                "content": [{ "type": "text", "text": message.content }]
            })
        }).collect::<Vec<_>>()
    });

    let response = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Chat request failed: {}", e))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse chat response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Provider error {}: {}", status, body));
    }

    let text = body
        .get("content")
        .and_then(|content| content.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("text"))
        .and_then(|text| text.as_str())
        .map(|content| clean_json_markdown(content))
        .unwrap_or_default()
        .to_string();

    Ok(ChatCompletionResponse {
        text,
        model: body
            .get("model")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .or_else(|| Some(config.model.clone())),
    })
}

fn clean_json_markdown(content: &str) -> String {
    let content = content.trim();
    if content.starts_with("```json") && content.ends_with("```") {
        content[7..content.len() - 3].trim().to_string()
    } else if content.starts_with("```") && content.ends_with("```") {
        content[3..content.len() - 3].trim().to_string()
    } else {
        content.to_string()
    }
}

pub async fn health_check(config: &InferenceProviderConfig) -> Result<String, String> {
    let normalized = normalize_provider_config(config.clone());
    
    if matches!(normalized.preset, InferenceProviderPreset::LmStudio) {
        let _ = load_lm_studio_model(&normalized).await?;
    }

    match normalized.kind {
        InferenceProviderKind::OpenAiCompatible => {
            let base_url = normalized
                .base_url
                .clone()
                .ok_or_else(|| "Missing base URL".to_string())?;
            let endpoint = format!("{}/models", base_url.trim_end_matches('/'));
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
            let mut req = client.get(endpoint);
            if let Some(api_key) = &normalized.api_key {
                if !api_key.trim().is_empty() {
                    req = req.bearer_auth(api_key);
                }
            }
            let response = req.send().await.map_err(|e| format!("Health check failed: {}", e))?;
            if response.status().is_success() {
                Ok("Connection successful".to_string())
            } else {
                Err(format!("Health check returned status {}", response.status()))
            }
        }
        InferenceProviderKind::Anthropic => {
            let _ = anthropic_chat(
                &normalized,
                &ChatCompletionRequest {
                    system_prompt: Some("Reply with OK.".to_string()),
                    model: Some(normalized.model.clone()),
                    messages: vec![ChatMessage {
                        role: "user".to_string(),
                        content: "OK".to_string(),
                    }],
                },
            )
            .await?;
            Ok("Connection successful".to_string())
        }
    }
}

async fn load_lm_studio_model(config: &InferenceProviderConfig) -> Result<(), String> {
    let base_url = config.base_url.clone().ok_or_else(|| "Missing base URL".to_string())?;
    let endpoint = format!("{}/model/load", base_url.trim_end_matches('/'));
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
    
    let payload = json!({
        "model": config.model.clone(),
    });

    let _ = client.post(endpoint).json(&payload).send().await
        .map_err(|e| format!("Failed to trigger LM Studio model load: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_inference_provider_config(state: State<AppState>) -> Result<Option<InferenceProviderConfig>, String> {
    load_provider_config(&state.get_root())
}

#[tauri::command]
pub fn save_inference_provider_config(
    config: InferenceProviderConfig,
    state: State<AppState>,
) -> Result<InferenceProviderConfig, String> {
    persist_provider_config(&state.get_root(), &config)
}

#[tauri::command]
pub fn get_inference_provider_status(state: State<AppState>) -> Result<InferenceProviderStatus, String> {
    let root = state.get_root();
    let config = load_provider_config(&root)?;
    Ok(config_to_status(config.as_ref()))
}

#[tauri::command]
pub async fn test_inference_provider(
    config: Option<InferenceProviderConfig>,
    state: State<'_, AppState>,
) -> Result<InferenceProviderStatus, String> {
    let root = state.get_root();
    let config = match config {
        Some(config) => normalize_provider_config(config),
        None => load_provider_config(&root)?.ok_or_else(|| "No provider configured".to_string())?,
    };
    let message = health_check(&config).await?;
    Ok(InferenceProviderStatus {
        configured: true,
        enabled: config.enabled,
        healthy: true,
        kind: Some(config.kind.clone()),
        preset: Some(config.preset.clone()),
        base_url: config.base_url.clone(),
        model: Some(config.model.clone()),
        capabilities: config.capabilities.clone(),
        message,
    })
}

#[tauri::command]
pub async fn chat_completion(
    request: ChatCompletionRequest,
    state: State<'_, AppState>,
) -> Result<ChatCompletionResponse, String> {
    let root = state.get_root();
    let config = load_provider_config(&root)?
        .ok_or_else(|| "No provider configured".to_string())?;
    provider_chat_completion(&config, &request).await
}

#[tauri::command]
pub async fn discover_local_providers() -> Result<Vec<DiscoveredProvider>, String> {
    let mut discovered = Vec::new();
    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    if let Ok(resp) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if resp.status().is_success() {
            discovered.push(DiscoveredProvider {
                preset: InferenceProviderPreset::Ollama,
                base_url: DEFAULT_OLLAMA_BASE_URL.to_string(),
                available: true,
                kind: InferenceProviderKind::OpenAiCompatible,
            });
        }
    }

    if let Ok(resp) = client.get("http://127.0.0.1:1234/v1/models").send().await {
        if resp.status().is_success() {
            discovered.push(DiscoveredProvider {
                preset: InferenceProviderPreset::LmStudio,
                base_url: DEFAULT_LM_STUDIO_BASE_URL.to_string(),
                available: true,
                kind: InferenceProviderKind::OpenAiCompatible,
            });
        }
    }

    Ok(discovered)
}

#[tauri::command]
pub async fn list_provider_models(
    kind: InferenceProviderKind,
    preset: InferenceProviderPreset,
    base_url: String,
) -> Result<Vec<ProviderModel>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    match (kind, preset) {
        (InferenceProviderKind::OpenAiCompatible, InferenceProviderPreset::Ollama) => {
            let ollama_api = base_url.replace("/v1", "/api/tags");
            let resp = client.get(ollama_api).send().await
                .map_err(|e| format!("Failed to fetch Ollama models: {}", e))?;
            let body: Value = resp.json().await.map_err(|e| format!("Invalid JSON from Ollama: {}", e))?;
            let mut models = Vec::new();
            if let Some(list) = body.get("models").and_then(|m| m.as_array()) {
                for m in list {
                    if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                        models.push(ProviderModel {
                            id: name.to_string(),
                            name: name.to_string(),
                        });
                    }
                }
            }
            Ok(models)
        }
        (InferenceProviderKind::OpenAiCompatible, _) => {
            let endpoint = format!("{}/models", base_url.trim_end_matches('/'));
            let resp = client.get(endpoint).send().await
                .map_err(|e| format!("Failed to fetch models from {}: {}", base_url, e))?;
            let body: Value = resp.json().await.map_err(|e| format!("Invalid JSON from provider: {}", e))?;
            let mut models = Vec::new();
            if let Some(list) = body.get("data").and_then(|d| d.as_array()) {
                for m in list {
                    if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                        models.push(ProviderModel {
                            id: id.to_string(),
                            name: id.to_string(),
                        });
                    }
                }
            }
            Ok(models)
        }
        _ => Err("Model listing only supported for local providers".to_string()),
    }
}
