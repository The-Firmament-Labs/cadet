# Social Channel Adapters

## Channel Protocol

Every inbound event creates a ThreadRecord with a channel identifier:

| Channel | Source | Thread ID Format |
|---------|--------|-----------------|
| `web` | Dashboard inbox | `web-{uuid}` |
| `slack` | Slack Events API | `slack-{channel_id}-{thread_ts}` |
| `github` | GitHub Webhooks | `github-{repo}-{issue/pr_number}` |
| `discord` | Discord Gateway | `discord-{channel_id}-{message_id}` |
| `system` | Cron/scheduler | `system-{schedule_id}-{timestamp}` |

## Outbound Delivery

Agents send replies through DeliveryAttempt records:
- `channel` — target channel
- `direction` — "outbound"
- `target` — channel-specific destination (slack channel ID, github issue URL, etc.)
- `payload_json` — message content formatted for the target
- `status` — queued, delivered, failed

## Slack Integration

```
Webhook: POST /api/slack/events
Auth: SLACK_SIGNING_SECRET verification
Events: app_mention, message (in channels where bot is invited)
Replies: Slack Web API via SLACK_BOT_TOKEN
```

## GitHub Integration

```
Webhook: POST /api/github/events
Auth: GitHub webhook signature verification
Events: issues.opened, issue_comment.created, pull_request.opened, pull_request_review
Replies: GitHub REST API via GITHUB_TOKEN
```

## Channel-Aware Formatting

When producing output for a channel, adapt:
- **Slack**: Use Block Kit for rich formatting, mrkdwn for text
- **GitHub**: Use GitHub-flavored markdown, @mention users
- **Discord**: Use Discord markdown, embed objects for rich cards
- **Web**: Use the dashboard's D350 orbital theme formatting
