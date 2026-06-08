import { Select } from '@base-ui/react/select';
import { Check, ChevronsUpDown, Sparkles } from 'lucide-react';
import { aiModels } from '../dashboard.constants';
import type { AiModelId } from '../dashboard.type';

const items = aiModels.map((model) => ({ value: model.id, label: model.label }));

type DashboardModelSelectProps = {
    value: AiModelId;
    onValueChange: (value: AiModelId) => void;
    disabled?: boolean;
};

export function DashboardModelSelect({
    value,
    onValueChange,
    disabled,
}: DashboardModelSelectProps) {
    return (
        <Select.Root
            disabled={disabled}
            items={items}
            value={value}
            onValueChange={(next) => onValueChange(next as AiModelId)}
        >
            <Select.Trigger aria-label="Modelo de IA" className="dashboard-model-trigger">
                <Sparkles aria-hidden="true" size={14} />
                <Select.Value className="dashboard-model-value" />
                <Select.Icon className="dashboard-model-chevron">
                    <ChevronsUpDown aria-hidden="true" size={14} />
                </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
                <Select.Positioner
                    align="start"
                    className="dashboard-model-positioner"
                    side="top"
                    sideOffset={6}
                >
                    <Select.Popup className="dashboard-model-popup">
                        {aiModels.map((model) => (
                            <Select.Item
                                className="dashboard-model-item"
                                key={model.id}
                                value={model.id}
                            >
                                <Select.ItemText className="dashboard-model-item-text">
                                    {model.label}
                                </Select.ItemText>
                                <Select.ItemIndicator className="dashboard-model-indicator">
                                    <Check aria-hidden="true" size={14} />
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Popup>
                </Select.Positioner>
            </Select.Portal>
        </Select.Root>
    );
}
