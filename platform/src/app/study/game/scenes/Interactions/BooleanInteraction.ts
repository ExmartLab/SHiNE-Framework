import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

/**
 * Interface for boolean switch components
 * Contains the visual elements and dimensions of a boolean switch
 */
export interface BooleanSwitch {
    switchGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

/**
 * Manages boolean switch interactions in the game scene
 * Handles creation, state management, and visual updates of boolean switches
 */
export class BooleanInteractionManager {
    private scene: Scene;
    /** Map of active switches by name, storing visual components and state */
    private activeSwitches: Map<string, {
        track: Phaser.GameObjects.Rectangle,
        handle: Phaser.GameObjects.GameObject,
        onText: Phaser.GameObjects.Text,
        offText: Phaser.GameObjects.Text,
        trueText: string,
        falseText: string,
        currentState: boolean
    }>;

    /**
     * Initialize the boolean interaction manager
     * @param scene The Phaser scene to create interactions in
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.activeSwitches = new Map();
    }

    /**
     * Create a boolean switch control with visual components and interaction handlers
     * @param struct The interaction structure containing switch configuration
     * @param predefinedValue Initial state of the switch
     * @param listPositionX X position for the switch
     * @param listPositionY Y position for the switch
     * @param onValueChange Callback function triggered when switch value changes
     * @returns BooleanSwitch object containing visual components and dimensions
     */
    public createBooleanInteraction(
        struct: InteractionStructure,
        predefinedValue: boolean = false,
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: boolean) => void
    ): BooleanSwitch {
        const switchGroup: Phaser.GameObjects.GameObject[] = [];
        const trueText = struct.inputData.type['True']!;
        const falseText = struct.inputData.type['False']!;
        
        // Switch visual configuration
        const switchWidth = 90;
        const switchHeight = 34;
        let displayWidth = 0;
        let displayHeight = 0;
        
        // Color scheme for the switch
        const trackColor = 0xDDDDDD;    // Light gray for inactive state
        const activeColor = 0xBBDEFF;   // Light blue for active state
        const activeAlpha = 0.8;        // Opacity when switch is on
        const inactiveAlpha = 0.6;      // Opacity when switch is off
        
        // Create the switch track (background)
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
        
        switchGroup.push(track);
        
        // Position the track and record dimensions
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;
        displayWidth = track.displayWidth;
        displayHeight = track.displayHeight;
    
        // Create the circular handle that slides within the track
        const handleRadius = (switchHeight - 8) / 2;
        const handle = this.scene.add.circle(
            track.x + (predefinedValue ? switchWidth / 4 : -switchWidth / 4),
            track.y,
            handleRadius,
            0xFFFFFF
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0xCCCCCC);
        
        // Set initial track color based on predefined state
        if (predefinedValue) {
            track.fillColor = activeColor;
        } else {
            track.fillColor = trackColor;
        }

        switchGroup.push(handle);
    
        // Text styling for switch labels
        const textStyle = { 
            fontSize: '14px', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            color: '#000000' 
        };
        
        // Calculate text scaling for longer text labels
        const maxTextLength = Math.max(trueText.length, falseText.length);
        const textScale = maxTextLength > 6 ? 0.8 : 1;
        
        // Create "on" text label (true state)
        const onText = this.scene.add.text(
            Math.floor(track.x + switchWidth / 4),
            Math.floor(track.y),
            trueText, 
            textStyle
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setScale(textScale)
        .setAlpha(predefinedValue ? 1 : 0.5);
        
        // Create "off" text label (false state)
        const offText = this.scene.add.text(
            Math.floor(track.x - switchWidth / 4),
            Math.floor(track.y),
            falseText, 
            textStyle
        )
        .setDepth(2)
        .setOrigin(0.5)
        .setScale(textScale)
        .setAlpha(predefinedValue ? 0.5 : 1);

        switchGroup.push(onText);
        switchGroup.push(offText);
    
        // Store switch components and state for later updates
        this.activeSwitches.set(struct.name, {
            track,
            handle,
            onText,
            offText,
            trueText,
            falseText,
            currentState: predefinedValue
        });
    
        // Add hover effect - increase opacity on mouse over
        track.on('pointerover', () => {
            this.scene.tweens.add({
                targets: track,
                alpha: track.alpha + 0.1,
                duration: 100,
                ease: 'Sine.easeOut'
            });
        });
        
        // Reset opacity when mouse leaves
        track.on('pointerout', () => {
            const isOn = this.activeSwitches.get(struct.name)?.currentState || false;
            
            this.scene.tweens.add({
                targets: track,
                alpha: isOn ? activeAlpha : inactiveAlpha,
                duration: 100,
                ease: 'Sine.easeIn'
            });
        });
        
        // Handle click events with state toggling and animations
        track.on('pointerdown', () => {
            const switchData = this.activeSwitches.get(struct.name);
            if (!switchData) return;
            
            // Toggle the current state
            const newState = !switchData.currentState;
            switchData.currentState = newState;
            
            // Animate handle sliding to new position
            this.scene.tweens.add({
                targets: handle,
                x: track.x + (newState ? switchWidth / 4 : -switchWidth / 4),
                duration: 250,
                ease: 'Back.easeOut'
            });
            
            // Update track color and opacity
            track.fillColor = newState ? activeColor : trackColor;
            this.scene.tweens.add({
                targets: track,
                alpha: newState ? activeAlpha : inactiveAlpha,
                duration: 250
            });
            
            // Fade text labels based on active state
            this.scene.tweens.add({
                targets: onText,
                alpha: newState ? 1 : 0.5,
                duration: 250
            });
            
            this.scene.tweens.add({
                targets: offText,
                alpha: newState ? 0.5 : 1,
                duration: 250
            });
            
            // Add bounce effect to handle for tactile feedback
            this.scene.tweens.add({
                targets: handle,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
            
            // Trigger callback with new state
            onValueChange(struct.name, newState);
        });
        
        return { switchGroup, displayWidth, displayHeight };
    }

    /**
     * Programmatically update the visual state of a boolean switch
     * @param struct The interaction structure identifying the switch
     * @param value The new boolean value to set
     */
    public updateSwitchState(struct: InteractionStructure, value: boolean): void {
        const switchObj = this.activeSwitches.get(struct.name);
        if (!switchObj) {
            console.warn(`Switch for ${struct.name} not found`);
            return;
        }
        
        // Update internal state tracking
        switchObj.currentState = value;

        // Visual constants
        const trackColor = 0xDDDDDD;
        const activeColor = 0xBBDEFF;
        const activeAlpha = 0.8;
        const inactiveAlpha = 0.6;
        const switchWidth = 90;
        
        // Check if visual update is needed
        const currentX = switchObj.handle.x;
        const targetX = switchObj.track.x + (value ? switchWidth / 4 : -switchWidth / 4);
        
        if (Math.abs(currentX - targetX) > 1) {
            // Animate handle to new position
            this.scene.tweens.add({
                targets: switchObj.handle,
                x: targetX,
                duration: 250,
                ease: 'Back.easeOut'
            });
            
            // Update track appearance
            switchObj.track.fillColor = value ? activeColor : trackColor;
            this.scene.tweens.add({
                targets: switchObj.track,
                alpha: value ? activeAlpha : inactiveAlpha,
                duration: 250
            });
            
            // Update text label opacity
            this.scene.tweens.add({
                targets: switchObj.onText,
                alpha: value ? 1 : 0.5,
                duration: 250
            });
            
            this.scene.tweens.add({
                targets: switchObj.offText,
                alpha: value ? 0.5 : 1,
                duration: 250
            });
            
            // Add feedback animation
            this.scene.tweens.add({
                targets: switchObj.handle,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
        }
    }
}