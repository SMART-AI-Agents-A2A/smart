import { Hono } from 'hono';
import { userRouter } from './features/user';
import { influxdbRouter } from './features/agents/tools/influxdb';
import { openWeatherRoutes } from './features/agents/tools/openweather';
import { cacheRoutes } from './features/agents/tools/cache';
import { a2aRoutes } from './features/agents/a2a';
import { orquestradorRoutes } from './features/agents/orquestrador';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);
router.route('/influxdb', influxdbRouter);
router.route('/openweather', openWeatherRoutes);
router.route('/cache', cacheRoutes);
router.route('/a2a', a2aRoutes);
router.route('/orquestrador', orquestradorRoutes);

export { router };
