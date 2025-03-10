import { eventsCenter } from "../EventsCenter";
import { Scene } from 'phaser';
import { InteractionStructure, StatusVariable, VisibilityCondition, InteractionGroup, PanelData } from './Interactions/InteractionTypes';
import { NumericalInteractionManager } from './Interactions/NumericalInteraction';
import { BooleanInteractionManager } from './Interactions/BooleanInteraction';

class Smarty extends Scene {
    private listPositionX: number = 25;
    private listPositionY: number = 30;
    private textWidth: number = 0;
    private panelGroup: Phaser.GameObjects.Group | null;
    private smartHomePanel: Phaser.GameObjects.Rectangle;
    private returnButton: Phaser.GameObjects.Image;

    private statusVariables: StatusVariable[] = [];
    private currentDevice: string;

    private interactionGroups: InteractionGroup[] = [];
    
    // Managers for numerical and boolean interactions
    private numericalManager: NumericalInteractionManager;
    private booleanManager: BooleanInteractionManager;

    preload(): void {
        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    create(): void {
        // Initialize interaction managers
        this.numericalManager = new NumericalInteractionManager(this);
        this.booleanManager = new BooleanInteractionManager(this);
        
        eventsCenter.on('enter-closeup', this.createPanel, this);
    }

    createPanel(data: PanelData): void {
        this.currentDevice = data.current_device;

        // Define sizes and initialize group
        let textWidth = 20;
        let paddingBoxIcon = 0;

        this.deletePanel();

        this.panelGroup = this.add.group();

        this.listPositionX = 25;
        this.listPositionY = 30;

        console.log(data);

        //// Add interaction values

        // Get interaction values and structure
        let interactionValues = data.interaction_values;
        let interactionStructure = data.interaction_structure;

        let interactionVariableNames = Object.keys(interactionValues);

        if (interactionVariableNames.length !== 0) {
            let struct: InteractionStructure | null;
            let statusText: Phaser.GameObjects.Text | null = null;

            for (let i = 0; i < interactionVariableNames.length; i++) {
                struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
                if (struct != null) {
                    console.log('Interaction structure found');
                    console.log(struct);
                    if (struct['InteractionType'] === 'Numerical_Action') {
                        statusText = this.handleStatusNumerical(struct, interactionValues[interactionVariableNames[i]]);
                        this.statusVariables.push({
                            name: struct.name,
                            value: interactionValues[interactionVariableNames[i]],
                            struct: struct,
                            text: statusText
                        });
                    } else if (struct['InteractionType'] === 'Boolean_Action') {
                        statusText = this.handleStatusBoolean(struct, interactionValues[interactionVariableNames[i]]);
                        this.statusVariables.push({
                            name: struct.name,
                            value: Boolean(interactionValues[interactionVariableNames[i]]),
                            struct: struct,
                            text: statusText
                        });
                    }
                    if(statusText != null){
                        this.listPositionY += statusText.displayHeight;
                        if (statusText.displayWidth > textWidth) {
                            textWidth = statusText.displayWidth;
                        }
                        this.panelGroup.add(statusText);
                    }
                }
            }
        }

        // Add divider
        this.listPositionY += 2;
        let divider = this.add.rectangle(this.listPositionX + 3, this.listPositionY, textWidth + 15, 2, 0x00000, 0.8).setOrigin(0).setDepth(1);

        this.panelGroup.add(divider);

        // Adjust the position of the box based on the size of the divider
        this.listPositionY += divider.displayHeight;
        if (divider.displayWidth > textWidth) {
            textWidth = divider.displayWidth;
        }
        this.listPositionY += 2;

        //// Add interactive interactions

        if (interactionVariableNames.length !== 0) {
            let struct: InteractionStructure | null;
            let actionName: Phaser.GameObjects.Text;
            let elementInteraction: Phaser.GameObjects.GameObject[];

            for (let i = 0; i < interactionVariableNames.length; i++) {
                struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
                if (struct != null) {
                    actionName = this.add.text(
                        this.listPositionX + 5,
                        this.listPositionY,
                        'Set ' + struct.name,
                        { fontSize: '20px', fill: '#00000', fontFamily: 'Arial' }
                    ).setDepth(1);
                    
                    this.listPositionY += actionName.displayHeight;
                    this.panelGroup.add(actionName);

                    if (struct['InteractionType'] === 'Numerical_Action') {
                        // Create numerical interaction using the manager
                        const numericalAction = this.numericalManager.createNumericalInteraction(
                            struct, 
                            interactionValues[interactionVariableNames[i]],
                            this.listPositionX,
                            this.listPositionY,
                            (name, value) => {
                                this.updateNumericalStatusVariable(name, value);
                                this.updateInteractionVisibility(name, value);
                            }
                        );

                        // Adjust size of the box based on the size of the slider
                        this.listPositionY += numericalAction.sliderHeight;
                        if (numericalAction.sliderWidth > textWidth) {
                            textWidth = numericalAction.sliderWidth;
                        }

                        // Add elements to the panel group
                        numericalAction.sliderContainer.forEach(element => {
                            if(this.panelGroup != null){
                                this.panelGroup.add(element);
                            }
                        });

                        // Add elements of that interaction to the interaction group
                        elementInteraction = [actionName, ...numericalAction.sliderContainer];
                        this.interactionGroups.push({
                            elements: elementInteraction,
                            visibility: struct.currentState.visible
                        });
                    } else if (struct['InteractionType'] === 'Boolean_Action') {
                        // Create boolean interaction using the manager
                        const booleanAction = this.booleanManager.createBooleanInteraction(
                            struct, 
                            Boolean(interactionValues[interactionVariableNames[i]]),
                            this.listPositionX,
                            this.listPositionY,
                            (name, value) => {
                                this.updateBooleanStatusVariable(name, value);
                                this.updateInteractionVisibility(name, value);
                            }
                        );
                        
                        // Adjust size of the box based on the size of the switch
                        this.listPositionY += booleanAction.displayHeight;
                        if (booleanAction.displayWidth > textWidth) {
                            textWidth = booleanAction.displayWidth;
                        }

                        // Add elements to the panel group
                        booleanAction.switchGroup.forEach(element => {
                            if(this.panelGroup != null)
                                this.panelGroup.add(element);
                        });

                        // Add elements of that interaction to the interaction group
                        elementInteraction = [actionName, ...booleanAction.switchGroup];
                        this.interactionGroups.push({
                            elements: elementInteraction,
                            visibility: struct.currentState.visible
                        });
                    }
                    this.listPositionY += 7;
                }
            }
        }

        // Change visibility of elements based on visibility rules
        interactionVariableNames.forEach(interactionName => {
            this.updateInteractionVisibility(interactionName, interactionValues[interactionName]);
        });

        // Create the panel background
        this.smartHomePanel = this.add.rectangle(
            25,
            25,
            textWidth + 20 + paddingBoxIcon,
            this.listPositionY - 20,
            0xfeead0,
            0.8
        ).setStrokeStyle(0.25, 0x00000).setOrigin(0).setDepth(0.98);
        
        console.log('Smarty Panel created');

        // Add return button
        let returnButton = this.createReturnButton();

        // Add elements to the panel group
        this.panelGroup.add(returnButton);
        this.panelGroup.add(this.smartHomePanel);
    }

    /**
     * Create a return button to close the view
     * @returns {Phaser.GameObjects.Image} returnButton
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
            eventsCenter.emit('exit-closeup');
            this.returnButton.setVisible(true);
        });
        
        return this.returnButton;
    }

    /**
     * Destroy the panel group and clear the status variables
     * @returns {void}
     */
    private deletePanel(): void {
        if (this.panelGroup == null) return;
        this.panelGroup.clear(true, true);
        this.panelGroup.destroy();
        this.panelGroup = null;
        this.statusVariables = [];
    }

    /**
     * Finds the interaction structure by name of all device's interaction structure.
     * @param {string} name Interaction Variable Name
     * @param {InteractionStructure[]} interactionStructure Array of interaction structures of the device
     * @returns {InteractionStructure | null} Interaction structure
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

    private handleStatusNumerical(
        struct: InteractionStructure,
        value: number
    ): Phaser.GameObjects.Text {
        let statusTextContent = struct.name + ': ' + value + ' ' + 
            (struct.inputData.unitOfMeasure == null ? '' : struct.inputData.unitOfMeasure);
        
        let statusText = this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#000000', fontFamily: 'Arial' }
        ).setDepth(1);
        
        return statusText;
    }

    private handleStatusBoolean(
        struct: InteractionStructure,
        value: boolean
    ): Phaser.GameObjects.Text {
        let transformedValue = value === true ? 
            struct.inputData.type.True : 
            struct.inputData.type.False;
        
        let statusTextContent = struct.name + ': ' + transformedValue + ' ' + 
            (struct.inputData.unitOfMeasure == null ? '' : struct.inputData.unitOfMeasure);
        
        let statusText = this.add.text(
            this.listPositionX + 5,
            this.listPositionY,
            statusTextContent,
            { fontSize: '20px', fill: '#00000', fontFamily: 'Arial' }
        ).setDepth(1);
        
        return statusText;
    }

    private updateNumericalStatusVariable(name: string, value: number): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                this.statusVariables[i].value = value;
                this.statusVariables[i].text.setText(
                    name + ': ' + value + ' ' + 
                    (this.statusVariables[i].struct.inputData.unitOfMeasure == null ? 
                        '' : 
                        this.statusVariables[i].struct.inputData.unitOfMeasure)
                );

                eventsCenter.emit('update-interaction', {
                    device: this.currentDevice,
                    interaction: this.statusVariables[i].struct.name,
                    value: value
                });
                
                return;
            }
        }
    }

    private updateBooleanStatusVariable(name: string, value: boolean): void {
        for (let i = 0; i < this.statusVariables.length; i++) {
            if (this.statusVariables[i].name === name) {
                let transformedValue = value === true ? 
                    this.statusVariables[i].struct.inputData.type.True : 
                    this.statusVariables[i].struct.inputData.type.False;
                
                this.statusVariables[i].value = value;
                this.statusVariables[i].text.setText(name + ': ' + transformedValue);

                eventsCenter.emit('update-interaction', {
                    device: this.currentDevice,
                    interaction: this.statusVariables[i].struct.name,
                    value: value
                });
                
                return;
            }
        }
    }

    /**
     * Updates the visibility of the interaction slider/switch based on the interaction value
     * @param {string} interactionName Interaction name
     * @param {any} value Value
     * @returns {void}
     */
    private updateInteractionVisibility(interactionName: string, value: any): void {
        for (let i = 0; i < this.interactionGroups.length; i++) {
            if (this.interactionGroups[i].visibility == null) continue;
            
            for (let j = 0; j < this.interactionGroups[i].visibility!.length; j++) {
                if (this.interactionGroups[i].visibility![j].name === interactionName) {
                    if (this.interactionGroups[i].visibility![j].value === value) {
                        this.interactionGroups[i].elements.forEach(element => {
                            element.setVisible(true);
                        });
                    } else {
                        this.interactionGroups[i].elements.forEach(element => {
                            element.setVisible(false);
                        });
                    }
                    return;
                }
            }
        }
    }
}

export default Smarty;