const productionApiOrigin = 'https://api-smart.smart-agent.workers.dev';
const localApiOrigin = 'http://localhost:8787';

function getRuntimeApiOrigin() {
    if (typeof window === 'undefined') {
        return localApiOrigin;
    }

    return window.location.hostname.endsWith('.workers.dev') ? productionApiOrigin : localApiOrigin;
}

export const apiOrigin = import.meta.env.VITE_API_BASE_URL ?? getRuntimeApiOrigin();
