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
     * Create a numerical slider control
     */
    public createNumericalInteraction(
        struct: InteractionStructure,
        predefinedValue: number,
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: number) => void
    ): NumericalSlider {
        let sliderWidth = 0;
        let sliderHeight = 0;

        const range = [
            Number.parseInt(struct.inputData.type['Range']![0].toString()),
            Number.parseInt(struct.inputData.type['Range']![1].toString())
        ];
        
        const interval = Number.parseInt(struct.inputData.type['Interval']!.toString());

        let sliderContainer: Phaser.GameObjects.GameObject[] = [];
    
        let track = this.scene.add.rectangle(
            listPositionX + 20,
            listPositionY + 10,
            80,
            4,
            0x666666
        ).setDepth(1).setOrigin(0.5);
        
        let handle = this.scene.add.circle(
            listPositionX + 20,
            listPositionY + 10,
            8,
            0x00ff00
        ).setDepth(1).setOrigin(0.5);
        
        handle.setInteractive({ draggable: true });

        sliderContainer.push(track);
        sliderContainer.push(handle);

        // Set slider width and height based on track and handle for the outer box
        sliderWidth = track.displayWidth + 20;
        sliderHeight = track.displayHeight + 10;

        if (sliderWidth < handle.displayWidth)
            sliderWidth = handle.displayWidth;

        if (sliderHeight < handle.displayHeight)
            sliderHeight = handle.displayHeight;
    
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;
    
        // Set initial handle position based on predefinedValue
        if (predefinedValue !== undefined) {
            const snappedValue = Math.round(predefinedValue / interval) * interval;
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            onValueChange(struct.name, snappedValue);
        }
    
        let circleInterval: Phaser.GameObjects.Arc;
        for (let value = range[0]; value <= range[1]; value += interval) {
            const x = this.mapValueToPosition(value, track, range);
            circleInterval = this.scene.add.circle(
                x,
                listPositionY + 10,
                3,
                0x444444
            ).setDepth(1).setOrigin(0.5);
            
            sliderContainer.push(circleInterval);
        }
    
        handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
            const minX = track.x - track.width / 2;
            const maxX = track.x + track.width / 2;
            handle.x = Phaser.Math.Clamp(dragX, minX, maxX);
            
            const value = this.mapPositionToValue(handle.x, track, range);
            const snappedValue = Math.round(value / interval) * interval;
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            
            onValueChange(struct.name, snappedValue);
        });
        
        return { sliderContainer, sliderWidth, sliderHeight };
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