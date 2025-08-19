import { Scene } from 'phaser';
import { InteractionStructure } from './InteractionTypes';

/**
 * Interface for generic dropdown components
 * Contains the visual elements and dimensions of a generic dropdown
 */
export interface GenericDropdown {
    dropdownGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

/**
 * Manages generic dropdown interactions in the game scene
 * Handles creation, state management, and visual updates of dropdown selections
 */
export class GenericInteractionManager {
    private scene: Scene;
    /** Map of active dropdowns by name, storing visual components and state */
    private activeDropdowns: Map<string, {
        container: Phaser.GameObjects.Rectangle,
        selectedText: Phaser.GameObjects.Text,
        dropdown: Phaser.GameObjects.Rectangle,
        optionTexts: Phaser.GameObjects.Text[],
        options: string[],
        currentValue: string,
        isOpen: boolean
    }>;

    /**
     * Initialize the generic interaction manager
     * @param scene The Phaser scene to create interactions in
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.activeDropdowns = new Map();
    }

    /**
     * Create a generic dropdown control with visual components and interaction handlers
     * @param struct The interaction structure containing dropdown configuration
     * @param predefinedValue Initial selected value
     * @param listPositionX X position for the dropdown
     * @param listPositionY Y position for the dropdown
     * @param onValueChange Callback function triggered when dropdown value changes
     * @returns GenericDropdown object containing visual components and dimensions
     */
    public createGenericInteraction(
        struct: InteractionStructure,
        predefinedValue: string = '',
        listPositionX: number,
        listPositionY: number,
        onValueChange: (name: string, value: string) => void
    ): GenericDropdown {
        const dropdownGroup: Phaser.GameObjects.GameObject[] = [];
        const options = struct.inputData.type.String.Options as string[];
        
        // Ensure predefined value is valid
        const initialValue = options.includes(predefinedValue) ? predefinedValue : options[0];
        
        // Dropdown visual configuration
        const containerWidth = 150;
        const containerHeight = 34;
        const dropdownMaxHeight = Math.min(options.length * 30, 120);
        let displayWidth = 0;
        let displayHeight = 0;
        
        // Color scheme for the dropdown
        const containerColor = 0xFFFFFF;
        const borderColor = 0xCCCCCC;
        const hoverColor = 0xE6F3FF;
        
        // Create the main container (selected value display)
        const container = this.scene.add.rectangle(
            listPositionX + 15,
            listPositionY + 3,
            containerWidth,
            containerHeight,
            containerColor
        )
        .setDepth(1)
        .setOrigin(0.5)
        .setStrokeStyle(1, borderColor)
        .setInteractive({ useHandCursor: true });
        
        dropdownGroup.push(container);
        
        // Position the container and record dimensions
        container.x += container.displayWidth / 2;
        container.y += container.displayHeight / 2;
        displayWidth = container.displayWidth;
        displayHeight = container.displayHeight;
        
        // Create text to display selected value
        const selectedText = this.scene.add.text(
            container.x - 60,
            container.y,
            initialValue,
            { 
                fontSize: '14px', 
                fontFamily: 'Arial', 
                color: '#000000'
            }
        )
        .setDepth(2)
        .setOrigin(0, 0.5);
        
        dropdownGroup.push(selectedText);
        
        // Create dropdown arrow
        const arrow = this.scene.add.text(
            container.x + 60,
            container.y,
            '▼',
            { 
                fontSize: '12px', 
                fontFamily: 'Arial', 
                color: '#666666'
            }
        )
        .setDepth(2)
        .setOrigin(1, 0.5);
        
        dropdownGroup.push(arrow);
        
        // Create dropdown options container (initially hidden)
        const dropdown = this.scene.add.rectangle(
            container.x,
            container.y + containerHeight / 2 + dropdownMaxHeight / 2,
            containerWidth,
            dropdownMaxHeight,
            containerColor
        )
        .setDepth(3)
        .setOrigin(0.5)
        .setStrokeStyle(1, borderColor)
        .setVisible(false);
        
        // Create option text elements
        const optionTexts: Phaser.GameObjects.Text[] = [];
        for (let i = 0; i < options.length; i++) {
            const optionText = this.scene.add.text(
                dropdown.x - containerWidth / 2 + 10,
                dropdown.y - dropdownMaxHeight / 2 + (i * 30) + 15,
                options[i],
                { 
                    fontSize: '14px', 
                    fontFamily: 'Arial', 
                    color: '#000000'
                }
            )
            .setDepth(4)
            .setOrigin(0, 0.5)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
            
            // Add hover effect for options
            optionText.on('pointerover', () => {
                optionText.setBackgroundColor('#E6F3FF');
            });
            
            optionText.on('pointerout', () => {
                optionText.setBackgroundColor(null);
            });
            
            // Handle option selection
            optionText.on('pointerdown', () => {
                this.selectOption(struct.name, options[i]);
                onValueChange(struct.name, options[i]);
            });
            
            optionTexts.push(optionText);
        }
        
        // Store dropdown components and state
        this.activeDropdowns.set(struct.name, {
            container,
            selectedText,
            dropdown,
            optionTexts,
            options,
            currentValue: initialValue,
            isOpen: false
        });
        
        // Dropdown is closed on creation
        dropdown.setVisible(false);
        optionTexts.forEach(text => text.setVisible(false));
        
        // Handle container click to toggle dropdown
        container.on('pointerdown', () => {
            this.toggleDropdown(struct.name);
        });
        
        // Add hover effect to container
        container.on('pointerover', () => {
            if (!this.activeDropdowns.get(struct.name)?.isOpen) {
                container.fillColor = hoverColor;
            }
        });
        
        container.on('pointerout', () => {
            if (!this.activeDropdowns.get(struct.name)?.isOpen) {
                container.fillColor = containerColor;
            }
        });
        
        return { dropdownGroup, displayWidth, displayHeight };
    }
    
    /**
     * Toggle the visibility of dropdown options
     * @param name The name of the dropdown to toggle
     */
    private toggleDropdown(name: string): void {
        const dropdownData = this.activeDropdowns.get(name);
        if (!dropdownData) return;
        
        const newState = !dropdownData.isOpen;
        dropdownData.isOpen = newState;
        
        // Show/hide dropdown and options
        dropdownData.dropdown.setVisible(newState);
        dropdownData.optionTexts.forEach(text => text.setVisible(newState));
        
        // Update container appearance
        if (newState) {
            dropdownData.container.fillColor = 0xE6F3FF;
        } else {
            dropdownData.container.fillColor = 0xFFFFFF;
        }
        
        // Close other open dropdowns
        if (newState) {
            this.activeDropdowns.forEach((data, key) => {
                if (key !== name && data.isOpen) {
                    this.toggleDropdown(key);
                }
            });
        }
    }
    
    /**
     * Select an option in the dropdown
     * @param name The name of the dropdown
     * @param value The value to select
     */
    private selectOption(name: string, value: string): void {
        const dropdownData = this.activeDropdowns.get(name);
        if (!dropdownData) return;
        
        // Update selected value
        dropdownData.currentValue = value;
        dropdownData.selectedText.setText(value);
        
        // Close dropdown
        this.toggleDropdown(name);
    }
    
    /**
     * Programmatically update the selected value of a dropdown
     * @param struct The interaction structure identifying the dropdown
     * @param value The new value to set
     */
    public updateDropdownValue(struct: InteractionStructure, value: string): void {
        const dropdownData = this.activeDropdowns.get(struct.name);
        if (!dropdownData) {
            console.warn(`Dropdown for ${struct.name} not found`);
            return;
        }
        
        // Only update if the value is different and valid
        if (dropdownData.currentValue !== value && dropdownData.options.includes(value)) {
            dropdownData.currentValue = value;
            dropdownData.selectedText.setText(value);
        }
    }
}