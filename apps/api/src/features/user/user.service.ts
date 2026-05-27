import { UserDatabase } from './user.database';
import type { UserOutbound } from './user.type';

export const UserService = {
    async list(): Promise<Array<UserOutbound>> {
        return UserDatabase.list();
    },
};
