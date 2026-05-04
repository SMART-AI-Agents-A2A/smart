import { Logger } from './logger';

export const customLogger = (message: string, ...rest: string[]) => {
    if (message.startsWith('<--')) {
        const [_, method, path] = message.split(' ');
        Logger.log(`REQUEST  method=${method} path=${path}`);
    } else if (message.startsWith('-->')) {
        const [_, method, path, status, ms] = message.split(' ');
        Logger.log(`RESPONSE method=${method} path=${path} status=${status} duration=${ms}`);
    } else {
        Logger.log(message, ...rest);
    }
};
