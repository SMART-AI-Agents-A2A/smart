import { z } from 'zod';
import { UserRoleEnum } from './user.model';

export const UserOutboundSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: UserRoleEnum,
    image: z.string().nullable(),
    first_login: z.boolean(),
    created_at: z.date().nullable(),
});

export type UserOutbound = z.infer<typeof UserOutboundSchema>;

export class UserValueObject {
    static createOutbound(data: unknown): UserOutbound {
        return UserOutboundSchema.parse(data);
    }

    static createSafeOutbound(data: unknown): ReturnType<typeof UserOutboundSchema.safeParse> {
        return UserOutboundSchema.safeParse(data);
    }
}
