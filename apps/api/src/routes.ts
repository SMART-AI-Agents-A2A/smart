import { Hono } from 'hono';
import { userRouter } from './features/user';
import { influxdbRouter } from './features/agents/tools/influxdb';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);
router.route('/influxdb', influxdbRouter);

export { router };
