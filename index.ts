import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import { Type } from "typebox";
import { result, error as toolError } from "./types.js";

const CIDER_HOST = process.env.CIDER_HOST || "localhost";
const CIDER_PORT = process.env.CIDER_PORT || "10767";
const CIDER_BASE_URL = `http://${CIDER_HOST}:${CIDER_PORT}`;

function getToken(): string {
	const envToken = process.env.CIDER_API_TOKEN;
	if (envToken) {
		return envToken;
	}

	const authPath = path.join(process.env.HOME || "", ".pi/agent/auth.json");
	try {
		const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
		const key = auth?.["env:CIDER_API_TOKEN"] || auth?.cider?.key;
		if (key) {
			return key;
		}
	} catch {
		// Ignore
	}

	throw new Error(
		"Cider API token not configured. Set CIDER_API_TOKEN in .env or cider.key in ~/.pi/agent/auth.json",
	);
}

async function ciderRequest<T>(
	path: string,
	method = "GET",
	body?: object,
): Promise<T> {
	const token = getToken();
	const url = `${CIDER_BASE_URL}${path}`;

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) {
		headers["apitoken"] = token;
	}

	const response = await fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		if (response.status === 204) {
			return {} as T;
		}
		throw new Error(
			`Cider RPC error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function getNowPlaying(): Promise<{
	name: string;
	artist: string;
} | null> {
	try {
		const data = await ciderRequest<{
			status: string;
			info: { name: string; artistName: string } | null;
		}>("/api/v1/playback/now-playing");
		if (data.info) {
			return { name: data.info.name, artist: data.info.artistName };
		}
		return null;
	} catch {
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	// Show Cider status on session start
	pi.on("session_start", async (_event, ctx) => {
		const theme = ctx.ui.theme;
		ctx.ui.setStatus("pi-cider", theme.fg("dim", "Cider"));
	});

	// Update now playing on each turn end
	pi.on("turn_end", async (_event, ctx) => {
		const theme = ctx.ui.theme;
		const track = await getNowPlaying();
		if (track) {
			const shortName =
				track.name.length > 20
					? track.name.substring(0, 18) + "..."
					: track.name;
			ctx.ui.setStatus(
				"pi-cider",
				theme.fg("accent", `♪ ${shortName} - ${track.artist}`),
			);
		} else {
			ctx.ui.setStatus("pi-cider", theme.fg("dim", "Cider (idle)"));
		}
	});
	pi.registerTool({
		name: "cider_status",
		label: "Cider Status",
		description: "Check if Cider RPC server is running and responding",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			try {
				const response = await fetch(
					`${CIDER_BASE_URL}/api/v1/playback/active`,
					{ headers: { apitoken: getToken() } },
				);
				if (response.status === 204) {
					return result("Cider RPC is active on localhost:10767");
				}
				return toolError("Cider not responding correctly");
			} catch (error) {
				return toolError(
					`Cannot connect to Cider: ${error instanceof Error ? error.message : "Unknown error"}\n\nMake sure Cider is running and the RPC server is enabled.`,
				);
			}
		},
	});

	pi.registerTool({
		name: "cider_now_playing",
		label: "Cider Now Playing",
		description: "Get information about the currently playing song",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			try {
				const data = await ciderRequest<{
					status: string;
					info: {
						name: string;
						artistName: string;
						albumName: string;
						durationInMillis: number;
						currentPlaybackTime: number;
						audioTraits?: string[];
					};
				}>("/api/v1/playback/now-playing");
				if (!data.info) {
					return result("Nothing playing right now");
				}
				const { info } = data;
				const progress = formatTime(info.currentPlaybackTime);
				const duration = formatTime(info.durationInMillis / 1000);
				const traits = info.audioTraits?.join(", ") || "standard";
				return {
					content: [
						{
							type: "text",
							text: `${info.name} - ${info.artistName}\nAlbum: ${info.albumName}\n${progress} / ${duration}\nQuality: ${traits}`,
						},
					],
					details: {
						song: info.name,
						artist: info.artistName,
						album: info.albumName,
					},
				};
			} catch (error) {
				return toolError(
					`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		},
	});

	pi.registerTool({
		name: "cider_play",
		label: "Cider Play",
		description: "Resume playback or start playing the queue",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/play", "POST", {});
			return result("Playback started");
		},
	});

	pi.registerTool({
		name: "cider_pause",
		label: "Cider Pause",
		description: "Pause the current playback",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/pause", "POST");
			return result("Playback paused");
		},
	});

	pi.registerTool({
		name: "cider_play_pause",
		label: "Cider Play/Pause",
		description: "Toggle between play and pause",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/playpause", "POST");
			return result("Play/Pause toggled");
		},
	});

	pi.registerTool({
		name: "cider_next",
		label: "Cider Next",
		description: "Skip to the next track in the queue",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/next", "POST");
			return result("Skipped to next track");
		},
	});

	pi.registerTool({
		name: "cider_previous",
		label: "Cider Previous",
		description: "Go to the previous track or restart current track",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/previous", "POST");
			return result("Went to previous track");
		},
	});

	pi.registerTool({
		name: "cider_is_playing",
		label: "Cider Is Playing",
		description: "Check if music is currently playing",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			const data = await ciderRequest<{ status: string; is_playing: boolean }>(
				"/api/v1/playback/is-playing",
			);
			return result(data.is_playing ? "Playing" : "Paused", {
				isPlaying: data.is_playing,
			});
		},
	});

	pi.registerTool({
		name: "cider_volume",
		label: "Cider Volume",
		description: "Get or set the playback volume",
		parameters: Type.Object({
			level: Type.Optional(
				Type.Number({
					description:
						"Volume level between 0 and 1 (optional - if omitted, returns current volume)",
				}),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { level?: number },
			_signal: AbortSignal | undefined,
		) {
			if (params.level !== undefined) {
				await ciderRequest("/api/v1/playback/volume", "POST", {
					volume: params.level,
				});
				return result(`Volume set to ${Math.round(params.level * 100)}%`);
			}
			const data = await ciderRequest<{ status: string; volume: number }>(
				"/api/v1/playback/volume",
			);
			return result(`Current volume: ${Math.round(data.volume * 100)}%`, {
				volume: data.volume,
			});
		},
	});

	pi.registerTool({
		name: "cider_seek",
		label: "Cider Seek",
		description: "Seek to a specific position in the current track",
		parameters: Type.Object({
			seconds: Type.Number({ description: "Position in seconds" }),
		}),
		async execute(
			_toolCallId: string,
			params: { seconds: number },
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/seek", "POST", {
				position: params.seconds,
			});
			return result(`Seeked to ${formatTime(params.seconds)}`);
		},
	});

	pi.registerTool({
		name: "cider_queue",
		label: "Cider Queue",
		description: "Get the current playback queue",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			const data = await ciderRequest<unknown[]>("/api/v1/playback/queue");
			if (data.length === 0) {
				return result("Queue is empty");
			}
			const queueText = data
				.slice(0, 10)
				.map((item: any, i: number) => {
					const attrs = item.attributes;
					return `${i + 1}. ${attrs?.name || "Unknown"} - ${attrs?.artistName || "Unknown Artist"}`;
				})
				.join("\n");
			return result(`Queue (${data.length} items):\n${queueText}`, {
				count: data.length,
			});
		},
	});

	pi.registerTool({
		name: "cider_play_url",
		label: "Cider Play URL",
		description: "Play a song, album, or playlist by Apple Music URL",
		parameters: Type.Object({
			url: Type.String({
				description: "Apple Music URL of the song/album/playlist",
			}),
		}),
		async execute(
			_toolCallId: string,
			params: { url: string },
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/play-url", "POST", {
				url: params.url,
			});
			return result(`Playing: ${params.url}`);
		},
	});

	pi.registerTool({
		name: "cider_toggle_shuffle",
		label: "Cider Toggle Shuffle",
		description: "Toggle shuffle mode on or off",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/toggle-shuffle", "POST");
			return result("Shuffle toggled");
		},
	});

	pi.registerTool({
		name: "cider_toggle_repeat",
		label: "Cider Toggle Repeat",
		description: "Toggle repeat mode (cycles: off -> repeat one -> repeat all)",
		parameters: Type.Object({}),
		async execute(
			_toolCallId: string,
			_params: object,
			_signal: AbortSignal | undefined,
		) {
			await ciderRequest("/api/v1/playback/toggle-repeat", "POST");
			return result("Repeat mode toggled");
		},
	});

	pi.registerTool({
		name: "cider_search",
		label: "Cider Search",
		description: "Search the Apple Music catalog",
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			limit: Type.Optional(
				Type.Number({ description: "Max results (default 10)" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { query: string; limit?: number },
			_signal: AbortSignal | undefined,
		) {
			const limit = params.limit || 10;
			const encodedQuery = encodeURIComponent(params.query);
			const data = await ciderRequest<{ data: any }>(
				"/api/v1/amapi/run-v3",
				"POST",
				{
					path: `/v1/catalog/us/search?term=${encodedQuery}&limit=${limit}&types=songs,albums,artists`,
				},
			);

			const results: string[] = [];
			if (data?.data?.songs?.data) {
				results.push("Songs:");
				data.data.songs.data.slice(0, 5).forEach((song: any, i: number) => {
					results.push(
						`  ${i + 1}. ${song.attributes.name} - ${song.attributes.artistName}`,
					);
				});
			}
			if (data?.data?.albums?.data) {
				results.push("\nAlbums:");
				data.data.albums.data.slice(0, 3).forEach((album: any, i: number) => {
					results.push(
						`  ${i + 1}. ${album.attributes.name} - ${album.attributes.artistName}`,
					);
				});
			}

			if (results.length === 0) {
				return result(`No results found for "${params.query}"`);
			}

			return result(results.join("\n"));
		},
	});
}
