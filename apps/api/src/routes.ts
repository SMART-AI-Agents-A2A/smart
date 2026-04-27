import { Hono } from 'hono';
import { userRouter } from './features/user';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);

export { router };
