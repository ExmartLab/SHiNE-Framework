import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

/**
 * Interface for numerical slider components
 * Contains the visual elements and dimensions of a numerical slider
 */
export interface NumericalSlider {
    sliderContainer: Phaser.GameObjects.GameObject[];
    sliderWidth: number;
    sliderHeight: number;
}

/**
 * Manages numerical slider interactions in the game scene
 * Handles creation, state management, and visual updates of numerical sliders
 */
export class NumericalInteractionManager {
    private scene: Scene;
    /** Map of active sliders by name, storing visual components and configuration */
    private activeSliders: Map<string, {
        handle: Phaser.GameObjects.GameObject,
        handleShadow: Phaser.GameObjects.GameObject,
        track: Phaser.GameObjects.Rectangle,
        activeTrack: Phaser.GameObjects.Rectangle,
        valueText: Phaser.GameObjects.Text,
        range: number[],
        interval: number,
        unitOfMeasure: string,
        currentValue: number
    }>;

    /**
     * Initialize the numerical interaction manager
     * @param scene The Phaser scene to create interactions in
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.activeSliders = new Map();
    }

    /**
     * Create a numerical slider control with visual components and interaction handlers
     * @param struct The interaction structure containing slider configuration
     * @param predefinedValue Initial value of the slider
     * @param listPositionX X position for the slider
     * @param listPositionY Y position for the slider
     * @param onValueChange Callback function triggered when slider value changes
     * @returns NumericalSlider object containing visual components and dimensions
     */
    public createNumericalInteraction(
        struct: InteractionStructure,
        predefinedValue: number,
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: number) => void
    ): NumericalSlider {
        // Slider visual configuration
        const trackWidth = 120;
        const trackHeight = 8;
        const handleRadius = 12;
        const trackColor = 0xDDDDDD;         // Light gray for inactive track
        const activeTrackColor = 0xBBDEFF;   // Light blue for active portion
        const handleColor = 0xFFFFFF;        // White handle
        const handleBorderColor = 0xCCCCCC;  // Light gray border
        const intervalColor = 0x999999;      // Gray for interval markers
        const valueDisplayBgColor = 0xEEEEEE; // Light gray for value display
        
        const sliderWidth = trackWidth + 40;   // Extra space for value display
        const sliderHeight = handleRadius * 2 + 20; // Extra padding for labels

        // Extract slider configuration from interaction structure
        const range = [
            Number.parseInt(struct.inputData.type['Range']![0].toString()),
            Number.parseInt(struct.inputData.type['Range']![1].toString())
        ];
        const interval = Number.parseInt(struct.inputData.type['Interval']!.toString());
        const unitOfMeasure = struct.inputData.unitOfMeasure || '';

        const sliderContainer: Phaser.GameObjects.GameObject[] = [];
    
        // Create the main slider track (background)
        const track = this.scene.add.rectangle(
            Math.floor(listPositionX + 20),
            Math.floor(listPositionY + handleRadius + 4),
            trackWidth,
            trackHeight,
            trackColor,
            0.8
        )
        .setDepth(1)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
        
        // Position the track
        track.x += Math.floor(track.displayWidth / 2);
        track.y += Math.floor(track.displayHeight / 2);
        
        // Create the active portion of the track (shows current value)
        const activeTrack = this.scene.add.rectangle(
            Math.floor(track.x - track.displayWidth / 2),
            Math.floor(track.y),
            0, // Width will be updated based on handle position
            trackHeight,
            activeTrackColor,
            0.9
        )
        .setDepth(1.1)
        .setOrigin(0, 0.5);
        
        // Create shadow effect for the handle
        const handleShadow = this.scene.add.circle(
            Math.floor(track.x),
            Math.floor(track.y + 2),
            handleRadius + 1,
            0x000000,
            0.2
        )
        .setDepth(1.9)
        .setOrigin(0.5);
        
        // Create the draggable handle
        const handle = this.scene.add.circle(
            Math.floor(track.x),
            Math.floor(track.y),
            handleRadius,
            handleColor
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setStrokeStyle(1, handleBorderColor)
        .setInteractive({ draggable: true, useHandCursor: true });
        
        // Create value display box
        const valueDisplay = this.scene.add.rectangle(
            Math.floor(track.x + trackWidth / 2 + 45),
            Math.floor(track.y),
            40,
            24,
            valueDisplayBgColor,
            0.8
        )
        .setDepth(1.5)
        .setOrigin(0.5)
        .setStrokeStyle(1, handleBorderColor);
        
        // Create text to display current value
        const valueText = this.scene.add.text(
            Math.floor(valueDisplay.x),
            Math.floor(valueDisplay.y),
            predefinedValue?.toString() || '0',
            { fontSize: '14px', fontFamily: 'Arial', color: '#000000' }
        )
        .setDepth(1.6)
        .setOrigin(0.5);
        
        // Add all visual elements to the container
        sliderContainer.push(track);
        sliderContainer.push(activeTrack);
        sliderContainer.push(handleShadow);
        sliderContainer.push(handle);
        sliderContainer.push(valueDisplay);
        sliderContainer.push(valueText);
    
        // Calculate initial handle position based on predefined value
        let currentValue;
        if (predefinedValue !== undefined) {
            // Generate array of valid values based on range and interval
            const validValues = [];
            for (let val = range[0]; val <= range[1]; val += interval) {
                validValues.push(val);
            }
            
            // Fallback to minimum if no valid values
            if (validValues.length === 0) {
                currentValue = range[0];
            } else {
                // Find the closest valid value to the predefined value
                let closestValue = validValues[0];
                let minDifference = Math.abs(predefinedValue - closestValue);
                
                for (let i = 1; i < validValues.length; i++) {
                    const difference = Math.abs(predefinedValue - validValues[i]);
                    if (difference < minDifference) {
                        minDifference = difference;
                        closestValue = validValues[i];
                    }
                }
                
                currentValue = closestValue;
            }
        } else {
            currentValue = range[0];
        }
            
        // Set initial handle and shadow positions
        handle.x = this.mapValueToPosition(currentValue, track, range);
        handleShadow.x = handle.x;
        
        // Update active track to show initial value
        this.updateActiveTrack(activeTrack, track, handle);
        
        // Display initial value with unit of measure
        valueText.setText(currentValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
        
        // Create interval markers along the track
        for (let value = range[0]; value <= range[1]; value += interval) {
            const x = this.mapValueToPosition(value, track, range);
            
            // Create tick mark for each interval
            const intervalMarker = this.scene.add.rectangle(
                Math.floor(x),
                Math.floor(track.y),
                2,
                trackHeight + 4,
                intervalColor,
                0.6
            )
            .setDepth(1.2)
            .setOrigin(0.5);
            
            sliderContainer.push(intervalMarker);
            
            // Add numerical labels for key intervals
            if ((value - range[0]) % (interval * 2) === 0 || value === range[0] || value === range[1]) {
                const intervalLabel = this.scene.add.text(
                    x,
                    track.y + trackHeight + 6,
                    value.toString(),
                    { fontSize: '10px', fontFamily: 'Arial', color: '#666666' }
                )
                .setDepth(1.2)
                .setOrigin(0.5, 0);
                
                sliderContainer.push(intervalLabel);
                
                // Expand slider height if needed for labels
                const newRequiredHeight = intervalLabel.y + intervalLabel.height - track.y + 5;
                if (newRequiredHeight > sliderHeight) {
                    sliderHeight = newRequiredHeight;
                }
            }
        }
        
        // Store slider components and configuration for later updates
        this.activeSliders.set(struct.name, {
            handle,
            handleShadow,
            track,
            activeTrack,
            valueText,
            range,
            interval,
            unitOfMeasure,
            currentValue
        });
        
        // Handle drag events for slider interaction
        handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
            // Constrain handle movement to track bounds
            const minX = track.x - track.width / 2;
            const maxX = track.x + track.width / 2;
            handle.x = Phaser.Math.Clamp(dragX, minX, maxX);
            handleShadow.x = Math.floor(handle.x);
            
            // Convert handle position to raw value
            const rawValue = this.mapPositionToValue(handle.x, track, range);
            
            // Generate valid values for snapping
            const validValues = [];
            for (let val = range[0]; val <= range[1]; val += interval) {
                validValues.push(val);
            }
            
            // Find closest valid value for snapping
            let snappedValue = range[0];
            
            if (validValues.length > 0) {
                let closestValue = validValues[0];
                let minDifference = Math.abs(rawValue - closestValue);
                
                for (let i = 1; i < validValues.length; i++) {
                    const difference = Math.abs(rawValue - validValues[i]);
                    if (difference < minDifference) {
                        minDifference = difference;
                        closestValue = validValues[i];
                    }
                }
                
                snappedValue = closestValue;
            }
            
            // Snap handle to the closest valid position
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            handleShadow.x = Math.floor(handle.x);
            
            // Update visual feedback
            this.updateActiveTrack(activeTrack, track, handle);
            valueText.setText(snappedValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
            
            // Only trigger callback if value actually changed
            const sliderData = this.activeSliders.get(struct.name);
            if (sliderData) {
                if (sliderData.currentValue !== snappedValue) {
                    sliderData.currentValue = snappedValue;
                    onValueChange(struct.name, snappedValue);
                }
            }
        });
        
        // Add visual feedback when dragging starts
        handle.on('dragstart', () => {
            this.scene.tweens.add({
                targets: handle,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100
            });
            
            this.scene.tweens.add({
                targets: valueDisplay,
                alpha: 1,
                duration: 200
            });
        });
        
        // Reset visual feedback when dragging ends
        handle.on('dragend', () => {
            this.scene.tweens.add({
                targets: handle,
                scaleX: 1,
                scaleY: 1,
                duration: 200
            });
            
            this.scene.tweens.add({
                targets: valueDisplay,
                alpha: 0.8,
                duration: 200
            });
        });
        
        // Allow clicking on track to jump to position
        track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.downElement !== handle) {
                const clickX = pointer.x;
                const rawValue = this.mapPositionToValue(clickX, track, range);
                
                // Find closest valid value for click position
                const validValues = [];
                for (let val = range[0]; val <= range[1]; val += interval) {
                    validValues.push(val);
                }
                
                let snappedValue = range[0];
                
                if (validValues.length > 0) {
                    let closestValue = validValues[0];
                    let minDifference = Math.abs(rawValue - closestValue);
                    
                    for (let i = 1; i < validValues.length; i++) {
                        const difference = Math.abs(rawValue - validValues[i]);
                        if (difference < minDifference) {
                            minDifference = difference;
                            closestValue = validValues[i];
                        }
                    }
                    
                    snappedValue = closestValue;
                }
                
                // Only animate if value actually changed
                const sliderData = this.activeSliders.get(struct.name);
                if (sliderData && sliderData.currentValue !== snappedValue) {
                    sliderData.currentValue = snappedValue;
                    
                    // Animate handle to clicked position
                    this.scene.tweens.add({
                        targets: [handle, handleShadow],
                        x: this.mapValueToPosition(snappedValue, track, range),
                        duration: 200,
                        ease: 'Back.easeOut',
                        onUpdate: () => {
                            this.updateActiveTrack(activeTrack, track, handle);
                        },
                        onComplete: () => {
                            valueText.setText(snappedValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
                            onValueChange(struct.name, snappedValue);
                        }
                    });
                }
            }
        });
        
        // Ensure active track is properly initialized
        this.updateActiveTrack(activeTrack, track, handle);
        
        return { 
            sliderContainer, 
            sliderWidth: Math.max(trackWidth + valueDisplay.width + 30, sliderWidth), 
            sliderHeight 
        };
    }
    
    /**
     * Programmatically update the slider position and value display
     * @param struct The interaction structure identifying the slider
     * @param value The new numerical value to set
     */
    public updateSliderPosition(struct: InteractionStructure, value: number): void {
        const slider = this.activeSliders.get(struct.name);
        if (!slider) {
            console.warn(`Slider for ${struct.name} not found`);
            return;
        }
        
        // Generate valid values based on range and interval
        const validValues = [];
        for (let val = slider.range[0]; val <= slider.range[1]; val += slider.interval) {
            validValues.push(val);
        }
        
        // Find closest valid value to the provided value
        let snappedValue = slider.range[0];
        
        if (validValues.length > 0) {
            let closestValue = validValues[0];
            let minDifference = Math.abs(value - closestValue);
            
            for (let i = 1; i < validValues.length; i++) {
                const difference = Math.abs(value - validValues[i]);
                if (difference < minDifference) {
                    minDifference = difference;
                    closestValue = validValues[i];
                }
            }
            
            snappedValue = closestValue;
        }
        
        // Update internal state
        slider.currentValue = snappedValue;
        
        // Calculate target position for handle
        const newX = this.mapValueToPosition(snappedValue, slider.track, slider.range);
        
        // Animate handle and shadow to new position
        this.scene.tweens.add({
            targets: [slider.handle, slider.handleShadow],
            x: newX,
            duration: 200,
            ease: 'Back.easeOut',
            onUpdate: () => {
                this.updateActiveTrack(slider.activeTrack, slider.track, slider.handle);
            },
            onComplete: () => {
                slider.valueText.setText(snappedValue + (slider.unitOfMeasure ? ' ' + slider.unitOfMeasure : ''));
            }
        });
    }
    
    /**
     * Update the visual width of the active track based on handle position
     * @param activeTrack The active portion of the track
     * @param track The full track background
     * @param handle The slider handle
     */
    private updateActiveTrack(
        activeTrack: Phaser.GameObjects.Rectangle,
        track: Phaser.GameObjects.Rectangle,
        handle: Phaser.GameObjects.GameObject
    ): void {
        const trackLeft = track.x - track.width / 2;
        const width = handle.x - trackLeft;
        activeTrack.width = width;
    }
    
    /**
     * Convert a numerical value to its corresponding position on the slider track
     * @param value The numerical value to map
     * @param track The slider track rectangle
     * @param range The min/max range of the slider
     * @returns The x position on the track for the given value
     */
    private mapValueToPosition(
        value: number,
        track: Phaser.GameObjects.Rectangle,
        range: number[]
    ): number {
        const percent = (value - range[0]) / (range[1] - range[0]);
        return track.x - (track.displayWidth / 2) + (percent * track.displayWidth);
    }
    
    /**
     * Convert a position on the slider track to its corresponding numerical value
     * @param x The x position on the track
     * @param track The slider track rectangle
     * @param range The min/max range of the slider
     * @returns The numerical value for the given position
     */
    private mapPositionToValue(
        x: number,
        track: Phaser.GameObjects.Rectangle,
        range: number[]
    ): number {
        const minX = track.x - track.width / 2;
        const percent = (x - minX) / track.width;
        return range[0] + (percent * (range[1] - range[0]));
    }
}