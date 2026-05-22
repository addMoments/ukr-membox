import { SERV_ROOT } from '../consts';
import { fetch } from './core';

/**
 * Returns the list of feature IDs granted to an event.
 * Requires an auth (admin) JWT token.
 */
export async function getEventFeatures(packedUid: string): Promise<number[]> {
    try {
        const res = await fetch(`${SERV_ROOT}/api/event/${packedUid}/features`);
        return await res.json();
    } catch {
        return [];
    }
}

/**
 * Returns the list of feature IDs granted to an event.
 * No auth required — safe to call from guest pages.
 */
export async function getEventPublicFeatures(packedUid: string): Promise<number[]> {
    try {
        const res = await fetch(`${SERV_ROOT}/api/event/${packedUid}/public-features`);
        return await res.json();
    } catch {
        return [];
    }
}
