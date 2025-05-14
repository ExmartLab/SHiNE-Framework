import { Scene } from 'phaser';

// Interface for interaction structure
export interface InteractionStructure {
    name: string;
    InteractionType: string;
    inputData: {
        type: {
            Range?: number[];
            Interval?: number;
            True?: string;
            False?: string;
            [key: string]: any;
        };
        unitOfMeasure?: string;
        [key: string]: any;
    };
    currentState: {
        visible?: VisibilityCondition[] | boolean;
        [key: string]: any;
    };
    [key: string]: any;
}

// Interface for status variable
export interface StatusVariable {
    name: string;
    value: any;
    struct: InteractionStructure;
    text: Phaser.GameObjects.Text;
}

// Interface for interaction visibility condition
export interface VisibilityCondition {
    name: string;
    value: any;
}

// Interface for interaction group
export interface InteractionGroup {
    elements: Phaser.GameObjects.GameObject[];
    visibility?: VisibilityCondition[];
}

// Interface for panel data
export interface PanelData {
    current_device: string;
    interaction_values: { [key: string]: any };
    interaction_structure: InteractionStructure[];
    device_wall: string;
}