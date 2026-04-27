export class Logger {
    static log(message: string, ...rest: any[]) {
        console.log(`[${getBrazilTime()}] ${message}`, ...rest);
    }

    static warn(message: string, ...rest: any[]) {
        console.warn(`[${getBrazilTime()}] ${message}`, ...rest);
    }

    static error(message: string, ...rest: any[]) {
        console.error(`[${getBrazilTime()}] ${message}`, ...rest);
    }
}

const getBrazilTime = () => {
    const now = new Date();
    const brazilTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(now);

    return brazilTime.replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$3-$2-$1 $4');
};
