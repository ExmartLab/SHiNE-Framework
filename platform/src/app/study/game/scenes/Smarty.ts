import { eventsCenter } from "../EventsCenter";
import { Scene } from 'phaser';
import { InteractionStructure, StatusVariable, InteractionGroup, PanelData } from './Interactions/InteractionTypes';
import { NumericalInteractionManager } from './Interactions/NumericalInteraction';
import { BooleanInteractionManager } from './Interactions/BooleanInteraction';
import { GenericInteractionManager } from './Interactions/GenericInteraction';
import { DynamicPropertyManager } from './Interactions/DynamicProperty';
import { StatelessActionManager } from './Interactions/StatelessAction';

/**
 * Smarty scene manages the device interaction panel overlay
 * Handles display of device controls, status variables, and user interactions
 */
class Smarty extends Scene {
    /** X position for panel content layout */
    private listPositionX: number = 25;
    /** Y position for panel content layout (dynamically adjusted) */
    private listPositionY: number = 30;
    /** Group containing all panel UI elements */
    private panelGroup: Phaser.GameObjects.Group | null;
    /** Background rectangle for the control panel */
    private smartHomePanel: Phaser.GameObjects.Rectangle;
    /** Button to close the panel and return to normal view */
    private returnButton: Phaser.GameObjects.Image;

    /** Array of status variables displaying current device state */
    private statusVariables: StatusVariable[] = [];
    /** Currently active device identifier */
    private currentDevice: string;
    /** Wall scene containing the current device */
    private deviceWall: string;

    /** Groups of interaction elements with visibility rules */
    private interactionGroups: InteractionGroup[] = [];
    /** Map of interaction controls for dynamic enable/disable updates */
    private interactionControls: Map<string, {
        actionName: Phaser.GameObjects.Text,
        elements: Phaser.GameObjects.GameObject[],
        struct: InteractionStructure
    }> = new Map();
    
    /** Manager for numerical slider interactions */
    private numericalManager: NumericalInteractionManager;
    /** Manager for boolean switch interactions */
    private booleanManager: BooleanInteractionManager;
    /** Manager for generic dropdown interactions */
    private genericManager: GenericInteractionManager;
    /** Manager for dynamic property displays */
    private dynamicPropertyManager: DynamicPropertyManager;
    /** Manager for stateless action buttons */
    private statelessActionManager: StatelessActionManager;

    /** Whether the panel is currently available for interaction */
    private panelAvailable: boolean = false;
    /** Flag to prevent infinite loops during external updates */
    private processingExternalUpdate: boolean = false;

    /**
     * Preload assets required for the Smarty interface
     */
    preload(): void {
        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    /**
     * Initialize the Smarty scene with interaction managers and event listeners
     */
    create(): void {
        // Initialize interaction managers for different control types
        this.numericalManager = new NumericalInteractionManager(this);
        this.booleanManager = new BooleanInteractionManager(this);
        this.genericManager = new GenericInteractionManager(this);
        this.dynamicPropertyManager = new DynamicPropertyManager(this);
        this.statelessActionManager = new StatelessActionManager(this);
        
        // Listen for device closeup events to show control panel
        eventsCenter.on('enter-closeup', this.createPanel, this);
        
        // Listen for external interaction updates (from backend/rules)
        eventsCenter.on('update-smarty-interaction', this.handleExternalInteractionUpdate, this);
    }

    /**
     * Handles interaction updates from external sources (backend, rules engine)
     * Prevents infinite update loops and synchronizes UI with external changes
     * @param data The interaction update data
     */
    private handleExternalInteractionUpdate(data: { device: string, interaction: string, value: unknown }): void {
        // Only process if panel is open and update is for current device
        if (this.panelGroup === null || !this.panelAvailable || !this.currentDevice.includes(data.device)) {
            return;
        }

        // Prevent infinite update loops
        this.processingExternalUpdate = true;

        try {
            // Find and update the corresponding status variable
            for (let i = 0; i < this.statusVariables.length; i++) {
                if (this.statusVariables[i].name === data.interaction) {
                    const statusVar = this.statusVariables[i];
                    
                    // Update based on interaction type
                    if (typeof data.value === 'number' && statusVar.struct.InteractionType === 'Numerical_Action') {
                        this.updateNumericalStatusVariable(data.interaction, data.value);
                        this.numericalManager.updateSliderPosition(statusVar.struct, data.value);
                    } 
                    else if (typeof data.value === 'boolean' && statusVar.struct.InteractionType === 'Boolean_Action') {
                        this.updateBooleanStatusVariable(data.interaction, data.value);
                        this.booleanManager.updateSwitchState(statusVar.struct, data.value);
                    }
                    else if (typeof data.value === 'string' && statusVar.struct.InteractionType === 'Generic_Action') {
                        this.updateGenericStatusVariable(data.interaction, data.value);
                        this.genericManager.updateDropdownValue(statusVar.struct, data.value);
                    }
                    else if (typeof data.value === 'string' && statusVar.struct.InteractionType === 'Dynamic_Property') {
                        this.updateDynamicPropertyVariable(data.interaction, data.value);
                        this.dynamicPropertyManager.updatePropertyValue(statusVar.struct, data.value);
                    }
                    
                    // Update conditional visibility
                    this.updateInteractionVisibility(data.interaction, data.value);
                    return;
                }
            }
        } finally {
            // Always reset the flag
            this.processingExternalUpdate = false;
        }
    }

    /**
     * Creates the device control panel with status display and interactive controls
     * @param data Panel configuration data from the device
     */
    createPanel(data: PanelData): void {
        this.currentDevice = data.current_device;
        this.deviceWall = data.device_wall;

        // Log analytics event for entering device closeup
        eventsCenter.emit('game-interaction', {
            type: 'ENTER_DEVICE_CLOSEUP',
            data: { device: data.current_device }
        });

        // Initialize panel layout and cleanup previous panel
        this.initializePanelLayout();
        
        // Create status display section
        let panelWidth = this.createStatusSection(data.interaction_values, data.interaction_structure);
        
        // Add visual divider between status and controls
        panelWidth = this.addDivider(panelWidth);
        
        // Create interactive controls section
        panelWidth = this.createInteractiveSection(data.interaction_values, data.interaction_structure, panelWidth);
        
        // Apply visibility rules based on current values
        this.applyVisibilityRules(data.interaction_values);
        
        // Finalize panel with background and return button
        this.finalizePanelLayout(panelWidth);
    }

    /**
     * Initializes panel layout and cleans up any existing panel
     */
    private initializePanelLayout(): void {
        this.deletePanel();
        this.panelGroup = this.add.group();
        this.listPositionX = 25;
        this.listPositionY = 30;
    }

    /**
     * Creates the status display section showing current device values
     * @param interactionValues Current values of device interactions
     * @param interactionStructure Configuration for device interactions
     * @returns Width of the status section
     */
    private createStatusSection(
        interactionValues: { [key: string]: unknown },
        interactionStructure: InteractionStructure[]
    ): number {
        let textWidth = 20;
        const interactionVariableNames = Object.keys(interactionValues);

        if (interactionVariableNames.length === 0) return textWidth;

        for (let i = 0; i < interactionVariableNames.length; i++) {
            const struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
            if (struct == null) continue;

            // For Dynamic_Property: only show if visible is true, otherwise hide completely
            if (struct.InteractionType === 'Dynamic_Property' && struct.currentState?.visible === false) continue;

            let statusText: Phaser.GameObjects.Text | null = null;

            if (struct.InteractionType === 'Numerical_Action') {
                statusText = this.handleStatusNumerical(struct, interactionValues[interactionVariableNames[i]]);
                this.statusVariables.push({
                    name: struct.name,
                    value: interactionValues[interactionVariableNames[i]],
                    struct: struct,
                    text: statusText
                });
            } else if (struct.InteractionType === 'Boolean_Action') {
                statusText = this.handleStatusBoolean(struct, interactionValues[interactionVariableNames[i]]);
                this.statusVariables.push({
                    name: struct.name,
                    value: Boolean(interactionValues[interactionVariableNames[i]]),
                    struct: struct,
                    text: statusText
                });
            } else if (struct.InteractionType === 'Generic_Action') {
                statusText = this.handleStatusGeneric(struct, interactionValues[interactionVariableNames[i]]);
                this.statusVariables.push({
                    name: struct.name,
                    value: String(interactionValues[interactionVariableNames[i]]),
                    struct: struct,
                    text: statusText
                });
            } else if (struct.InteractionType === 'Dynamic_Property') {
                const currentValue = struct.currentState?.value || interactionValues[interactionVariableNames[i]];
                statusText = this.handleStatusDynamicProperty(struct, currentValue);
                this.statusVariables.push({
                    name: struct.name,
                    value: String(currentValue),
                    struct: struct,
                    text: statusText
                });
            }

            if (statusText != null) {
                this.listPositionY += statusText.displayHeight;
                if (statusText.displayWidth > textWidth) {
                    textWidth = statusText.displayWidth;
                }
                this.panelGroup!.add(statusText);
            }
        }

        return textWidth;
    }

    /**
     * Adds a visual divider between status and interactive sections
     * @param currentWidth Current panel width
     * @returns Updated panel width
     */
    private addDivider(currentWidth: number): number {
        this.listPositionY += 2;
        const divider = this.add.rectangle(
            this.listPositionX + 3, 
            this.listPositionY, 
            currentWidth + 15, 
            2, 
            0x000000, 
            0.8
        ).setOrigin(0).setDepth(1);

        this.panelGroup!.add(divider);
        
        this.listPositionY += divider.displayHeight + 2;
        return Math.max(currentWidth, divider.displayWidth);
    }

    /**
     * Creates the interactive controls section with sliders and switches
     * @param interactionValues Current values of device interactions
     * @param interactionStructure Configuration for device interactions
     * @param currentWidth Current panel width
     * @returns Updated panel width
     */
    private createInteractiveSection(
        interactionValues: { [key: string]: unknown },
        interactionStructure: InteractionStructure[],
        currentWidth: number
    ): number {
        let textWidth = currentWidth;
        const interactionVariableNames = Object.keys(interactionValues);

        if (interactionVariableNames.length === 0) return textWidth;

        for (let i = 0; i < interactionVariableNames.length; i++) {
            const struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
            if (struct == null || struct.InteractionType == 'Dynamic_Property' || struct.InteractionType == 'Stateless_Action') continue;

            // Create action label
            const actionName = this.add.text(
                this.listPositionX + 5,
                this.listPositionY,
                'Set ' + struct.name,
                { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
            ).setDepth(1);
            
            this.listPositionY += actionName.displayHeight;
            this.panelGroup!.add(actionName);

            // Check if the control should be enabled or disabled
            const isEnabled = this.isInteractionVisible(struct, interactionValues);
            
            if (struct.InteractionType === 'Numerical_Action') {
                textWidth = this.createNumericalControl(struct, interactionValues[interactionVariableNames[i]], actionName, textWidth, isEnabled);
            } else if (struct.InteractionType === 'Boolean_Action') {
                textWidth = this.createBooleanControl(struct, interactionValues[interactionVariableNames[i]], actionName, textWidth, isEnabled);
            } else if (struct.InteractionType === 'Generic_Action') {
                textWidth = this.createGenericControl(struct, interactionValues[interactionVariableNames[i]], actionName, textWidth, isEnabled);
            }
            // Dynamic_Property is read-only, so no interactive control is created

            this.listPositionY += 7;
        }

        // Handle stateless actions separately (they don't have status variables)
        for (let i = 0; i < interactionStructure.length; i++) {
            const struct = interactionStructure[i];
            if (struct.InteractionType !== 'Stateless_Action') continue;

            // Create action label for stateless action
            const actionName = this.add.text(
                this.listPositionX + 5,
                this.listPositionY,
                struct.name,
                { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
            ).setDepth(1);
            
            this.listPositionY += actionName.displayHeight;
            this.panelGroup!.add(actionName);

            // Check if the control should be enabled or disabled
            const isEnabled = this.isInteractionVisible(struct, interactionValues);
            
            textWidth = this.createStatelessActionControl(struct, actionName, textWidth, isEnabled);

            this.listPositionY += 7;
        }

        return textWidth;
    }

    /**
     * Creates a numerical slider control
     * @param struct Interaction structure configuration
     * @param value Current value
     * @param actionName Label text object
     * @param currentWidth Current panel width
     * @param isEnabled Whether the control should be interactive or grayed out
     * @returns Updated panel width
     */
    private createNumericalControl(
        struct: InteractionStructure,
        value: unknown,
        actionName: Phaser.GameObjects.Text,
        currentWidth: number,
        isEnabled: boolean = true
    ): number {
        const numericalAction = this.numericalManager.createNumericalInteraction(
            struct, 
            value,
            this.listPositionX,
            this.listPositionY,
            (name, newValue) => {
                if (isEnabled) {
                    this.updateNumericalStatusVariable(name, newValue);
                    this.updateInteractionVisibility(name, newValue);
                }
            }
        );

        // Update layout tracking
        this.listPositionY += numericalAction.sliderHeight;
        const newWidth = Math.max(currentWidth, numericalAction.sliderWidth);

        // Add to panel group
        numericalAction.sliderContainer.forEach(element => {
            this.panelGroup?.add(element);
        });

        // Apply disabled styling if not enabled
        if (!isEnabled) {
            actionName.setAlpha(0.5);
            numericalAction.sliderContainer.forEach(element => {
                element.setAlpha(0.5);
                if (element.input) {
                    element.disableInteractive();
                }
            });
        }

        // Store interaction control for dynamic enable/disable updates
        this.interactionControls.set(struct.name, {
            actionName,
            elements: numericalAction.sliderContainer,
            struct
        });

        return newWidth;
    }

    /**
     * Creates a boolean switch control
     * @param struct Interaction structure configuration
     * @param value Current value
     * @param actionName Label text object
     * @param currentWidth Current panel width
     * @param isEnabled Whether the control should be interactive or grayed out
     * @returns Updated panel width
     */
    private createBooleanControl(
        struct: InteractionStructure,
        value: unknown,
        actionName: Phaser.GameObjects.Text,
        currentWidth: number,
        isEnabled: boolean = true
    ): number {
        const booleanAction = this.booleanManager.createBooleanInteraction(
            struct, 
            Boolean(value),
            this.listPositionX,
            this.listPositionY,
            (name, newValue) => {
                if (isEnabled) {
                    this.updateBooleanStatusVariable(name, newValue);
                    this.updateInteractionVisibility(name, newValue);
                }
            }
        );
        
        // Update layout tracking
        this.listPositionY += booleanAction.displayHeight;
        const newWidth = Math.max(currentWidth, booleanAction.displayWidth);

        // Add to panel group
        booleanAction.switchGroup.forEach(element => {
            this.panelGroup?.add(element);
        });

        // Apply disabled styling if not enabled
        if (!isEnabled) {
            actionName.setAlpha(0.5);
            booleanAction.switchGroup.forEach(element => {
                element.setAlpha(0.5);
                if (element.input) {
                    element.disableInteractive();
                }
            });
        }

        // Store interaction control for dynamic enable/disable updates
        this.interactionControls.set(struct.name, {
            actionName,
            elements: booleanAction.switchGroup,
            struct
        });

        return newWidth;
    }

    /**
     * Creates a generic dropdown control
     * @param struct Interaction structure configuration
     * @param value Current value
     * @param actionName Label text object
     * @param currentWidth Current panel width
     * @param isEnabled Whether the control should be interactive or grayed out
     * @returns Updated panel width
     */
    private createGenericControl(
        struct: InteractionStructure,
        value: unknown,
        actionName: Phaser.GameObjects.Text,
        currentWidth: number,
        isEnabled: boolean = true
    ): number {
        const genericAction = this.genericManager.createGenericInteraction(
            struct, 
            String(value),
            this.listPositionX,
            this.listPositionY,
            (name, newValue) => {
                if (isEnabled) {
                    this.updateGenericStatusVariable(name, newValue);
                    this.updateInteractionVisibility(name, newValue);
                }
            }
        );
        
        // Update layout tracking
        this.listPositionY += genericAction.displayHeight;
        const newWidth = Math.max(currentWidth, genericAction.displayWidth);

        // Add to panel group
        genericAction.dropdownGroup.forEach(element => {
            this.panelGroup?.add(element);
        });

        // Apply disabled styling if not enabled
        if (!isEnabled) {
            actionName.setAlpha(0.5);
            genericAction.dropdownGroup.forEach(element => {
                element.setAlpha(0.5);
                if (element.input) {
                    element.disableInteractive();
                }
            });
        }

        // Store interaction control for dynamic enable/disable updates
        this.interactionControls.set(struct.name, {
            actionName,
            elements: genericAction.dropdownGroup,
            struct
        });

        return newWidth;
    }

    /**
     * Creates a stateless action button control
     * @param struct Interaction structure configuration
     * @param actionName Label text object
     * @param currentWidth Current panel width
     * @param isEnabled Whether the control should be interactive or grayed out
     * @returns Updated panel width
     */
    private createStatelessActionControl(
        struct: InteractionStructure,
        actionName: Phaser.GameObjects.Text,
        currentWidth: number,
        isEnabled: boolean = true
    ): number {
        const statelessAction = this.statelessActionManager.createStatelessAction(
            struct, 
            this.listPositionX,
            this.listPositionY,
            (name) => {
                if (isEnabled) {
                    this.triggerStatelessAction(name);
                }
            }
        );

        // Update layout tracking
        this.listPositionY += statelessAction.displayHeight;
        const newWidth = Math.max(currentWidth, statelessAction.displayWidth);

        // Add to panel group
        statelessAction.buttonGroup.forEach(element => {
            this.panelGroup?.add(element);
        });

        // Apply disabled styling if not enabled
        if (!isEnabled) {
            actionName.setAlpha(0.5);
            statelessAction.buttonGroup.forEach(element => {
                element.setAlpha(0.5);
                if (element.input) {
                    element.disableInteractive();
                }
            });
        }

        // Store interaction control for dynamic enable/disable updates
        this.interactionControls.set(struct.name, {
            actionName,
            elements: statelessAction.buttonGroup,
            struct
        });

        return newWidth;
    }


    /**
     * Applies visibility rules based on current interaction values
     * @param interactionValues Current values of all interactions
     */
    private applyVisibilityRules(interactionValues: { [key: string]: unknown }): void {
        Object.keys(interactionValues).forEach(interactionName => {
            this.updateInteractionVisibility(interactionName, interactionValues[interactionName]);
        });
    }

    /**
     * Finalizes the panel layout with background and controls
     * @param panelWidth Final width of the panel content
     */
    private finalizePanelLayout(panelWidth: number): void {
        // Create panel background
        this.smartHomePanel = this.add.rectangle(
            25,
            25,
            panelWidth + 20,
            this.listPositionY - 20,
            0xfeead0,
            0.8
        ).setStrokeStyle(0.25, 0x000000).setOrigin(0).setDepth(0.98);

        // Add return button and finalize
        const returnButton = this.createReturnButton();
        this.panelGroup!.add(returnButton);
        this.panelGroup!.add(this.smartHomePanel);
        
        this.panelAvailable = true;
        this.scene.bringToTop(this.scene.key);
    }

    /**
     * Creates a return button to close the panel and exit closeup mode
     * @returns The created return button
     */
    private createReturnButton(): Phaser.GameObjects.Image {
        this.returnButton = this.add.image(
            Number(this.game.config.width) * 0.95,
            Number(this.game.config.height) * 0.95,
            'return_btn'
        )
        .setOrigin(1)
        .setDepth(1)
        .setScale(
            this.game.config.scaleRoomElementsX,
            this.game.config.scaleRoomElementsY
        );
        
        this.returnButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.deletePanel();
            // Exit closeup mode and reset camera zoom
            eventsCenter.emit('exit-closeup', this.deviceWall, { resetZoom: true });
            // Log analytics event for exiting device closeup
            eventsCenter.emit('game-interaction', {
                type: 'EXIT_DEVICE_CLOSEUP',
                data: { device: this.currentDevice }
            });
            this.returnButton.setVisible(true);
        });
        
        return this.returnButton;
    }

    /**
     * Destroys the current panel and cleans up all associated data
     * Removes all UI elements and resets state variables
     */
    private deletePanel(): void {
        if (this.panelGroup == null) return;
        
        // Clean up all panel UI elements
        this.panelGroup.clear(true, true);
        this.panelGroup.destroy();
        this.panelGroup = null;
        
        // Reset panel state
        this.statusVariables = [];
        this.interactionGroups = [];
        this.interactionControls.clear();
        this.panelAvailable = false;
    }

    /**
     * Finds an interaction structure by name from the device's configuration
     * @param name Name of the interaction to find
     * @param interactionStructure Array of interaction structures to search
     * @returns The matching interaction structure or null if not found
     */
    private findInteractionStructureByName(
        name: string,
        interactionStructure: InteractionStructure[]
    ): InteractionStructure | null {
        for (let i = 0; i < interactionStructure.length; i++) {
            if (interactionStructure[i].name === name) {
                return interactionStructure[i];
            }
        }
        return null;
    }

    /**
     * Creates a status text display for numerical interactions
     * @param struct Interaction structure with configuration
     * @param value Current numerical value
     * @returns Text object displaying the status
     */
    private handleStatusNumerical(
        struct: InteractionStructure,
        value: number
    ): Phaser.GameObjects.Text {
        const unitOfMeasure = struct.inputData.unitOfMeasure || '';
        const statusTextContent = `${struct.name}: ${value} ${unitOfMeasure}`.trim();
        
        return this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
        ).setDepth(1);
    }

    /**
     * Creates a status text display for boolean interactions
     * @param struct Interaction structure with configuration
     * @param value Current boolean value
     * @returns Text object displaying the status
     */
    private handleStatusBoolean(
        struct: InteractionStructure,
        value: boolean
    ): Phaser.GameObjects.Text {
        const transformedValue = value ? struct.inputData.type.True : struct.inputData.type.False;
        const unitOfMeasure = struct.inputData.unitOfMeasure || '';
        const statusTextContent = `${struct.name}: ${transformedValue} ${unitOfMeasure}`.trim();
        
        return this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
        ).setDepth(1);
    }

    /**
     * Creates a status text display for generic interactions
     * @param struct Interaction structure with configuration
     * @param value Current string value
     * @returns Text object displaying the status
     */
    private handleStatusGeneric(
        struct: InteractionStructure,
        value: string
    ): Phaser.GameObjects.Text {
        const unitOfMeasure = struct.inputData.unitOfMeasure || '';
        const statusTextContent = `${struct.name}: ${value} ${unitOfMeasure}`.trim();
        
        return this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
        ).setDepth(1);
    }

    /**
     * Creates a status text display for dynamic property interactions
     * @param struct Interaction structure with configuration
     * @param value Current string value
     * @returns Text object displaying the status
     */
    private handleStatusDynamicProperty(
        struct: InteractionStructure,
        value: string
    ): Phaser.GameObjects.Text {
        const unitOfMeasure = struct.outputData?.unitOfMeasure || '';
        const statusTextContent = `${struct.name}: ${value} ${unitOfMeasure}`.trim();
        
        return this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
        ).setDepth(1);
    }

    /**
     * Updates a numerical status variable and triggers necessary events
     * @param name Name of the interaction to update
     * @param value New numerical value
     */
    private updateNumericalStatusVariable(name: string, value: number): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                const statusVar = this.statusVariables[i];
                statusVar.value = value;
                
                // Update status display text
                const unitOfMeasure = statusVar.struct.inputData.unitOfMeasure || '';
                statusVar.text.setText(`${name}: ${value} ${unitOfMeasure}`.trim());

                const updateData = {
                    device: this.currentDevice,
                    interaction: statusVar.struct.name,
                    value: value
                };

                // Always emit for internal device synchronization
                eventsCenter.emit('update-interaction', updateData);
                
                // Only emit backend update if not processing external changes
                if (!this.processingExternalUpdate) {
                    eventsCenter.emit('update-interaction-backend', updateData);
                }
                
                return;
            }
        }
    }

    /**
     * Updates a boolean status variable and triggers necessary events
     * @param name Name of the interaction to update
     * @param value New boolean value
     */
    private updateBooleanStatusVariable(name: string, value: boolean): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                const statusVar = this.statusVariables[i];
                const transformedValue = value ? 
                    statusVar.struct.inputData.type.True : 
                    statusVar.struct.inputData.type.False;
                
                statusVar.value = value;
                statusVar.text.setText(`${name}: ${transformedValue}`);

                const updateData = {
                    device: this.currentDevice,
                    interaction: statusVar.struct.name,
                    value: value
                };

                // Always emit for internal device synchronization
                eventsCenter.emit('update-interaction', updateData);
                
                // Only emit backend update if not processing external changes
                if (!this.processingExternalUpdate) {
                    eventsCenter.emit('update-interaction-backend', updateData);
                }
                
                return;
            }
        }
    }

    /**
     * Updates a generic status variable and triggers necessary events
     * @param name Name of the interaction to update
     * @param value New string value
     */
    private updateGenericStatusVariable(name: string, value: string): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                const statusVar = this.statusVariables[i];
                statusVar.value = value;
                
                // Update status display text
                const unitOfMeasure = statusVar.struct.inputData.unitOfMeasure || '';
                statusVar.text.setText(`${name}: ${value} ${unitOfMeasure}`.trim());

                const updateData = {
                    device: this.currentDevice,
                    interaction: statusVar.struct.name,
                    value: value
                };

                // Always emit for internal device synchronization
                eventsCenter.emit('update-interaction', updateData);
                
                // Only emit backend update if not processing external changes
                if (!this.processingExternalUpdate) {
                    eventsCenter.emit('update-interaction-backend', updateData);
                }
                
                return;
            }
        }
    }

    /**
     * Updates a dynamic property variable and triggers necessary events
     * @param name Name of the property to update
     * @param value New string value
     */
    private updateDynamicPropertyVariable(name: string, value: string): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                const statusVar = this.statusVariables[i];
                statusVar.value = value;
                
                // Update status display text
                const unitOfMeasure = statusVar.struct.outputData?.unitOfMeasure || '';
                statusVar.text.setText(`${name}: ${value} ${unitOfMeasure}`.trim());

                const updateData = {
                    device: this.currentDevice,
                    interaction: statusVar.struct.name,
                    value: value
                };

                // Always emit for internal device synchronization
                eventsCenter.emit('update-interaction', updateData);
                
                // Dynamic properties don't typically need backend updates since they're read-only
                // But emit if not processing external changes for consistency
                if (!this.processingExternalUpdate) {
                    eventsCenter.emit('update-interaction-backend', updateData);
                }
                
                return;
            }
        }
    }

    /**
     * Checks if an interaction should be enabled based on its visibility rules
     * @param struct The interaction structure to check
     * @param interactionValues Current values of all interactions
     * @returns True if the interaction should be enabled, false if disabled
     */
    private isInteractionVisible(struct: InteractionStructure, interactionValues: { [key: string]: unknown }): boolean {
        const visible = struct.currentState?.visible;
        
        // If visibility is a simple boolean
        if (typeof visible === 'boolean') {
            return visible;
        }
        
        // If visibility is an array of conditions
        if (Array.isArray(visible)) {
            return visible.every(condition => {
                const currentValue = interactionValues[condition.name];
                return currentValue === condition.value;
            });
        }
        
        // Default to enabled if no visibility rules
        return true;
    }

    /**
     * Updates the enabled/disabled state of interaction elements based on conditional rules
     * Applies grayed-out styling instead of hiding elements
     * @param interactionName Name of the interaction that changed
     * @param value New value of the interaction
     */
    private updateInteractionVisibility(interactionName: string, value: unknown): void {
        // Update all interaction controls that have visibility rules depending on this interaction
        this.interactionControls.forEach((control, controlName) => {
            const visible = control.struct.currentState?.visible;
            
            // Check if this control's visibility depends on the changed interaction
            if (Array.isArray(visible)) {
                const dependsOnChangedInteraction = visible.some(condition => condition.name === interactionName);
                if (dependsOnChangedInteraction) {
                    // Recalculate if the control should be enabled
                    const allInteractionValues: { [key: string]: unknown } = {};
                    this.statusVariables.forEach(statusVar => {
                        allInteractionValues[statusVar.name] = statusVar.value;
                    });
                    
                    const shouldBeEnabled = this.isInteractionVisible(control.struct, allInteractionValues);
                    this.updateControlEnabledState(control, shouldBeEnabled);
                }
            }
        });
    }
    
    /**
     * Updates the visual enabled/disabled state of a control
     * @param control The control to update
     * @param isEnabled Whether the control should be enabled or disabled
     */
    private updateControlEnabledState(control: { actionName: Phaser.GameObjects.Text, elements: Phaser.GameObjects.GameObject[] }, isEnabled: boolean): void {
        if (isEnabled) {
            // Enable the control
            control.actionName.setAlpha(1);
            control.elements.forEach(element => {
                element.setAlpha(1);
                if (element.input && !element.input.enabled) {
                    element.setInteractive();
                }
            });
        } else {
            // Disable the control
            control.actionName.setAlpha(0.5);
            control.elements.forEach(element => {
                element.setAlpha(0.5);
                if (element.input) {
                    element.disableInteractive();
                }
            });
        }
    }

    /**
     * Handles stateless action triggers (button presses)
     * @param name Name of the stateless action that was triggered
     */
    private triggerStatelessAction(name: string): void {
        const updateData = {
            device: this.currentDevice,
            interaction: name,
            value: null // Stateless actions don't have values
        };

        // Emit for internal device synchronization
        eventsCenter.emit('update-interaction', updateData);
        
        // Only emit backend update if not processing external changes
        if (!this.processingExternalUpdate) {
            eventsCenter.emit('update-interaction-backend', updateData);
        }
    }
}

export default Smarty;