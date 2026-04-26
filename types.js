export function result(text, details = {}) {
    return { content: [{ type: "text", text }], details };
}
export function error(text) {
    return { content: [{ type: "text", text }], isError: true, details: {} };
}
