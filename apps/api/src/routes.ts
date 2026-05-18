import { Hono } from 'hono';
import { userRouter } from './features/user';
import { influxdbRouter } from './features/agents/tools/influxdb';
import { openWeatherRoutes } from './features/agents/tools/openweather';
import { cacheRoutes } from './features/agents/tools/cache';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);
router.route('/influxdb', influxdbRouter);
router.route('/openweather', openWeatherRoutes);
router.route('/cache', cacheRoutes);

export { router };
