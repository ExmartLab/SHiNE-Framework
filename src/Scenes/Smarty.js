import eventsCenter from "../EventsCenter";

class Smarty extends Phaser.Scene {

    listPositionX = 25;
    listPositionY = 30;
    textWidth = 0;
    panelGroup;

    statusVariables = [];
    currentDevice;

    preload(){
        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    create(){
        eventsCenter.on('enter-closeup', this.createPanel, this);
    }

    createPanel(data){
        this.currentDevice = data.current_device;

        let textWidth = 20;
        let paddingBoxIcon = 0;
        // let listPositionY = 80;

        this.deletePanel();

        this.panelGroup = this.add.group();

        this.listPositionX = 25;
        this.listPositionY = 30;

        console.log(data);
        
        let interactionValues = data.interaction_values;
        let interactionStructure = data.interaction_structure;

        let interactionVariableNames = Object.keys(interactionValues);


        if(interactionVariableNames.length != 0){
            let struct;
            let statusText;

            for(let i = 0; i < interactionVariableNames.length; i++){

                struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
                if(struct != null){
                    console.log('Interaction structure found');
                    console.log(struct);
                    if(struct['InteractionType'] == 'Numerical_Action'){
                        statusText = this.handleStatusNumerical(struct, interactionValues[interactionVariableNames[i]]);
                        this.statusVariables.push({name: struct.name, value: interactionValues[interactionVariableNames[i]], struct: struct, text: statusText});
                    } else if(struct['InteractionType'] == 'Boolean_Action'){
                        statusText = this.handleStatusBoolean(struct, interactionValues[interactionVariableNames[i]]);
                        this.statusVariables.push({name: struct.name, value: Boolean(interactionValues[interactionVariableNames[i]]), struct: struct, text: statusText});
                    }
                    this.listPositionY += statusText.displayHeight;
                    if(statusText.displayWidth > textWidth){
                        textWidth = statusText.displayWidth;
                    }
                    this.panelGroup.add(statusText);
                }
            }
        }


        this.listPositionY += 2;
        let divider = this.add.rectangle(this.listPositionX + 3, this.listPositionY, textWidth+15, 2, 0x00000, 0.8).setOrigin(0).setDepth(1);

        this.panelGroup.add(divider);
        this.listPositionY += divider.displayHeight;
        if(divider.displayWidth > textWidth){
            textWidth = divider.displayWidth;
        }
        this.listPositionY += 2;

        if(interactionVariableNames.length != 0){
            let struct;
            let actionName;
            let numericalAction;
            let booleanAction;

            for(let i = 0; i < interactionVariableNames.length; i++){

                struct = this.findInteractionStructureByName(interactionVariableNames[i], interactionStructure);
                if(struct != null){
                    actionName = this.add.text(this.listPositionX + 5, this.listPositionY, 'Set ' + struct.name, {fontSize:'20px', fill:'#000000', fontFamily: 'Arial'}).setDepth(1);
                    this.listPositionY += actionName.displayHeight;
                    this.panelGroup.add(actionName);

                    if(struct['InteractionType'] == 'Numerical_Action'){
                        numericalAction = this.createNumericalInteraction(struct, interactionValues[interactionVariableNames[i]]);

                        this.listPositionY += numericalAction.sliderHeight;
                        if(numericalAction.sliderWidth > textWidth){
                            textWidth = numericalAction.sliderWidth;
                        }

                        numericalAction.sliderContainer.forEach(element => {
                            this.panelGroup.add(element);
                        });
                    } else if(struct['InteractionType'] == 'Boolean_Action'){
                        booleanAction = this.createBooleanInteraction(struct, Boolean(interactionValues[interactionVariableNames[i]]));
                        this.listPositionY += booleanAction.displayHeight;
                        if(booleanAction.displayWidth > textWidth){
                            textWidth = booleanAction[1];
                        }
                        booleanAction.switchGroup.forEach(element => {
                            this.panelGroup.add(element);
                        });
                    }
                    this.listPositionY += 7;

                }
            }
        }

        this.smartHomePanel = this.add.rectangle(25, 25, textWidth+15+paddingBoxIcon, this.listPositionY-20, 0xfeead0, 0.8).setStrokeStyle(0.25, 0x00000).setOrigin(0).setDepth(0.98);
        console.log('Smarty Panel created');

        let returnButton = this.createReturnButton();
        this.panelGroup.add(returnButton);

        this.panelGroup.add(this.smartHomePanel);

    }

    createReturnButton(){
        this.returnButton = this.add.image(this.game.config.width * 0.95, this.game.config.height * 0.95, 'return_btn').setOrigin(1).setDepth(1).setScale(this.game.config.scaleRoomElementsX, this.game.config.scaleRoomElementsY);
        this.returnButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.deletePanel();
            eventsCenter.emit('exit-closeup');
            this.returnButton.setVisible(true);
        });
        return this.returnButton;
    }

    deletePanel(){
        if(this.panelGroup == null) return;
        this.panelGroup.clear(true, true);
        this.panelGroup.destroy();
        this.panelGroup = null;
        this.statusVariables = [];
    }

    findInteractionStructureByName(name, interactionStructure){
        for(let i = 0; i < interactionStructure.length; i++){
            if(interactionStructure[i].name == name){
                return interactionStructure[i];
            }
        }
        return null;
    }

    handleStatusNumerical(struct, value){
        let statusTextContent = struct.name + ': ' + value + ' ' + (struct.inputData.unitOfMeasure == null ? '' : struct.inputData.unitOfMeasure);
        let statusText = this.add.text(this.listPositionX + 5, this.listPositionY, statusTextContent, {fontSize:'20px', fill:'#000000', fontFamily: 'Arial'}).setDepth(1);
        return statusText;
    }

    handleStatusBoolean(struct, value){
        let transformedValue = value == true ? struct.inputData.type.True : struct.inputData.type.False;
        let statusTextContent = struct.name + ': ' + transformedValue + ' ' + (struct.inputData.unitOfMeasure == null ? '' : struct.inputData.unitOfMeasure);
        let statusText = this.add.text(this.listPositionX + 5, this.listPositionY, statusTextContent, {fontSize:'20px', fill:'#000000', fontFamily: 'Arial'}).setDepth(1);
        return statusText;
    }

    createNumericalInteraction(struct, predefinedValue) {
        let sliderWidth = 0;
        let sliderHeight = 0;

        const range = [Number.parseInt(struct.inputData.type['Range'][0]), Number.parseInt(struct.inputData.type['Range'][1])];
        const interval = Number.parseInt(struct.inputData.type['Interval']);

        let sliderContainer = [];
    
        let track = this.add.rectangle(this.listPositionX+20, this.listPositionY+10, 80, 4, 0x666666).setDepth(1).setOrigin(0.5);
        let handle = this.add.circle(this.listPositionX+20, this.listPositionY+10, 8, 0x00ff00).setDepth(1).setOrigin(0.5);
        handle.setInteractive({ draggable: true });

        sliderContainer.push(track);
        sliderContainer.push(handle);

        // Set slider width and height based on track and handle for the outer box

        sliderWidth = track.displayWidth + 20;
        sliderHeight = track.displayHeight + 10;

        if(sliderWidth < handle.displayWidth)
            sliderWidth = handle.displayWidth;

        if(sliderHeight < handle.displayHeight)
            sliderHeight = handle.displayHeight;

    
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;

    
        // Set initial handle position based on predefinedValue
        if (predefinedValue !== undefined) {
            const snappedValue = Math.round(predefinedValue / interval) * interval;
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            this.updateNumericalStatusVariable(struct.name, snappedValue);
        }
    
        let circleInterval;
        for (let value = range[0]; value <= range[1]; value += interval) {
            const x = this.mapValueToPosition(value, track, range);
            circleInterval = this.add.circle(x, this.listPositionY+10, 3, 0x444444).setDepth(1).setOrigin(0.5);
            sliderContainer.push(circleInterval);
        }
    
        handle.on('drag', (pointer, dragX) => {
            const minX = track.x - track.width / 2;
            const maxX = track.x + track.width / 2;
            handle.x = Phaser.Math.Clamp(dragX, minX, maxX);
            
            const value = this.mapPositionToValue(handle.x, track, range);
            const snappedValue = Math.round(value / interval) * interval;
            handle.x = this.mapValueToPosition(snappedValue, track, range);
            
            this.updateNumericalStatusVariable(struct.name, snappedValue);
        });
        return {sliderContainer, sliderWidth, sliderHeight};
    }
    
    mapValueToPosition(value, track, range) {
        const percent = (value - range[0]) / (range[1] - range[0]);
        return track.x - (track.displayWidth / 2) + (percent * track.displayWidth);
    }
    
    mapPositionToValue(x, track, range) {
        const minX = track.x - track.width / 2;
        const percent = (x - minX) / track.width;
        return range[0] + (percent * (range[1] - range[0]));
    }

    createBooleanInteraction(struct, predefinedValue = false) {
        let switchGroup = [];
        const trueText = struct.inputData.type['True'];
        const falseText = struct.inputData.type['False'];
        
        const switchWidth = 60;
        const switchHeight = 30;
        let displayWidth = 0;
        let displayHeight = 0;
        
        const track = this.add.rectangle(this.listPositionX+15, this.listPositionY+3, switchWidth, switchHeight)
            .setDepth(1)
            .setOrigin(0.5);
        
        switchGroup.push(track);
        
        track.x += track.displayWidth / 2;
        track.y += track.displayHeight / 2;

        displayWidth = track.displayWidth;
        displayHeight = track.displayHeight;
    
        const handle = this.add.circle(
            track.x + (predefinedValue ? switchWidth/4 : -switchWidth/4),
            track.y,
            (switchHeight - 3) / 2,
            0xFFFFFF
        ).setDepth(1)
        .setOrigin(0.5);

        switchGroup.push(handle);
    
        const onText = this.add.text(track.x + switchWidth/4, track.y, trueText, 
            { fontSize: '12px', fill: '#fff' })
            .setDepth(2)
            .setOrigin(0.5);
        
        const offText = this.add.text(track.x - switchWidth/4, track.y, falseText, 
            { fontSize: '12px', fill: '#fff' })
            .setDepth(2)
            .setOrigin(0.5);

        switchGroup.push(onText);
        switchGroup.push(offText);
    
        track.setInteractive();
        let isOn = predefinedValue;
        handle.fillColor = isOn ? 0x87CEFA : 0x808080;  // lightblue : grey

    
        track.on('pointerdown', () => {
            isOn = !isOn;
            this.tweens.add({
                targets: handle,
                x: track.x + (isOn ? switchWidth/4 : -switchWidth/4),
                duration: 200,
                ease: 'Power2'
            });
            handle.fillColor = isOn ? 0x87CEFA : 0x808080;
            this.updateBooleanStatusVariable(struct.name, isOn);
        });
        return {switchGroup, displayWidth, displayHeight};
    }

    updateNumericalStatusVariable(name, value){
        for(let i = 0; i < this.statusVariables.length; i++){
            if(this.statusVariables[i].name == name){
                this.statusVariables[i].value = value;
                this.statusVariables[i].text.setText(name + ': ' + value + ' ' + (this.statusVariables[i].struct.inputData.unitOfMeasure == null ? '' : this.statusVariables[i].struct.inputData.unitOfMeasure));

                eventsCenter.emit('update-interaction', {device: this.currentDevice, interaction: this.statusVariables[i].struct.name, value: value});
                return;
            }
        }
        return;
    }

    updateBooleanStatusVariable(name, value){
        for(let i = 0; i < this.statusVariables.length; i++){
            if(this.statusVariables[i].name == name){
                let transformedValue = value == true ? this.statusVariables[i].struct.inputData.type.True : this.statusVariables[i].struct.inputData.type.False;
                this.statusVariables[i].value = value;
                this.statusVariables[i].text.setText(name + ': ' + transformedValue);

                eventsCenter.emit('update-interaction', {device: this.currentDevice, interaction: this.statusVariables[i].struct.name, value: value});
                return;
            }
        }
        return;
    }
    


}

export default Smarty;