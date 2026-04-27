import { z } from 'zod';
import { UserRoleEnum } from '../user/user.model';
import { UserOutboundSchema } from '../user/user.vo';

export const UserAuthInboundSchema = z.object({
    email: z.email(),
    password: z.string(),
});

export const SignupInboundSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(8),
    role: UserRoleEnum.optional().default('viewer'),
});

export const UserAuthOutboundSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: UserRoleEnum,
});

export const LoginOutboundSchema = z.object({
    user: UserOutboundSchema,
    token: z.string(),
});

export type UserAuthInbound = z.infer<typeof UserAuthInboundSchema>;
export type SignupInbound = z.infer<typeof SignupInboundSchema>;
export type UserAuthOutbound = z.infer<typeof UserAuthOutboundSchema>;
export type LoginOutbound = z.infer<typeof LoginOutboundSchema>;

export class UserAuthValueObject {
    static createInbound(data: unknown): UserAuthInbound {
        return UserAuthInboundSchema.parse(data);
    }

    static createSafeInbound(data: unknown): ReturnType<typeof UserAuthInboundSchema.safeParse> {
        return UserAuthInboundSchema.safeParse(data);
    }

    static createSafeSignupInbound(
        data: unknown,
    ): ReturnType<typeof SignupInboundSchema.safeParse> {
        return SignupInboundSchema.safeParse(data);
    }

    static createAuthOutbound(data: unknown): UserAuthOutbound {
        return UserAuthOutboundSchema.parse(data);
    }

    static createLoginOutbound(data: unknown): LoginOutbound {
        return LoginOutboundSchema.parse(data);
    }
}
