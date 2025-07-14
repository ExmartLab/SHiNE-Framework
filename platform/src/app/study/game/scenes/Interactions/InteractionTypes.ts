/**
 * Defines the structure for device interactions in the smart home simulation
 * Contains configuration for both boolean switches and numerical sliders
 */
export interface InteractionStructure {
    /** Unique identifier for the interaction */
    name: string;
    /** Type of interaction ('Boolean' or 'Numerical') */
    InteractionType: string;
    /** Input configuration data for the interaction */
    inputData?: {
        /** Type-specific configuration options */
        type: {
            /** Range for numerical interactions [min, max] */
            Range?: number[];
            /** Step interval for numerical interactions */
            Interval?: number;
            /** Label for true state in boolean interactions */
            True?: string;
            /** Label for false state in boolean interactions */
            False?: string;
            /** String options for generic dropdown interactions */
            String?: {
                Options: string[];
            };
            /** Additional type-specific properties */
            [key: string]: unknown;
        };
        /** Unit of measurement for numerical values (e.g., "°C", "%") */
        unitOfMeasure?: string;
        /** Additional input data properties */
        [key: string]: unknown;
    };
    /** Output configuration data for read-only properties */
    outputData?: {
        /** Data type specification for the output value */
        valueType?: string[];
        /** Unit of measurement for output values (e.g., "°C", "%") */
        unitOfMeasure?: string;
        /** Additional output data properties */
        [key: string]: unknown;
    };
    /** Current state and visibility configuration */
    currentState?: {
        /** Visibility conditions or simple boolean visibility */
        visible?: VisibilityCondition[] | boolean;
        /** Current value for all interaction types */
        value?: unknown;
        /** Additional state properties */
        [key: string]: unknown;
    };
    /** Additional interaction properties */
    [key: string]: unknown;
}

/**
 * Represents a status variable that displays current device state
 * Used for showing read-only information about device status
 */
export interface StatusVariable {
    /** Name identifier for the status variable */
    name: string;
    /** Current value of the status variable */
    value: unknown;
    /** Associated interaction structure configuration */
    struct: InteractionStructure;
    /** Phaser text object for displaying the status */
    text: Phaser.GameObjects.Text;
}

/**
 * Defines conditions that control when interactions are visible
 * Used for conditional display based on other device states
 */
export interface VisibilityCondition {
    /** Name of the variable or device state to check */
    name: string;
    /** Required value for the condition to be met */
    value: unknown;
}

/**
 * Groups related interaction elements together with shared visibility rules
 * Allows for managing multiple UI elements as a single unit
 */
export interface InteractionGroup {
    /** Array of Phaser game objects that belong to this group */
    elements: Phaser.GameObjects.GameObject[];
    /** Optional visibility conditions that apply to the entire group */
    visibility?: VisibilityCondition[] | boolean;
}

/**
 * Contains all data needed to render a device interaction panel
 * Used when displaying device controls in the smart home interface
 */
export interface PanelData {
    /** Identifier of the currently selected device */
    current_device: string;
    /** Current values for all device interactions */
    interaction_values: { [key: string]: unknown };
    /** Configuration structures for all available interactions */
    interaction_structure: InteractionStructure[];
    /** Wall or location identifier where the device is mounted */
    device_wall: string;
}