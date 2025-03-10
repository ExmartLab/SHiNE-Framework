import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

// Interface for boolean switch
export interface BooleanSwitch {
    switchGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

export class BooleanInteractionManager {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create a boolean switch control
     */
    public createBooleanInteraction(
        struct: InteractionStructure,
        predefinedValue: boolean = false,
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: boolean) => void
    ): BooleanSwitch {
        let switchGroup: Phaser.GameObjects.GameObject[] = [];
        const trueText = struct.inputData.type['True']!;
        const falseText = struct.inputData.type['False']!;
        
        const switchWidth = 60;
        const switchHeight = 30;
        let displayWidth = 0;
        let displayHeight = 0;
        
        const track = this.scene.add.rectangle(
            listPositionX + 15,
            listPositionY + 3,
            switchWidth,
            switchHeight
        )
        .setDepth(1)
        .setOrigin(0.5);
        
        switchGroup.push(track);
        
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;

        displayWidth = track.displayWidth;
        displayHeight = track.displayHeight;
    
        const handle = this.scene.add.circle(
            track.x + (predefinedValue ? switchWidth / 4 : -switchWidth / 4),
            track.y,
            (switchHeight - 3) / 2,
            0xFFFFFF
        )
        .setDepth(1)
        .setOrigin(0.5);

        switchGroup.push(handle);
    
        const onText = this.scene.add.text(
            track.x + switchWidth / 4 - trueText.length * 3, // Adjust X position for left alignment
            track.y - 6, // Adjust Y position to account for text height
            trueText, 
            { fontSize: '12px', fill: '#00000', color: '#fff' }
        )
        .setDepth(2)
        .setOrigin(0);
        
        const offText = this.scene.add.text(
            Math.round(track.x - switchWidth / 4 - falseText.length * 3), // Adjust X position for left alignment
            Math.round(track.y - 6), // Adjust Y position to account for text height
            falseText, 
            { fontSize: '12px', fill: '#00000', color: '#fff' }
        )
        .setDepth(2)
        .setOrigin(0);

        switchGroup.push(onText);
        switchGroup.push(offText);
    
        track.setInteractive();
        let isOn = predefinedValue;
        handle.fillColor = isOn ? 0x87CEFA : 0x808080;  // lightblue : grey
    
        track.on('pointerdown', () => {
            isOn = !isOn;
            this.scene.tweens.add({
                targets: handle,
                x: track.x + (isOn ? switchWidth / 4 : -switchWidth / 4),
                duration: 200,
                ease: 'Power2'
            });
            handle.fillColor = isOn ? 0x87CEFA : 0x808080;
            onValueChange(struct.name, isOn);
        });
        
        return { switchGroup, displayWidth, displayHeight };
    }
}