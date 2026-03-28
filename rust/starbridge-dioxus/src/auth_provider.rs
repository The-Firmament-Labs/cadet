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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discover_returns_all_four_providers() {
        let reg = AuthProviderRegistry::discover();
        assert_eq!(reg.providers.len(), 4);
        assert!(reg.get("anthropic").is_some());
        assert!(reg.get("vercel-gateway").is_some());
        assert!(reg.get("openrouter").is_some());
        assert!(reg.get("openai").is_some());
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
