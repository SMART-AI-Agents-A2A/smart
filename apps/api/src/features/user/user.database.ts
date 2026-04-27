import { _db } from '../../core/';
import { users, UserValueObject, type UserOutbound } from './';

export const UserDatabase = {
    async list(): Promise<UserOutbound[]> {
        const rows = await _db.select().from(users);
        return rows.map(UserValueObject.createOutbound);
    },
};
