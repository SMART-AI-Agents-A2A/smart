import { z } from 'zod';

const kvNamespaceSchema = z.custom<KVNamespace>(
    (value) => {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const candidate = value as Record<string, unknown>;

        return (
            typeof candidate.get === 'function' &&
            typeof candidate.put === 'function' &&
            typeof candidate.delete === 'function'
        );
    },
    {
        message: 'Binding smart_cache inválido ou ausente.',
    },
);

export const cacheBindingsSchema = z.object({
    smart_cache: kvNamespaceSchema,
});

export type CacheBindings = z.infer<typeof cacheBindingsSchema>;

export const parseCacheBindings = (env: unknown): CacheBindings => {
    return cacheBindingsSchema.parse(env);
};
