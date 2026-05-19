import { _db } from '../../core/db';
import { users } from './user.model';
import { type UserOutbound, UserValueObject } from './user.vo';

export const UserDatabase = {
    async list(): Promise<UserOutbound[]> {
        const rows = await _db.select().from(users);
        return rows.map((row) => UserValueObject.createOutbound(row));
    },
};
