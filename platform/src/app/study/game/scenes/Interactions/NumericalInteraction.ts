import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

// Interface for numerical slider
export interface NumericalSlider {
    sliderContainer: Phaser.GameObjects.GameObject[];
    sliderWidth: number;
    sliderHeight: number;
}

export class NumericalInteractionManager {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create a beautiful numerical slider control
     */
    public createNumericalInteraction(
        struct: InteractionStructure,
        predefinedValue: number,
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: number) => void
    ): NumericalSlider {
        // Enhanced dimensions
        const trackWidth = 120;
        const trackHeight = 8;
        const handleRadius = 12;
        const trackColor = 0xDDDDDD;
        const activeTrackColor = 0xBBDEFF;
        const handleColor = 0xFFFFFF;
        const handleBorderColor = 0xCCCCCC;
        const intervalColor = 0x999999;
        const valueDisplayBgColor = 0xEEEEEE;
        
        let sliderWidth = trackWidth + 40; // Add extra space for value display
        let sliderHeight = handleRadius * 2 + 20; // Add extra padding

        const range = [
            Number.parseInt(struct.inputData.type['Range']![0].toString()),
            Number.parseInt(struct.inputData.type['Range']![1].toString())
        ];
        
        const interval = Number.parseInt(struct.inputData.type['Interval']!.toString());
        const unitOfMeasure = struct.inputData.unitOfMeasure || '';

        let sliderContainer: Phaser.GameObjects.GameObject[] = [];
    
        // Background track (inactive part)
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
        
        track.x += Math.floor(track.displayWidth / 2);
        track.y += Math.floor(track.displayHeight / 2);
        
        // Active part of the track (filled based on value)
        const activeTrack = this.scene.add.rectangle(
            Math.floor(track.x - track.displayWidth / 2),
            Math.floor(track.y),
            0, // Will be updated based on handle position
            trackHeight,
            activeTrackColor,
            0.9
        )
        .setDepth(1.1)
        .setOrigin(0, 0.5);
        
        // Handle with shadow effect
        const handleShadow = this.scene.add.circle(
            Math.floor(track.x),
            Math.floor(track.y + 2),
            handleRadius + 1,
            0x000000,
            0.2
        )
        .setDepth(1.9)
        .setOrigin(0.5);
        
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
        
        // Value display rectangle (shows current value)
        const valueDisplay = this.scene.add.rectangle(
            Math.floor(track.x + trackWidth / 2 + 45),  // Increased spacing from 25 to 45
            Math.floor(track.y),
            40,
            24,
            valueDisplayBgColor,
            0.8
        )
        .setDepth(1.5)
        .setOrigin(0.5)
        .setStrokeStyle(1, handleBorderColor);
        
        // Value text
        const valueText = this.scene.add.text(
            Math.floor(valueDisplay.x),
            Math.floor(valueDisplay.y),
            predefinedValue?.toString() || '0',
            { fontSize: '14px', fontFamily: 'Arial', color: '#000000' }
        )
        .setDepth(1.6)
        .setOrigin(0.5);
        
        // Add all elements to container
        sliderContainer.push(track);
        sliderContainer.push(activeTrack);
        sliderContainer.push(handleShadow);
        sliderContainer.push(handle);
        sliderContainer.push(valueDisplay);
        sliderContainer.push(valueText);
    
        // Set initial handle position based on predefinedValue
        let currentValue = predefinedValue !== undefined 
            ? Math.round(predefinedValue / interval) * interval
            : range[0];
            
        handle.x = this.mapValueToPosition(currentValue, track, range);
        handleShadow.x = handle.x;
        
        // Update active track width based on handle position
        this.updateActiveTrack(activeTrack, track, handle);
        
        // Update value display
        valueText.setText(currentValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
        
        // Create interval markers
        for (let value = range[0]; value <= range[1]; value += interval) {
            const x = this.mapValueToPosition(value, track, range);
            
            // Interval tick marker
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
            
            // Add value labels for major intervals
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
                
                // Adjust slider height to accommodate labels
                const newRequiredHeight = intervalLabel.y + intervalLabel.height - track.y + 5;
                if (newRequiredHeight > sliderHeight) {
                    sliderHeight = newRequiredHeight;
                }
            }
        }
        
        // Handle drag events
        handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
            const minX = track.x - track.width / 2;
            const maxX = track.x + track.width / 2;
            handle.x = Phaser.Math.Clamp(dragX, minX, maxX);
            handleShadow.x = Math.floor(handle.x);
            
            const value = this.mapPositionToValue(handle.x, track, range);
            const snappedValue = Math.round(value / interval) * interval;
            
            // Snap handle position
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            handleShadow.x = Math.floor(handle.x);
            
            // Update active track
            this.updateActiveTrack(activeTrack, track, handle);
            
            // Update value display
            valueText.setText(snappedValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
            
            // Call change handler
            onValueChange(struct.name, snappedValue);
        });
        
        // Add visual feedback on drag start/end
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
        
        // Make track clickable
        track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.downElement !== handle) {
                const clickX = pointer.x;
                const value = this.mapPositionToValue(clickX, track, range);
                const snappedValue = Math.round(value / interval) * interval;
                
                // Animate handle to new position
                this.scene.tweens.add({
                    targets: [handle, handleShadow],
                    x: this.mapValueToPosition(snappedValue, track, range),
                    duration: 200,
                    ease: 'Back.easeOut',
                    onUpdate: () => {
                        this.updateActiveTrack(activeTrack, track, handle);
                    },
                    onComplete: () => {
                        // Update value display
                        valueText.setText(snappedValue + (unitOfMeasure ? ' ' + unitOfMeasure : ''));
                        // Call change handler
                        onValueChange(struct.name, snappedValue);
                    }
                });
            }
        });
        
        // Initial call to update active track
        this.updateActiveTrack(activeTrack, track, handle);
        
        return { 
            sliderContainer, 
            sliderWidth: Math.max(trackWidth + valueDisplay.width + 30, sliderWidth), 
            sliderHeight 
        };
    }
    
    /**
     * Update the active track width based on handle position
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
     * Map a value to a position on the slider
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
     * Map a position on the slider to a value
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