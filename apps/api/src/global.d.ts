declare namespace Cloudflare {
    interface Env {
        ACCESS_SECRET: string;
        REFRESH_SECRET: string;
        COOKIE_SECRET: string;
        AUTH_SECRET: string;
        GOOGLE_CLIENT_ID: string;
        GOOGLE_CLIENT_SECRET: string;
        INFLUXDB_URL: string;
        INFLUXDB_ORG: string;
        INFLUXDB_BUCKET: string;
        OPENWEATHER_URL: string;
        OPENWEATHER_API: string;
        smart_cache: KVNamespace;
    }
}
