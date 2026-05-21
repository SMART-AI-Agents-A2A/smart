import { Hono } from 'hono';
import { userRouter } from './features/user';
import {
    a2aRoutes,
    cacheRoutes,
    influxdbRouter,
    mcpRoutes,
    openWeatherRoutes,
    orquestradorRoutes,
} from './features/agents';
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
