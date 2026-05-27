export function normalizeOrigin(value?: string | null): string | undefined {
    if (!value) return undefined;

    try {
        return new URL(value).origin;
    } catch {
        const origin = value.trim().replace(/\/+$/, '');
        return origin || undefined;
    }
}

export function createAllowedOrigins(origins: Array<string | null | undefined>): Set<string> {
    return new Set(origins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));
}
