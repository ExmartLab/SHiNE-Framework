import { eventsCenter } from "../EventsCenter";
import { Scene } from 'phaser';

// Interface for interaction structure
interface InteractionStructure {
    name: string;
    InteractionType: string;
    inputData: {
        type: {
            Range?: number[];
            Interval?: number;
            True?: string;
            False?: string;
            [key: string]: any;
        };
        unitOfMeasure?: string;
        [key: string]: any;
    };
    currentState: {
        visible?: VisibilityCondition[];
        [key: string]: any;
    };
    [key: string]: any;
}

// Interface for status variable
interface StatusVariable {
    name: string;
    value: any;
    struct: InteractionStructure;
    text: Phaser.GameObjects.Text;
}

// Interface for interaction visibility condition
interface VisibilityCondition {
    name: string;
    value: any;
}

// Interface for interaction group
interface InteractionGroup {
    elements: Phaser.GameObjects.GameObject[];
    visibility?: VisibilityCondition[];
}

// Interface for panel data
interface PanelData {
    current_device: string;
    interaction_values: { [key: string]: any };
    interaction_structure: InteractionStructure[];
}

// Interface for numerical slider
interface NumericalSlider {
    sliderContainer: Phaser.GameObjects.GameObject[];
    sliderWidth: number;
    sliderHeight: number;
}

// Interface for boolean switch
interface BooleanSwitch {
    switchGroup: Phaser.GameObjects.GameObject[];
    displayWidth: number;
    displayHeight: number;
}

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

    preload(): void {
        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    create(): void {
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
            let numericalAction: NumericalSlider;
            let booleanAction: BooleanSwitch;
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
                        // Create numerical interaction
                        numericalAction = this.createNumericalInteraction(struct, interactionValues[interactionVariableNames[i]]);

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
                        // Create boolean interaction
                        booleanAction = this.createBooleanInteraction(struct, Boolean(interactionValues[interactionVariableNames[i]]));
                        
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
            textWidth + 15 + paddingBoxIcon,
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

    private createNumericalInteraction(
        struct: InteractionStructure,
        predefinedValue: number
    ): NumericalSlider {
        let sliderWidth = 0;
        let sliderHeight = 0;

        const range = [
            Number.parseInt(struct.inputData.type['Range']![0].toString()),
            Number.parseInt(struct.inputData.type['Range']![1].toString())
        ];
        
        const interval = Number.parseInt(struct.inputData.type['Interval']!.toString());

        let sliderContainer: Phaser.GameObjects.GameObject[] = [];
    
        let track = this.add.rectangle(
            this.listPositionX + 20,
            this.listPositionY + 10,
            80,
            4,
            0x666666
        ).setDepth(1).setOrigin(0.5);
        
        let handle = this.add.circle(
            this.listPositionX + 20,
            this.listPositionY + 10,
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
            this.updateNumericalStatusVariable(struct.name, snappedValue);
        }
    
        let circleInterval: Phaser.GameObjects.Arc;
        for (let value = range[0]; value <= range[1]; value += interval) {
            const x = this.mapValueToPosition(value, track, range);
            circleInterval = this.add.circle(
                x,
                this.listPositionY + 10,
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
            
            this.updateNumericalStatusVariable(struct.name, snappedValue);
            this.updateInteractionVisibility(struct.name, snappedValue);
        });
        
        return { sliderContainer, sliderWidth, sliderHeight };
    }
    
    private mapValueToPosition(
        value: number,
        track: Phaser.GameObjects.Rectangle,
        range: number[]
    ): number {
        const percent = (value - range[0]) / (range[1] - range[0]);
        return track.x - (track.displayWidth / 2) + (percent * track.displayWidth);
    }
    
    private mapPositionToValue(
        x: number,
        track: Phaser.GameObjects.Rectangle,
        range: number[]
    ): number {
        const minX = track.x - track.width / 2;
        const percent = (x - minX) / track.width;
        return range[0] + (percent * (range[1] - range[0]));
    }

    private createBooleanInteraction(
        struct: InteractionStructure,
        predefinedValue: boolean = false
    ): BooleanSwitch {
        let switchGroup: Phaser.GameObjects.GameObject[] = [];
        const trueText = struct.inputData.type['True']!;
        const falseText = struct.inputData.type['False']!;
        
        const switchWidth = 60;
        const switchHeight = 30;
        let displayWidth = 0;
        let displayHeight = 0;
        
        const track = this.add.rectangle(
            this.listPositionX + 15,
            this.listPositionY + 3,
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
    
        const handle = this.add.circle(
            track.x + (predefinedValue ? switchWidth / 4 : -switchWidth / 4),
            track.y,
            (switchHeight - 3) / 2,
            0xFFFFFF
        )
        .setDepth(1)
        .setOrigin(0.5);

        switchGroup.push(handle);
    
        const onText = this.add.text(
            track.x + switchWidth / 4 - trueText.length * 3, // Adjust X position for left alignment
            track.y - 6, // Adjust Y position to account for text height
            trueText, 
            { fontSize: '12px', fill: '#00000', color: '#fff' }
        )
        .setDepth(2)
        .setOrigin(0);
        
        const offText = this.add.text(
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
            this.tweens.add({
                targets: handle,
                x: track.x + (isOn ? switchWidth / 4 : -switchWidth / 4),
                duration: 200,
                ease: 'Power2'
            });
            handle.fillColor = isOn ? 0x87CEFA : 0x808080;
            this.updateBooleanStatusVariable(struct.name, isOn);
            this.updateInteractionVisibility(struct.name, isOn);
        });
        
        return { switchGroup, displayWidth, displayHeight };
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