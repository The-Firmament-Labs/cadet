use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;
use super::super::shared::EmptyState;

#[component]
pub fn WalletView(snapshot: MissionControlSnapshot) -> Element {
    let credits = snapshot.operator_credits.first();

    // Derive usage from user_interactions filtered by platform="elizaos"
    let elizaos_events: Vec<_> = snapshot.message_events.iter()
        .filter(|e| e.channel == "elizaos" || e.actor.contains("elizaos"))
        .collect();

    rsx! {
        div { class: "wallet-view",
            // Balance section
            div { class: "wallet-cards",
                div { class: "wallet-card wallet-card-primary",
                    p { class: "wallet-card-label", "Credit Balance" }
                    h2 { class: "wallet-card-value",
                        if let Some(c) = credits {
                            "{c.credits_balance:.2}"
                        } else {
                            "—"
                        }
                    }
                    if let Some(c) = credits {
                        p { class: "wallet-card-sub", "Used: {c.credits_used:.2} credits" }
                    }
                }

                div { class: "wallet-card wallet-card-earnings",
                    p { class: "wallet-card-label", "Affiliate Earnings" }
                    h2 { class: "wallet-card-value wallet-value-positive",
                        if let Some(c) = credits {
                            "{c.affiliate_earnings:.2} $ELIZA"
                        } else {
                            "—"
                        }
                    }
                    p { class: "wallet-card-sub", "Revenue from referred users" }
                }

                div { class: "wallet-card",
                    p { class: "wallet-card-label", "Provider" }
                    h2 { class: "wallet-card-value",
                        if let Some(c) = credits {
                            "{c.provider}"
                        } else {
                            "Not connected"
                        }
                    }
                    p { class: "wallet-card-sub", "Sign in with ElizaOS to connect" }
                }
            }

            // Wallet addresses
            div { class: "wallet-section",
                h3 { class: "wallet-section-title", "Connected Wallets" }
                if let Some(c) = credits {
                    if !c.wallet_address.is_empty() {
                        div { class: "wallet-address-card",
                            span { class: "wallet-address-label", "Withdrawal Address" }
                            code { class: "wallet-address-value", "{c.wallet_address}" }
                        }
                    } else {
                        p { class: "wallet-empty", "No wallet connected. Link an EVM or Solana address in Settings." }
                    }
                } else {
                    EmptyState {
                        title: "No billing account".to_string(),
                        body: "Sign in with ElizaOS Cloud to enable credits, affiliate earnings, and wallet withdrawals.".to_string(),
                    }
                }
            }

            // Recent ElizaOS usage
            div { class: "wallet-section",
                h3 { class: "wallet-section-title", "Recent API Usage ({elizaos_events.len()})" }
                if elizaos_events.is_empty() {
                    p { class: "wallet-empty", "No ElizaOS API calls recorded yet." }
                } else {
                    div { class: "wallet-usage-list",
                        for event in elizaos_events.iter().take(20) {
                            div { class: "wallet-usage-row",
                                span { class: "wallet-usage-actor", "{event.actor}" }
                                span { class: "wallet-usage-content", "{event.content}" }
                            }
                        }
                    }
                }
            }
        }
    }
}
