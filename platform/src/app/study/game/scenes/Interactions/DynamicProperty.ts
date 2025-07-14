import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

/**
 * Interface for dynamic property display components
 * Contains the visual elements and dimensions of a read-only property display
 */
export interface DynamicPropertyDisplay {
    displayGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

/**
 * Manages dynamic property displays in the game scene
 * Handles creation and visual updates of read-only property values
 */
export class DynamicPropertyManager {
    private scene: Scene;
    /** Map of active property displays by name, storing visual components and current value */
    private activeProperties: Map<string, {
        container: Phaser.GameObjects.Rectangle,
        valueText: Phaser.GameObjects.Text,
        currentValue: string
    }>;

    /**
     * Initialize the dynamic property manager
     * @param scene The Phaser scene to create property displays in
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.activeProperties = new Map();
    }
    
    /**
     * Update the displayed value of a dynamic property
     * @param struct The interaction structure identifying the property
     * @param value The new value to display
     */
    public updatePropertyValue(struct: InteractionStructure, value: string): void {
        const propertyData = this.activeProperties.get(struct.name);
        if (!propertyData) {
            console.warn(`Dynamic property for ${struct.name} not found`);
            return;
        }
        
        // Only update if the value has changed
        if (propertyData.currentValue !== value) {
            propertyData.currentValue = value;
            
            // Format the display value with unit of measure
            const unitOfMeasure = struct.outputData?.unitOfMeasure || '';
            const displayValue = unitOfMeasure ? `${value} ${unitOfMeasure}`.trim() : value;
            
            propertyData.valueText.setText(displayValue);
            
            // Add a subtle animation to indicate value change
            this.scene.tweens.add({
                targets: propertyData.valueText,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 150,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
            
            // Brief highlight effect on the container
            this.scene.tweens.add({
                targets: propertyData.container,
                alpha: 0.8,
                duration: 200,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }
    }
    
    /**
     * Get the current value of a dynamic property
     * @param name The name of the property
     * @returns The current value or null if not found
     */
    public getCurrentValue(name: string): string | null {
        const propertyData = this.activeProperties.get(name);
        return propertyData ? propertyData.currentValue : null;
    }
}