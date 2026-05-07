import { Hono } from 'hono';
import { userRouter } from './features/user';
import { influxdbRouter } from './features/agents/tools/influxdb';
import { openWeatherRoutes } from './features/agents/tools/openweather';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);
router.route('/influxdb', influxdbRouter);
router.route('/openweather', openWeatherRoutes);

export { router };
