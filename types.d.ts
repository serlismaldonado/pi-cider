export interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    details: Record<string, unknown>;
    isError?: boolean;
}
export declare function result(text: string, details?: Record<string, unknown>): ToolResult;
export declare function error(text: string): ToolResult;
export interface CiderTrack {
    name: string;
    artistName: string;
    albumName: string;
    durationInMillis: number;
    currentPlaybackTime: number;
    artwork?: {
        url: string;
    };
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
//# sourceMappingURL=types.d.ts.map