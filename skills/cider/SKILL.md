---
name: cider
description: Routing skill for Cider Apple Music client. Use when the user wants to control music playback, manage queue, or get now playing info.
---

# Cider Apple Music

Cider extension for Pi - control Apple Music via Cider client RPC API.

## Configuration

**API Token:** Get from Cider → Settings → Connectivity → "Manage External Application Access to Cider"

**Token stored in:**

- Environment: `CIDER_API_TOKEN` in `.env` file
- Pi auth: `~/.pi/agent/auth.json` → `"cider": { "key": "..." }`
- Pi auth with env prefix: `"env:CIDER_API_TOKEN": "..."` (injects as env var)

**Default:** localhost:10767

## Tools

| Tool                   | Description                  |
| ---------------------- | ---------------------------- |
| `cider_status`         | Check if Cider is running    |
| `cider_now_playing`    | Get current track info       |
| `cider_play`           | Resume/start playback        |
| `cider_pause`          | Pause playback               |
| `cider_play_pause`     | Toggle play/pause            |
| `cider_next`           | Skip to next track           |
| `cider_previous`       | Go to previous track         |
| `cider_is_playing`     | Check if music is playing    |
| `cider_volume`         | Get/set volume (0-1)         |
| `cider_seek`           | Seek to position (seconds)   |
| `cider_queue`          | View playback queue          |
| `cider_play_url`       | Play song by Apple Music URL |
| `cider_toggle_shuffle` | Toggle shuffle mode          |
| `cider_toggle_repeat`  | Toggle repeat mode           |
| `cider_search`         | Search Apple Music catalog   |

## Examples

```bash
# Check what's playing
cider_now_playing

# Play next track
cider_next

# Search for a song
cider_search with {"query": "Adele"}

# Play specific URL
cider_play_url with {"url": "https://music.apple.com/..."}

# Set volume to 50%
cider_volume with {"level": 0.5}

# Toggle shuffle
cider_toggle_shuffle
```

## Status Bar

The extension shows now playing in the status bar footer. Updates on each turn end.

## Troubleshooting

| Problem                   | Solution                                |
| ------------------------- | --------------------------------------- |
| "Connection refused"      | Start Cider app, enable RPC in Settings |
| "Auth failed"             | Check CIDER_API_TOKEN is correct        |
| Not showing in status bar | Restart Pi with `/reload`               |
