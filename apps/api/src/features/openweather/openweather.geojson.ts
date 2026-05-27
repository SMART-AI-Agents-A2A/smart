import { z } from 'zod';
import { setoresWgs84Geojson } from './openweather.geojson.data';
import type { GeoJsonPosition, OpenWeatherFarmLocation } from './openweather.vo';

const FARM_NAME = 'Fazenda NSAAB';

const positionSchema = z.tuple([z.number(), z.number()]);

const polygonCoordinatesSchema = z.array(z.array(positionSchema));

const multiPolygonCoordinatesSchema = z.array(polygonCoordinatesSchema);

const geojsonFeatureSchema = z.object({
    type: z.literal('Feature'),
    properties: z.record(z.string(), z.unknown()).optional(),
    geometry: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('Polygon'),
            coordinates: polygonCoordinatesSchema,
        }),
        z.object({
            type: z.literal('MultiPolygon'),
            coordinates: multiPolygonCoordinatesSchema,
        }),
    ]),
});

const geojsonFeatureCollectionSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(geojsonFeatureSchema).min(1),
});

type GeoJsonFeature = z.infer<typeof geojsonFeatureSchema>;

const geojson = geojsonFeatureCollectionSchema.parse(setoresWgs84Geojson);

const getOuterRings = (feature: GeoJsonFeature): readonly (readonly GeoJsonPosition[])[] => {
    if (feature.geometry.type === 'Polygon') {
        return [feature.geometry.coordinates[0] ?? []];
    }

    return feature.geometry.coordinates.map((polygon) => polygon[0] ?? []);
};

const getAllPositions = (): readonly GeoJsonPosition[] => {
    return geojson.features.flatMap((feature) => getOuterRings(feature).flat());
};

const calculateBoundingBox = (): OpenWeatherFarmLocation['bbox'] => {
    const positions = getAllPositions();

    if (positions.length === 0) {
        throw new Error('GeoJSON não possui coordenadas válidas.');
    }

    const longitudes = positions.map((position) => position[0]);
    const latitudes = positions.map((position) => position[1]);

    return {
        minLatitude: Math.min(...latitudes),
        minLongitude: Math.min(...longitudes),
        maxLatitude: Math.max(...latitudes),
        maxLongitude: Math.max(...longitudes),
    };
};

const calculateBoundingBoxCenter = (): {
    readonly latitude: number;
    readonly longitude: number;
} => {
    const bbox = calculateBoundingBox();

    return {
        latitude: (bbox.minLatitude + bbox.maxLatitude) / 2,
        longitude: (bbox.minLongitude + bbox.maxLongitude) / 2,
    };
};

const calculateRingArea = (ring: readonly GeoJsonPosition[]): number => {
    if (ring.length < 3) {
        return 0;
    }

    let area = 0;

    for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];

        area += current[0] * next[1] - next[0] * current[1];
    }

    return area / 2;
};

const calculateRingCentroid = (
    ring: readonly GeoJsonPosition[],
): {
    readonly latitude: number;
    readonly longitude: number;
    readonly area: number;
} => {
    const area = calculateRingArea(ring);

    if (ring.length === 0) {
        return {
            latitude: 0,
            longitude: 0,
            area: 0,
        };
    }

    if (Math.abs(area) < 1e-12) {
        const total = ring.reduce(
            (accumulator, position) => ({
                longitude: accumulator.longitude + position[0],
                latitude: accumulator.latitude + position[1],
            }),
            {
                longitude: 0,
                latitude: 0,
            },
        );

        return {
            latitude: total.latitude / ring.length,
            longitude: total.longitude / ring.length,
            area: 0,
        };
    }

    let longitude = 0;
    let latitude = 0;

    for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];

        const factor = current[0] * next[1] - next[0] * current[1];

        longitude += (current[0] + next[0]) * factor;
        latitude += (current[1] + next[1]) * factor;
    }

    return {
        latitude: latitude / (6 * area),
        longitude: longitude / (6 * area),
        area,
    };
};

const calculateFarmCentroid = (): {
    readonly latitude: number;
    readonly longitude: number;
} => {
    const centroids = geojson.features.flatMap((feature) =>
        getOuterRings(feature).map(calculateRingCentroid),
    );

    const validCentroids = centroids.filter((centroid) => Math.abs(centroid.area) > 1e-12);

    if (validCentroids.length === 0) {
        return calculateBoundingBoxCenter();
    }

    const weighted = validCentroids.reduce(
        (accumulator, centroid) => {
            const weight = Math.abs(centroid.area);

            return {
                longitude: accumulator.longitude + centroid.longitude * weight,
                latitude: accumulator.latitude + centroid.latitude * weight,
                area: accumulator.area + weight,
            };
        },
        {
            longitude: 0,
            latitude: 0,
            area: 0,
        },
    );

    return {
        latitude: weighted.latitude / weighted.area,
        longitude: weighted.longitude / weighted.area,
    };
};

export const getOpenWeatherFarmLocation = (): OpenWeatherFarmLocation => {
    const centroid = calculateFarmCentroid();

    return {
        name: FARM_NAME,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        bbox: calculateBoundingBox(),
        geojsonFeatures: geojson.features.length,
    };
};
