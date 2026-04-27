import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { Type } from "typebox";
import { result, error as toolError } from "./types.js";
const CIDER_HOST = process.env.CIDER_HOST || "localhost";
const CIDER_PORT = process.env.CIDER_PORT || "10767";
const CIDER_BASE_URL = `http://${CIDER_HOST}:${CIDER_PORT}`;
async function ensureCiderRunning() {
    try {
        const response = await fetch(`${CIDER_BASE_URL}/api/v1/playback/active`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (response.status === 204 || response.status === 200) {
            return true;
        }
    }
    catch { }
    // Cider not running, launch it
    try {
        execSync('open -a "Cider"', { stdio: "ignore" });
        // Wait for Cider to start (up to 10 seconds)
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            try {
                const response = await fetch(`${CIDER_BASE_URL}/api/v1/playback/active`);
                if (response.status === 204 || response.status === 200) {
                    return true;
                }
            }
            catch { }
        }
    }
    catch (err) {
        console.error("Failed to launch Cider:", err);
    }
    return false;
}
function getToken() {
    const token = process.env.CIDER_API_TOKEN;
    if (token) {
        return token;
    }
    const authPath = path.join(process.env.HOME || "", ".pi/agent/auth.json");
    try {
        const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
        return auth?.["env:CIDER_API_TOKEN"] || auth?.cider?.key || null;
    }
    catch {
        return null;
    }
}
async function ciderRequest(urlPath, method = "GET", body) {
    const token = getToken();
    const url = `${CIDER_BASE_URL}${urlPath}`;
    if (!token) {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204) {
            return {};
        }
        if (response.status === 403) {
            const errorText = await response.text();
            if (errorText.includes("UNAUTHORIZED")) {
                throw new Error("Cider RPC requires authentication. Set CIDER_API_TOKEN or disable auth in Cider settings.");
            }
        }
        if (!response.ok) {
            throw new Error(`Cider RPC error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    const headerFormats = [
        { name: "apptoken", value: token },
        { name: "apitoken", value: token },
        { name: "API-Token", value: token },
        { name: "Authorization", value: `Bearer ${token}` },
        { name: "X-API-Token", value: token },
    ];
    for (const format of headerFormats) {
        const headers = {
            "Content-Type": "application/json",
            [format.name]: format.value,
        };
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204) {
            return {};
        }
        if (response.status === 403) {
            const errorText = await response.text();
            if (errorText.includes("UNAUTHORIZED")) {
                continue;
            }
        }
        if (!response.ok) {
            throw new Error(`Cider RPC error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    throw new Error("Cider authentication failed. Try regenerating your API token in Cider settings.");
}
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
let lastTrackId = null;
let idlePollCount = 0;
let pollInterval = null;
async function getNowPlaying() {
    try {
        const data = await ciderRequest("/api/v1/playback/now-playing");
        if (data.info) {
            return {
                name: data.info.name,
                artist: data.info.artistName,
                trackId: data.info.playParams?.id
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
function updateStatus(ctx, theme, track) {
    if (track?.name) {
        idlePollCount = 0;
        const currentId = track.trackId || null;
        if (currentId !== lastTrackId) {
            lastTrackId = currentId;
            const shortName = track.name.length > 20 ? track.name.substring(0, 18) + "..." : track.name;
            ctx.ui.setStatus("pi-cider", theme.fg("accent", `♪ ${shortName} - ${track.artist}`));
        }
    }
    else {
        idlePollCount++;
        if (idlePollCount >= 2 && lastTrackId !== null) {
            lastTrackId = null;
            ctx.ui.setStatus("pi-cider", theme.fg("dim", "Cider (idle)"));
        }
    }
}
export default function (pi) {
    pi.on("session_start", async (_event, ctx) => {
        const theme = ctx.ui.theme;
        ctx.ui.setStatus("pi-cider", theme.fg("dim", "Cider"));
        // Check immediately if something is playing
        const initialTrack = await getNowPlaying();
        updateStatus(ctx, theme, initialTrack);
        // Start polling every 5 seconds to detect track changes
        pollInterval = setInterval(async () => {
            const track = await getNowPlaying();
            updateStatus(ctx, theme, track);
        }, 5000);
    });
    pi.registerTool({
        name: "cider_status",
        label: "Cider Status",
        description: "Check if Cider RPC server is running and responding",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            const token = getToken();
            const headerFormats = [
                { name: "apptoken", value: token },
                { name: "apitoken", value: token },
                { name: "API-Token", value: token },
                { name: "Authorization", value: token ? `Bearer ${token}` : "" },
                { name: "X-API-Token", value: token },
            ];
            for (const format of headerFormats) {
                const headers = {};
                if (format.value) {
                    headers[format.name] = format.value;
                }
                try {
                    const response = await fetch(`${CIDER_BASE_URL}/api/v1/playback/active`, { headers });
                    if (response.status === 204) {
                        return result("Cider RPC is active on localhost:10767");
                    }
                    if (response.status === 403) {
                        const errorText = await response.text();
                        if (errorText.includes("UNAUTHORIZED")) {
                            continue;
                        }
                    }
                }
                catch {
                    continue;
                }
            }
            return toolError("Cannot connect to Cider. Make sure Cider is running and RPC is enabled in Settings → Connectivity.");
        },
    });
    pi.registerTool({
        name: "cider_now_playing",
        label: "Cider Now Playing",
        description: "Get information about the currently playing song",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            try {
                const data = await ciderRequest("/api/v1/playback/now-playing");
                if (!data.info) {
                    return result("Nothing playing right now");
                }
                const { info } = data;
                const progress = formatTime(info.currentPlaybackTime);
                const duration = formatTime(info.durationInMillis / 1000);
                return result(`${info.name} - ${info.artistName}\nAlbum: ${info.albumName}\n${progress} / ${duration}`);
            }
            catch (error) {
                return toolError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        },
    });
    pi.registerTool({
        name: "cider_play",
        label: "Cider Play",
        description: "Resume playback or start playing the queue",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ensureCiderRunning();
            await ciderRequest("/api/v1/playback/play", "POST", {});
            return result("Playback started");
        },
    });
    pi.registerTool({
        name: "cider_pause",
        label: "Cider Pause",
        description: "Pause the current playback",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/pause", "POST", {});
            return result("Playback paused");
        },
    });
    pi.registerTool({
        name: "cider_play_pause",
        label: "Cider Play/Pause",
        description: "Toggle between play and pause",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/playpause", "POST", {});
            return result("Play/Pause toggled");
        },
    });
    pi.registerTool({
        name: "cider_next",
        label: "Cider Next",
        description: "Skip to the next track in the queue",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/next", "POST", {});
            return result("Skipped to next track");
        },
    });
    pi.registerTool({
        name: "cider_previous",
        label: "Cider Previous",
        description: "Go to the previous track or restart current track",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/previous", "POST", {});
            return result("Went to previous track");
        },
    });
    pi.registerTool({
        name: "cider_is_playing",
        label: "Cider Is Playing",
        description: "Check if music is currently playing",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            const data = await ciderRequest("/api/v1/playback/is-playing");
            return result(data.is_playing ? "Playing" : "Paused", { isPlaying: data.is_playing });
        },
    });
    pi.registerTool({
        name: "cider_volume",
        label: "Cider Volume",
        description: "Get or set the playback volume",
        parameters: Type.Object({
            level: Type.Optional(Type.Number({ description: "Volume level between 0 and 1 (optional)" })),
        }),
        async execute(_toolCallId, params, _signal) {
            if (params.level !== undefined) {
                await ciderRequest("/api/v1/playback/volume", "POST", { volume: params.level });
                return result(`Volume set to ${Math.round(params.level * 100)}%`);
            }
            const data = await ciderRequest("/api/v1/playback/volume");
            return result(`Current volume: ${Math.round(data.volume * 100)}%`, { volume: data.volume });
        },
    });
    pi.registerTool({
        name: "cider_seek",
        label: "Cider Seek",
        description: "Seek to a specific position in the current track",
        parameters: Type.Object({
            seconds: Type.Number({ description: "Position in seconds" }),
        }),
        async execute(_toolCallId, params, _signal) {
            await ciderRequest("/api/v1/playback/seek", "POST", { position: params.seconds });
            return result(`Seeked to ${formatTime(params.seconds)}`);
        },
    });
    pi.registerTool({
        name: "cider_queue",
        label: "Cider Queue",
        description: "Get the current playback queue",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            const data = await ciderRequest("/api/v1/playback/queue");
            if (data.length === 0) {
                return result("Queue is empty");
            }
            const queueText = data.slice(0, 10).map((item, i) => {
                const attrs = item.attributes;
                return `${i + 1}. ${attrs?.name || "Unknown"} - ${attrs?.artistName || "Unknown"}`;
            }).join("\n");
            return result(`Queue (${data.length} items):\n${queueText}`, { count: data.length });
        },
    });
    pi.registerTool({
        name: "cider_play_url",
        label: "Cider Play URL",
        description: "Play a song, album, or playlist by Apple Music URL",
        parameters: Type.Object({
            url: Type.String({ description: "Apple Music URL" }),
        }),
        async execute(_toolCallId, params, _signal) {
            await ensureCiderRunning();
            await ciderRequest("/api/v1/playback/play-url", "POST", { url: params.url });
            // Small delay then play
            await new Promise(r => setTimeout(r, 500));
            await ciderRequest("/api/v1/playback/play", "POST", {});
            return result(`Playing: ${params.url}`);
        },
    });
    pi.registerTool({
        name: "cider_toggle_shuffle",
        label: "Cider Toggle Shuffle",
        description: "Toggle shuffle mode on or off",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/toggle-shuffle", "POST", {});
            return result("Shuffle toggled");
        },
    });
    pi.registerTool({
        name: "cider_toggle_repeat",
        label: "Cider Toggle Repeat",
        description: "Toggle repeat mode (cycles: off -> repeat one -> repeat all)",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal) {
            await ciderRequest("/api/v1/playback/toggle-repeat", "POST", {});
            return result("Repeat mode toggled");
        },
    });
    pi.registerTool({
        name: "cider_search",
        label: "Cider Search",
        description: "Search the Apple Music catalog",
        parameters: Type.Object({
            query: Type.String({ description: "Search query" }),
            limit: Type.Optional(Type.Number({ description: "Max results (default 10)" })),
        }),
        async execute(_toolCallId, params, _signal) {
            const limit = params.limit || 10;
            const encodedQuery = encodeURIComponent(params.query);
            const data = await ciderRequest("/api/v1/amapi/run-v3", "POST", {
                path: `/v1/catalog/us/search?term=${encodedQuery}&limit=${limit}&types=songs,albums,artists`,
            });
            const results = [];
            const songs = data?.data?.results?.songs?.data;
            const albums = data?.data?.results?.albums?.data;
            if (songs?.length) {
                results.push("Songs:");
                songs.slice(0, 5).forEach((song, i) => {
                    results.push(`  ${i + 1}. ${song.attributes.name} - ${song.attributes.artistName}`);
                    results.push(`     ID: ${song.id}`);
                });
            }
            if (albums?.length) {
                if (results.length)
                    results.push("");
                results.push("Albums:");
                albums.slice(0, 3).forEach((album, i) => {
                    results.push(`  ${i + 1}. ${album.attributes.name} - ${album.attributes.artistName}`);
                    results.push(`     ID: ${album.id}`);
                });
            }
            if (results.length === 0) {
                return result(`No results found for "${params.query}"`);
            }
            return result(results.join("\n"));
        },
    });
    pi.registerTool({
        name: "cider_play_id",
        label: "Cider Play by ID",
        description: "Play a song by its Apple Music catalog ID",
        parameters: Type.Object({
            id: Type.String({ description: "Apple Music song ID" }),
        }),
        async execute(_toolCallId, params, _signal) {
            await ensureCiderRunning();
            await ciderRequest("/api/v1/playback/play-item", "POST", { type: "songs", id: params.id });
            return result(`Playing song ID: ${params.id}`);
        },
    });
    pi.registerTool({
        name: "cider_play_next",
        label: "Cider Play Next",
        description: "Add a song to the front of the queue (plays next)",
        parameters: Type.Object({
            id: Type.String({ description: "Apple Music song ID" }),
        }),
        async execute(_toolCallId, params, _signal) {
            await ensureCiderRunning();
            await ciderRequest("/api/v1/playback/play-next", "POST", { type: "songs", id: params.id });
            return result(`Added song ${params.id} to play next`);
        },
    });
    pi.registerTool({
        name: "cider_play_later",
        label: "Cider Play Later",
        description: "Add a song to the end of the queue",
        parameters: Type.Object({
            id: Type.String({ description: "Apple Music song ID" }),
        }),
        async execute(_toolCallId, params, _signal) {
            await ensureCiderRunning();
            await ciderRequest("/api/v1/playback/play-later", "POST", { type: "songs", id: params.id });
            return result(`Added song ${params.id} to queue`);
        },
    });
}
