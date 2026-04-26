export interface ToolResult {
	content: Array<{ type: "text"; text: string }>;
	details: Record<string, unknown>;
	isError?: boolean;
}

export function result(
	text: string,
	details: Record<string, unknown> = {},
): ToolResult {
	return { content: [{ type: "text", text }], details };
}

export function error(text: string): ToolResult {
	return { content: [{ type: "text", text }], isError: true, details: {} };
}

export interface CiderTrack {
	name: string;
	artistName: string;
	albumName: string;
	durationInMillis: number;
	currentPlaybackTime: number;
	artwork?: { url: string };
	audioTraits?: string[];
}

export interface NowPlayingResponse {
	status: string;
	info: CiderTrack;
}

export interface IsPlayingResponse {
	status: string;
	is_playing: boolean;
}

export interface VolumeResponse {
	status: string;
	volume: number;
}
