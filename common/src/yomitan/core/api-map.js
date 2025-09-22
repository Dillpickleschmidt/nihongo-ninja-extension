/*
 * Minimal stub for api-map
 */

export function createApiMap(map) {
    return map;
}

export function invokeApiMapHandler(map, action, params) {
    const handler = map.get(action);
    if (handler) {
        return handler(params);
    }
    throw new Error(`No handler for action: ${action}`);
}