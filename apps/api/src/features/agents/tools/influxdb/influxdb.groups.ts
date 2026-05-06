import type {
    GroupByColumn,
    InfluxRow,
    SensorDataGroup,
    SensorFieldSeries,
    SensorFieldUnit,
    SensorGroupedPayload,
    SensorMeasurement,
    SensorPoint,
    SensorQuery,
    SensorSourceSeries,
} from './influxdb.types';
import { buildSensorRange } from './influxdb.flux';

interface SensorGroupConfig {
    readonly defaultGroupBy: GroupByColumn;
    readonly groups: Record<string, readonly string[]>;
    readonly units: Record<string, SensorFieldUnit>;
}

interface MutableSourceSeries {
    readonly sourceKey: string;
    readonly groupByColumn: GroupByColumn;
    readonly groupByValue: string;
    readonly deviceId: string | null;
    readonly unit: string | null;
    readonly block: string | null;
    readonly location: string | null;
    readonly plot: string | null;
    readonly experiment: string | null;
    readonly parameter: string | null;
    readonly points: SensorPoint[];
}

const atmos41Groups = {
    Ar: ['AirHumidity', 'AirTemperature', 'AtmPressure', 'VaporPressure'],
    Vento: ['WindDirection', 'WindSpeed', 'WindGust'],
    Chuva: ['RainAccumulation'],
    'Radiação Solar': ['SolarRadiation'],
    Raios: ['LightningDistance', 'LightningStrikes'],
} as const;

const atmos41Units = {
    AirHumidity: { factor: 1, unit: '%' },
    AirTemperature: { factor: 1, unit: '°C' },
    AtmPressure: { factor: 1, unit: 'hPa' },
    VaporPressure: { factor: 1, unit: 'kPa' },
    WindDirection: { factor: 1, unit: '°' },
    WindSpeed: { factor: 3.6, unit: 'km/h' },
    WindGust: { factor: 3.6, unit: 'km/h' },
    RainAccumulation: { factor: 1, unit: 'mm' },
    SolarRadiation: { factor: 1, unit: 'W/m²' },
    LightningDistance: { factor: 1, unit: 'km' },
    LightningStrikes: { factor: 1, unit: 'descargas' },
} as const satisfies Record<string, SensorFieldUnit>;

const teros12Groups = {
    'Umidade do Solo': ['SoilMoisture', 'SoilRawMoisture'],
    'Temperatura do Solo': ['SoilTemperature'],
    'Condutividade Elétrica': ['SoilElectricalC'],
} as const;

const teros12Units = {
    SoilMoisture: { factor: 1, unit: '%' },
    SoilRawMoisture: { factor: 1, unit: 'contagem bruta' },
    SoilTemperature: { factor: 1, unit: '°C' },
    SoilElectricalC: { factor: 1, unit: 'µS/cm' },
} as const satisfies Record<string, SensorFieldUnit>;

const wxt520Groups = {
    Ar: ['AirHumidity', 'AirTemperature', 'AtmPressure'],
    Vento: ['WindDirection', 'WindSpeed'],
    Chuva: ['RainAccumulation', 'RainDuration', 'RainIntensity'],
} as const;

const wxt520Units = {
    AirHumidity: { factor: 1, unit: '%' },
    AirTemperature: { factor: 1, unit: '°C' },
    AtmPressure: { factor: 1, unit: 'hPa' },
    WindDirection: { factor: 1, unit: '°' },
    WindSpeed: { factor: 3.6, unit: 'km/h' },
    RainAccumulation: { factor: 1, unit: 'mm' },
    RainDuration: { factor: 1, unit: 's' },
    RainIntensity: { factor: 1, unit: 'mm/h' },
} as const satisfies Record<string, SensorFieldUnit>;

const sensorConfig = {
    Atmos41: {
        defaultGroupBy: 'device_id',
        groups: atmos41Groups,
        units: atmos41Units,
    },
    Teros12: {
        defaultGroupBy: 'unit',
        groups: teros12Groups,
        units: teros12Units,
    },
    WXT520: {
        defaultGroupBy: 'unit',
        groups: wxt520Groups,
        units: wxt520Units,
    },
} as const satisfies Record<SensorMeasurement, SensorGroupConfig>;

export const getSensorConfig = (sensor: SensorMeasurement): SensorGroupConfig => {
    return sensorConfig[sensor];
};

export const getDefaultGroupBy = (sensor: SensorMeasurement): GroupByColumn => {
    return getSensorConfig(sensor).defaultGroupBy;
};

export const groupSensorRows = (
    sensor: SensorMeasurement,
    rows: readonly InfluxRow[],
    query: SensorQuery,
): SensorGroupedPayload => {
    const config = getSensorConfig(sensor);
    const groupBy = query.groupedBy ?? config.defaultGroupBy;

    const groups: SensorDataGroup[] = [];

    for (const [groupName, fields] of Object.entries(config.groups)) {
        const groupedFields: SensorFieldSeries[] = [];

        for (const field of fields) {
            const fieldSeries = buildFieldSeries(field, config, rows, groupBy);

            if (fieldSeries !== null) {
                groupedFields.push(fieldSeries);
            }
        }

        groups.push({
            name: groupName,
            fields: groupedFields,
        });
    }

    return {
        sensor,
        range: buildSensorRange(query),
        groupBy,
        groups,
    };
};

export const flattenGroupedPayload = (payload: SensorGroupedPayload): readonly InfluxRow[] => {
    const rows: InfluxRow[] = [];

    for (const group of payload.groups) {
        for (const field of group.fields) {
            for (const source of field.sources) {
                for (const point of source.points) {
                    rows.push({
                        sensor: payload.sensor,
                        group: group.name,
                        field: field.field,
                        groupByColumn: source.groupByColumn,
                        groupByValue: source.groupByValue,
                        sourceKey: source.sourceKey,
                        device_id: source.deviceId,
                        unit: source.unit,
                        block: source.block,
                        location: source.location,
                        plot: source.plot,
                        experiment: source.experiment,
                        parameter: source.parameter,
                        time: point.time,
                        value: point.value,
                        rawValue: point.rawValue,
                        valueUnit: point.unit,
                    });
                }
            }
        }
    }

    return rows;
};

const buildFieldSeries = (
    field: string,
    config: SensorGroupConfig,
    rows: readonly InfluxRow[],
    groupBy: GroupByColumn,
): SensorFieldSeries | null => {
    const unitConfig = config.units[field] ?? {
        factor: 1,
        unit: '',
    };

    const sources = new Map<string, MutableSourceSeries>();

    for (const row of rows) {
        const rawValue = toFiniteNumber(row[field]);

        if (rawValue === null) {
            continue;
        }

        const time = getStringValue(row, '_time');

        if (!time) {
            continue;
        }

        const source = getOrCreateSource(sources, row, groupBy);
        const value = rawValue * unitConfig.factor;

        source.points.push({
            time,
            rawValue,
            value,
            unit: unitConfig.unit,
        });
    }

    if (sources.size === 0) {
        return null;
    }

    return {
        field,
        unit: unitConfig.unit,
        sources: Array.from(sources.values())
            .map(toReadonlySourceSeries)
            .sort((left, right) => left.groupByValue.localeCompare(right.groupByValue)),
    };
};

const getOrCreateSource = (
    sources: Map<string, MutableSourceSeries>,
    row: InfluxRow,
    groupBy: GroupByColumn,
): MutableSourceSeries => {
    const sourceMetadata = buildSourceMetadata(row, groupBy);
    const existingSource = sources.get(sourceMetadata.sourceKey);

    if (existingSource) {
        return existingSource;
    }

    const createdSource: MutableSourceSeries = {
        ...sourceMetadata,
        points: [],
    };

    sources.set(sourceMetadata.sourceKey, createdSource);

    return createdSource;
};

const buildSourceMetadata = (
    row: InfluxRow,
    groupBy: GroupByColumn,
): Omit<MutableSourceSeries, 'points'> => {
    const deviceId = getNullableText(row, 'device_id');
    const unit = getNullableText(row, 'unit');
    const block = getNullableText(row, 'block');
    const location = getNullableText(row, 'location');
    const plot = getNullableText(row, 'plot');
    const experiment = getNullableText(row, 'experiment');
    const parameter = getNullableText(row, 'parameter');
    const groupByValue = getNullableText(row, groupBy) ?? 'sem_grupo';

    const sourceKey = [
        groupBy,
        groupByValue,
        deviceId,
        unit,
        block,
        location,
        plot,
        experiment,
        parameter,
    ]
        .map((value) => value ?? 'null')
        .join('|');

    return {
        sourceKey,
        groupByColumn: groupBy,
        groupByValue,
        deviceId,
        unit,
        block,
        location,
        plot,
        experiment,
        parameter,
    };
};

const toReadonlySourceSeries = (source: MutableSourceSeries): SensorSourceSeries => {
    return {
        sourceKey: source.sourceKey,
        groupByColumn: source.groupByColumn,
        groupByValue: source.groupByValue,
        deviceId: source.deviceId,
        unit: source.unit,
        block: source.block,
        location: source.location,
        plot: source.plot,
        experiment: source.experiment,
        parameter: source.parameter,
        points: [...source.points].sort(sortPointsByTime),
    };
};

const sortPointsByTime = (left: SensorPoint, right: SensorPoint): number => {
    return left.time.localeCompare(right.time);
};

const getNullableText = (row: InfluxRow, column: string): string | null => {
    const value = row[column];

    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    return null;
};

const getStringValue = (row: InfluxRow, column: string): string | null => {
    const value = row[column];

    if (typeof value === 'string') {
        return value;
    }

    return null;
};

const toFiniteNumber = (value: InfluxRow[string] | undefined): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};
