//! Auth provider discovery — finds API keys from keychains, config files, env vars.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProviderStatus {
    Discovered,  // Auto-found from keychain/file/env
    Configured,  // Manually entered by user
    Missing,     // Not found
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProviderCredential {
    pub provider_id: String,
    pub display_name: String,
    pub status: ProviderStatus,
    pub source: String, // "keychain", "env", "config", "manual"
    /// The actual key/token (redacted in UI, full in memory)
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct AuthProviderRegistry {
    pub providers: Vec<ProviderCredential>,
}

impl AuthProviderRegistry {
    /// Discover all available provider credentials.
    /// Strategy pipeline: keychain → config file → env vars → missing
    pub fn discover() -> Self {
        let mut providers = Vec::new();

        // 1. Anthropic / Claude
        providers.push(discover_claude());

        // 2. Vercel AI Gateway (OIDC or API key)
        providers.push(discover_vercel_gateway());

        // 3. OpenRouter
        providers.push(discover_openrouter());

        // 4. OpenAI
        providers.push(discover_openai());

        // 5. Cursor
        providers.push(discover_cursor());

        // 6. Gemini
        providers.push(discover_gemini());

        // 7. GitHub Copilot
        providers.push(discover_copilot());

        // 8. Antigravity
        providers.push(discover_antigravity());

        // 9. Kilo
        providers.push(discover_kilo());

        // 10. Warp
        providers.push(discover_warp());

        // 11. Ollama
        providers.push(discover_ollama());

        // 12. Groq
        providers.push(discover_groq());

        // 13. Mistral
        providers.push(discover_mistral());

        // 14. DeepSeek
        providers.push(discover_deepseek());

        // 15. xAI (Grok)
        providers.push(discover_xai());

        // 16. Together
        providers.push(discover_together());

        // 17. Fireworks
        providers.push(discover_fireworks());

        // 18. Perplexity
        providers.push(discover_perplexity());

        // 19. Cohere
        providers.push(discover_cohere());

        // 20. Amazon Bedrock
        providers.push(discover_bedrock());

        Self { providers }
    }

    pub fn get(&self, provider_id: &str) -> Option<&ProviderCredential> {
        self.providers.iter().find(|p| p.provider_id == provider_id)
    }

    pub fn set_manual(&mut self, provider_id: &str, token: String) {
        if let Some(p) = self
            .providers
            .iter_mut()
            .find(|p| p.provider_id == provider_id)
        {
            p.token = Some(token);
            p.status = ProviderStatus::Configured;
            p.source = "manual".to_string();
        }
    }

    /// Redact tokens for display (show first 8 chars + "...")
    pub fn redacted_token(token: &str) -> String {
        if token.len() > 12 {
            format!("{}...{}", &token[..8], &token[token.len() - 4..])
        } else {
            "****".to_string()
        }
    }
}

fn discover_claude() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "anthropic".to_string(),
        display_name: "Anthropic (Claude)".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: Claude CLI credentials file
    let home = std::env::var("HOME").unwrap_or_default();
    let creds_path = format!("{}/.claude/.credentials.json", home);
    if let Ok(content) = std::fs::read_to_string(&creds_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(key) = json
                .get("oauthToken")
                .or(json.get("apiKey"))
                .and_then(|v| v.as_str())
            {
                cred.token = Some(key.to_string());
                cred.status = ProviderStatus::Discovered;
                cred.source = "~/.claude/.credentials.json".to_string();
                return cred;
            }
        }
    }

    // Strategy 2: ANTHROPIC_API_KEY env var
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "ANTHROPIC_API_KEY env".to_string();
            return cred;
        }
    }

    // Strategy 3: .cadet/config.toml presence hint
    if let Ok(content) = std::fs::read_to_string(".cadet/config.toml") {
        if content.contains("anthropic_api_key") {
            // Basic extraction — full TOML parsing done elsewhere
            cred.source = ".cadet/config.toml".to_string();
        }
    }

    cred
}

fn discover_vercel_gateway() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "vercel-gateway".to_string(),
        display_name: "Vercel AI Gateway".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: VERCEL_OIDC_TOKEN (auto-provisioned by vercel env pull)
    if let Ok(token) = std::env::var("VERCEL_OIDC_TOKEN") {
        if !token.is_empty() {
            cred.token = Some(token);
            cred.status = ProviderStatus::Discovered;
            cred.source = "VERCEL_OIDC_TOKEN env".to_string();
            return cred;
        }
    }

    // Strategy 2: AI_GATEWAY_API_KEY
    if let Ok(key) = std::env::var("AI_GATEWAY_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "AI_GATEWAY_API_KEY env".to_string();
            return cred;
        }
    }

    // Strategy 3: .env.local file
    if let Ok(content) = std::fs::read_to_string(".env.local") {
        for line in content.lines() {
            if let Some(val) = line.strip_prefix("AI_GATEWAY_API_KEY=") {
                let val = val.trim().trim_matches('"');
                if !val.is_empty() {
                    cred.token = Some(val.to_string());
                    cred.status = ProviderStatus::Discovered;
                    cred.source = ".env.local".to_string();
                    return cred;
                }
            }
        }
    }

    cred
}

fn discover_openrouter() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "openrouter".to_string(),
        display_name: "OpenRouter".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("OPENROUTER_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "OPENROUTER_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_openai() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "openai".to_string(),
        display_name: "OpenAI".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: Codex auth.json
    let home = std::env::var("HOME").unwrap_or_default();
    let codex_path = format!("{}/.codex/auth.json", home);
    if let Ok(content) = std::fs::read_to_string(&codex_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if json.get("token").is_some() || json.get("access_token").is_some() {
                cred.status = ProviderStatus::Discovered;
                cred.source = "~/.codex/auth.json".to_string();
                cred.token = json
                    .get("token")
                    .or(json.get("access_token"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                return cred;
            }
        }
    }

    // Strategy 2: OPENAI_API_KEY env
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "OPENAI_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_cursor() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "cursor".to_string(),
        display_name: "Cursor".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: ~/.cursor/config.json
    let home = std::env::var("HOME").unwrap_or_default();
    let config_path = format!("{}/.cursor/config.json", home);
    if let Ok(content) = std::fs::read_to_string(&config_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(key) = json
                .get("apiKey")
                .or(json.get("api_key"))
                .and_then(|v| v.as_str())
            {
                if !key.is_empty() {
                    cred.token = Some(key.to_string());
                    cred.status = ProviderStatus::Discovered;
                    cred.source = "~/.cursor/config.json".to_string();
                    return cred;
                }
            }
        }
    }

    // Strategy 2: CURSOR_API_KEY env var
    if let Ok(key) = std::env::var("CURSOR_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "CURSOR_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_gemini() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "gemini".to_string(),
        display_name: "Google Gemini".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: ~/.gemini/oauth_creds.json
    let home = std::env::var("HOME").unwrap_or_default();
    let creds_path = format!("{}/.gemini/oauth_creds.json", home);
    if let Ok(content) = std::fs::read_to_string(&creds_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(token) = json
                .get("token")
                .or(json.get("access_token"))
                .and_then(|v| v.as_str())
            {
                if !token.is_empty() {
                    cred.token = Some(token.to_string());
                    cred.status = ProviderStatus::Discovered;
                    cred.source = "~/.gemini/oauth_creds.json".to_string();
                    return cred;
                }
            }
        }
    }

    // Strategy 2: GEMINI_API_KEY env var
    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "GEMINI_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_copilot() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "copilot".to_string(),
        display_name: "GitHub Copilot".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: ~/.config/github-copilot/hosts.json
    let home = std::env::var("HOME").unwrap_or_default();
    let hosts_path = format!("{}/.config/github-copilot/hosts.json", home);
    if let Ok(content) = std::fs::read_to_string(&hosts_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // hosts.json has shape: { "github.com": { "oauth_token": "..." } }
            if let Some(gh) = json.get("github.com") {
                if let Some(token) = gh.get("oauth_token").and_then(|v| v.as_str()) {
                    if !token.is_empty() {
                        cred.token = Some(token.to_string());
                        cred.status = ProviderStatus::Discovered;
                        cred.source = "~/.config/github-copilot/hosts.json".to_string();
                        return cred;
                    }
                }
            }
        }
    }

    cred
}

fn discover_antigravity() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "antigravity".to_string(),
        display_name: "Antigravity".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("ANTIGRAVITY_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "ANTIGRAVITY_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_kilo() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "kilo".to_string(),
        display_name: "Kilo".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Strategy 1: ~/.local/share/kilo/auth.json
    let home = std::env::var("HOME").unwrap_or_default();
    let auth_path = format!("{}/.local/share/kilo/auth.json", home);
    if let Ok(content) = std::fs::read_to_string(&auth_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(key) = json
                .get("apiKey")
                .or(json.get("api_key"))
                .or(json.get("token"))
                .and_then(|v| v.as_str())
            {
                if !key.is_empty() {
                    cred.token = Some(key.to_string());
                    cred.status = ProviderStatus::Discovered;
                    cred.source = "~/.local/share/kilo/auth.json".to_string();
                    return cred;
                }
            }
        }
    }

    // Strategy 2: KILO_API_KEY env var
    if let Ok(key) = std::env::var("KILO_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "KILO_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_warp() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "warp".to_string(),
        display_name: "Warp".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("WARP_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "WARP_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_ollama() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "ollama".to_string(),
        display_name: "Ollama (local)".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Check OLLAMA_HOST env var; default is http://localhost:11434
    let host = std::env::var("OLLAMA_HOST")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    if !host.is_empty() {
        // Treat a configured/default host as the "token" (endpoint URL)
        cred.token = Some(host.clone());
        cred.status = ProviderStatus::Discovered;
        cred.source = if std::env::var("OLLAMA_HOST").is_ok() {
            "OLLAMA_HOST env".to_string()
        } else {
            "default localhost:11434".to_string()
        };
    }

    cred
}

fn discover_groq() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "groq".to_string(),
        display_name: "Groq".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("GROQ_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "GROQ_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_mistral() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "mistral".to_string(),
        display_name: "Mistral".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("MISTRAL_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "MISTRAL_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_deepseek() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "deepseek".to_string(),
        display_name: "DeepSeek".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("DEEPSEEK_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "DEEPSEEK_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_xai() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "xai".to_string(),
        display_name: "xAI (Grok)".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("XAI_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "XAI_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_together() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "together".to_string(),
        display_name: "Together AI".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("TOGETHER_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "TOGETHER_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_fireworks() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "fireworks".to_string(),
        display_name: "Fireworks AI".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("FIREWORKS_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "FIREWORKS_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_perplexity() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "perplexity".to_string(),
        display_name: "Perplexity".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("PERPLEXITY_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "PERPLEXITY_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_cohere() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "cohere".to_string(),
        display_name: "Cohere".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    if let Ok(key) = std::env::var("COHERE_API_KEY") {
        if !key.is_empty() {
            cred.token = Some(key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "COHERE_API_KEY env".to_string();
        }
    }

    cred
}

fn discover_bedrock() -> ProviderCredential {
    let mut cred = ProviderCredential {
        provider_id: "bedrock".to_string(),
        display_name: "Amazon Bedrock".to_string(),
        status: ProviderStatus::Missing,
        source: String::new(),
        token: None,
    };

    // Both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be present
    if let (Ok(access_key), Ok(secret_key)) = (
        std::env::var("AWS_ACCESS_KEY_ID"),
        std::env::var("AWS_SECRET_ACCESS_KEY"),
    ) {
        if !access_key.is_empty() && !secret_key.is_empty() {
            // Store access key as the token; secret is not stored separately
            cred.token = Some(access_key);
            cred.status = ProviderStatus::Discovered;
            cred.source = "AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env".to_string();
        }
    }

    cred
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discover_returns_all_providers() {
        let reg = AuthProviderRegistry::discover();
        assert_eq!(reg.providers.len(), 20);
        assert!(reg.get("anthropic").is_some());
        assert!(reg.get("vercel-gateway").is_some());
        assert!(reg.get("openrouter").is_some());
        assert!(reg.get("openai").is_some());
        assert!(reg.get("cursor").is_some());
        assert!(reg.get("gemini").is_some());
        assert!(reg.get("copilot").is_some());
        assert!(reg.get("antigravity").is_some());
        assert!(reg.get("kilo").is_some());
        assert!(reg.get("warp").is_some());
        assert!(reg.get("ollama").is_some());
        assert!(reg.get("groq").is_some());
        assert!(reg.get("mistral").is_some());
        assert!(reg.get("deepseek").is_some());
        assert!(reg.get("xai").is_some());
        assert!(reg.get("together").is_some());
        assert!(reg.get("fireworks").is_some());
        assert!(reg.get("perplexity").is_some());
        assert!(reg.get("cohere").is_some());
        assert!(reg.get("bedrock").is_some());
    }

    #[test]
    fn set_manual_updates_provider() {
        let mut reg = AuthProviderRegistry::discover();
        reg.set_manual("anthropic", "sk-test-123".to_string());
        let p = reg.get("anthropic").unwrap();
        assert_eq!(p.status, ProviderStatus::Configured);
        assert_eq!(p.source, "manual");
        assert_eq!(p.token.as_deref(), Some("sk-test-123"));
    }

    #[test]
    fn redacted_token_shows_bookends() {
        assert_eq!(
            AuthProviderRegistry::redacted_token("sk-ant-api03-abcdefghijklmnop"),
            "sk-ant-a...mnop"
        );
    }

    #[test]
    fn redacted_short_token() {
        assert_eq!(AuthProviderRegistry::redacted_token("short"), "****");
    }
}
