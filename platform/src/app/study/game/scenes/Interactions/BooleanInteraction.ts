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
        
        // Wider dimensions for better text display
        const switchWidth = 90;
        const switchHeight = 34;
        let displayWidth = 0;
        let displayHeight = 0;
        
        // Softer, more transparent colors
        const trackColor = 0xDDDDDD; // Light gray
        const activeColor = 0xBBDEFF; // Very light blue
        const activeAlpha = 0.8;
        const inactiveAlpha = 0.6;
        const cornerRadius = 17; // Rounded ends
        
        // Create the track as a rounded rectangle
        const track = this.scene.add.rectangle(
            listPositionX + 15,
            listPositionY + 3,
            switchWidth,
            switchHeight,
            trackColor,
            predefinedValue ? activeAlpha : inactiveAlpha
        )
        .setDepth(1)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
        
        // Apply rounded corners (if available in your Phaser version)
        if (track.setRoundedRectangle) {
            track.setRoundedRectangle(switchWidth, switchHeight, cornerRadius);
        }
        
        switchGroup.push(track);
        
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;

        displayWidth = track.displayWidth;
        displayHeight = track.displayHeight;
    
        // Create a larger, more visible handle
        const handleRadius = (switchHeight - 8) / 2;
        const handle = this.scene.add.circle(
            track.x + (predefinedValue ? switchWidth / 4 : -switchWidth / 4),
            track.y,
            handleRadius,
            0xFFFFFF
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0xCCCCCC); // Light border for depth
        
        if (predefinedValue) {
            // Set initial color for the track based on state
            track.fillColor = activeColor;
        } else {
            track.fillColor = trackColor;
        }

        switchGroup.push(handle);
    
        // Black text styling
        const textStyle = { 
            fontSize: '14px', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            color: '#000000' 
        };
        
        // Calculate text positions with adjustments for longer text
        const maxTextLength = Math.max(trueText.length, falseText.length);
        const textScale = maxTextLength > 6 ? 0.8 : 1; // Scale down longer text
        
        // Position text for better readability
        const onText = this.scene.add.text(
            Math.floor(track.x + switchWidth / 4),
            Math.floor(track.y),
            trueText, 
            textStyle
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setScale(textScale)
        .setAlpha(predefinedValue ? 1 : 0.5); // Fade when inactive
        
        const offText = this.scene.add.text(
            Math.floor(track.x - switchWidth / 4),
            Math.floor(track.y),
            falseText, 
            textStyle
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setScale(textScale)
        .setAlpha(predefinedValue ? 0.5 : 1); // Fade when inactive

        switchGroup.push(onText);
        switchGroup.push(offText);
    
        // Store the initial state
        let isOn = predefinedValue;
    
        // Add hover effect
        track.on('pointerover', () => {
            this.scene.tweens.add({
                targets: track,
                alpha: track.alpha + 0.1,
                duration: 100,
                ease: 'Sine.easeOut'
            });
        });
        
        track.on('pointerout', () => {
            this.scene.tweens.add({
                targets: track,
                alpha: isOn ? activeAlpha : inactiveAlpha,
                duration: 100,
                ease: 'Sine.easeIn'
            });
        });
        
        // Handle click with smooth animation
        track.on('pointerdown', () => {
            isOn = !isOn;
            
            // Animate handle movement
            this.scene.tweens.add({
                targets: handle,
                x: track.x + (isOn ? switchWidth / 4 : -switchWidth / 4),
                duration: 250,
                ease: 'Back.easeOut'
            });
            
            // Animate track changes
            track.fillColor = isOn ? activeColor : trackColor;
            this.scene.tweens.add({
                targets: track,
                alpha: isOn ? activeAlpha : inactiveAlpha,
                duration: 250
            });
            
            // Animate text opacity for active state indication
            this.scene.tweens.add({
                targets: onText,
                alpha: isOn ? 1 : 0.5,
                duration: 250
            });
            
            this.scene.tweens.add({
                targets: offText,
                alpha: isOn ? 0.5 : 1,
                duration: 250
            });
            
            // Add a subtle "bounce" effect to the handle
            this.scene.tweens.add({
                targets: handle,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
            
            onValueChange(struct.name, isOn);
        });
        
        return { switchGroup, displayWidth, displayHeight };
    }
}