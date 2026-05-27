import { Hono } from 'hono';
import { userRouter } from './features/user';
import { a2aRoutes } from './features/a2a';
import { mcpRoutes } from './features/mcp';
import { orquestradorRoutes } from './features/orquestrador';
import { cacheRoutes } from './features/cache';
import { influxdbRouter } from './features/influxdb';
import { openWeatherRoutes } from './features/openweather';
import { aiRouter } from './features/ai';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route('/users', userRouter);
router.route('/influxdb', influxdbRouter);
router.route('/openweather', openWeatherRoutes);
router.route('/cache', cacheRoutes);
router.route('/a2a', a2aRoutes);
router.route('/orquestrador', orquestradorRoutes);
router.route('/mcp', mcpRoutes);
router.route('/ai', aiRouter);

export { router };
