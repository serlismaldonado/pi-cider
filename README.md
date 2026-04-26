# Pi Cider Extension

Control Apple Music through Cider client from Pi. Shows now playing in status bar.

## Status Bar

The extension automatically displays the currently playing song in Pi's status bar footer. Updates every turn end.

## Configuration

Set your Cider API token in one of these ways:

**Option 1: Environment file** (recommended for local development)

```bash
# Create .env file in the extension directory
CIDER_API_TOKEN=your-token-here
```

**Option 2: Pi auth.json**

```json
{
  "cider": {
    "type": "api_key",
    "key": "your-cider-api-token"
  }
}
```

Environment variables (optional):

- `CIDER_HOST` - Cider server host (default: localhost)
- `CIDER_PORT` - Cider server port (default: 10767)

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

## Setup Cider RPC

1. Open Cider → Settings → Connectivity
2. Click "Manage External Application Access to Cider"
3. Generate API token or disable authentication
4. Copy the token for use above

## Install

```bash
# From npm
pi install pi-cider

# From local
pi install /path/to/pi-cider
```
