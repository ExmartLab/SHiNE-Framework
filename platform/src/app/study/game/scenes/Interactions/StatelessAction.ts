import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

/**
 * Interface for stateless action button components
 * Contains the visual elements and dimensions of a stateless action button
 */
export interface StatelessActionButton {
    buttonGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

/**
 * Manages stateless action button interactions in the game scene
 * Handles creation and visual feedback for button press interactions
 */
export class StatelessActionManager {
    private scene: Scene;
    /** Map of active buttons by name, storing visual components */
    private activeButtons: Map<string, {
        button: Phaser.GameObjects.Rectangle,
        buttonText: Phaser.GameObjects.Text
    }>;

    /**
     * Initialize the stateless action manager
     * @param scene The Phaser scene to create interactions in
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.activeButtons = new Map();
    }

    /**
     * Create a stateless action button with visual components and interaction handlers
     * @param struct The interaction structure containing button configuration
     * @param listPositionX X position for the button
     * @param listPositionY Y position for the button
     * @param onActionTriggered Callback function triggered when button is pressed
     * @returns StatelessActionButton object containing visual components and dimensions
     */
    public createStatelessAction(
        struct: InteractionStructure,
        listPositionX: number,
        listPositionY: number,
        onActionTriggered: (name: string) => void
    ): StatelessActionButton {
        const buttonGroup: Phaser.GameObjects.GameObject[] = [];
        
        // Button visual configuration
        const buttonWidth = 120;
        const buttonHeight = 40;
        let displayWidth = 0;
        let displayHeight = 0;
        
        // Color scheme for the button
        const buttonColor = 0x4A90E2;        // Blue background
        const hoverColor = 0x357ABD;         // Darker blue on hover
        const activeColor = 0x2E5A8A;       // Even darker blue when pressed
        const textColor = '#FFFFFF';        // White text
        
        // Create the button background
        const button = this.scene.add.rectangle(
            Math.floor(listPositionX + 15),
            Math.floor(listPositionY + 3),
            buttonWidth,
            buttonHeight,
            buttonColor
        )
        .setDepth(1)
        .setOrigin(0)
        .setStrokeStyle(2, 0x357ABD)
        .setInteractive({ useHandCursor: true });
        
        buttonGroup.push(button);
        
        // Position the button and record dimensions
        displayWidth = button.displayWidth;
        displayHeight = button.displayHeight;
        
        // Create button text (temporarily create to measure dimensions)
        const tempText = this.scene.add.text(0, 0, struct.name, {
            fontSize: '16px', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            color: textColor 
        });
        
        // Calculate centered position with origin 0
        const textX = Math.floor(button.x + (button.displayWidth - tempText.displayWidth) / 2);
        const textY = Math.floor(button.y + (button.displayHeight - tempText.displayHeight) / 2);
        
        // Destroy temp text and create actual text at correct position
        tempText.destroy();
        
        const buttonText = this.scene.add.text(
            textX,
            textY,
            struct.name,
            { 
                fontSize: '16px', 
                fontFamily: 'Arial', 
                fontStyle: 'bold',
                color: textColor 
            }
        )
        .setDepth(2)
        .setOrigin(0);
        
        buttonGroup.push(buttonText);
        
        // Store button components for reference
        this.activeButtons.set(struct.name, {
            button,
            buttonText
        });
        
        // Add hover effects
        button.on('pointerover', () => {
            button.fillColor = hoverColor;
            this.scene.tweens.add({
                targets: [button, buttonText],
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Sine.easeOut'
            });
        });
        
        // Reset hover effect when mouse leaves
        button.on('pointerout', () => {
            button.fillColor = buttonColor;
            this.scene.tweens.add({
                targets: [button, buttonText],
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Sine.easeIn'
            });
        });
        
        // Handle button press
        button.on('pointerdown', () => {
            // Visual feedback for button press
            button.fillColor = activeColor;
            
            // Scale down effect for press feedback
            this.scene.tweens.add({
                targets: [button, buttonText],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    // Scale back up
                    this.scene.tweens.add({
                        targets: [button, buttonText],
                        scaleX: 1,
                        scaleY: 1,
                        duration: 100,
                        ease: 'Back.easeOut'
                    });
                    
                    // Reset color after animation
                    setTimeout(() => {
                        button.fillColor = buttonColor;
                    }, 50);
                }
            });
            
            // Trigger the action callback
            onActionTriggered(struct.name);
        });
        
        return { buttonGroup, displayWidth, displayHeight };
    }

    /**
     * Programmatically trigger a button press effect (visual feedback only)
     * @param struct The interaction structure identifying the button
     */
    public triggerButtonEffect(struct: InteractionStructure): void {
        const buttonData = this.activeButtons.get(struct.name);
        if (!buttonData) {
            console.warn(`Button for ${struct.name} not found`);
            return;
        }
        
        const { button, buttonText } = buttonData;
        
        // Visual feedback for programmatic trigger
        const originalColor = button.fillColor;
        button.fillColor = 0x2E5A8A; // Active color
        
        // Scale animation
        this.scene.tweens.add({
            targets: [button, buttonText],
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 100,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: [button, buttonText],
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100,
                    ease: 'Back.easeOut'
                });
                
                // Reset color
                setTimeout(() => {
                    button.fillColor = originalColor;
                }, 50);
            }
        });
    }
}