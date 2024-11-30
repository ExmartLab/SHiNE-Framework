import eventsCenter from "../EventsCenter";

class Device extends Phaser.Scene {

    deviceInstantiated = false;
    parentWall;
    preloadedImages = [];
    returnButton;

    states = [];
    visualStates = [];
    interactionStructure = [];
    interactionValues = {};

    deviceImage;
    position;

    isZoomedIn = false;

    smartHomePanel;

    constructor(config){
        super(config);
    }

    init(data){
        if(this.deviceInstantiated) return;

        for(let i = 0; i < data.visualState.length; i++){
            this.preloadedImages.push(data.visualState[i].image);
        }
    }

    preload(){
        if(this.deviceInstantiated) return;

        for(let i = 0; i < this.preloadedImages.length; i++){
            this.load.image('device_' + this.scene.key + '_' + i, this.preloadedImages[i]);
            this.states.push({state: 'device_' + i, image: this.preloadedImages[i]});
        }
        this.preloadedImages = null;

        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    create(data){
        this.parentWall = data.parentWall;
        this.createInteractions(data.interactions);
        this.setupCamera();
        this.createDefaultState(data.position);
        this.createVisualStates(data.visualState);

        this.deviceInstantiated = true;

        eventsCenter.on('exit-closeup', () => {
            if(this.isZoomedIn){
                this.resetZoom();
            }
        });
       
        eventsCenter.on('update-interaction', (data) => {
            this.updateInteraction(data);
        });
    }

    createDefaultState(position){
        let customScale = (position.scale ? position.scale : 1);
        let customOrigin = (position.origin ? position.origin : 0.5);
        const device = this.add.image(position.x, position.y, 'device_' + this.scene.key + '_0').setOrigin(customOrigin).setScale(this.game.config.scaleRoomElementsX * customScale, this.game.config.scaleRoomElementsY * customScale).setDepth(1).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleDeviceClick(device))
        .on('pointerover', () => {
            if(this.isZoomedIn) return;
            // Apply some visual effect when hovering over the image
            device.setTint(0xAAAAAA); // Light grey tint
        })
        .on('pointerout', () => {
            if(this.isZoomedIn) return;
            // Remove the visual effect when pointer leaves the image
            device.clearTint();
        });
        this.deviceImage = device;
        this.position = position;
    }

    createVisualStates(states){
        for(let i = 0; i < states.length; i++){
            this.visualStates.push(states[i]);
        }
    }

    createInteractions(interactions){
        for(let i = 0; i < interactions.length; i++){
            let interaction = interactions[i];
            
            this.interactionValues[interaction.name] = interaction.currentState.value;

            delete interaction.currentState.value;

            this.interactionStructure.push(interaction);
        }
    }

    handleDeviceClick(){
        if (!this.isZoomedIn) {
            this.zoomToDevice();
            this.isZoomedIn = true;
        }
        return;
    }

    setupCamera() {
        // Set up camera with bounds matching the scaled wall size
        const boundWidth = this.game.config.width;
        const boundHeight = this.game.config.height;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
    }

    zoomToDevice() {
        // Calculate device center position
        const deviceCenterX = this.deviceImage.x - (this.deviceImage.width * this.deviceImage.scale * 0.5);
        const deviceCenterY = this.deviceImage.y - (this.deviceImage.height * this.deviceImage.scale * 0.5);


        // Calculate scaled dimensions
        const deviceScaledWidth = this.deviceImage.width * (this.game.config.scaleRoomElementsX * this.position.scale);
        const deviceScaledHeight = this.deviceImage.height * (this.game.config.scaleRoomElementsY * this.position.scale);
    

        // Calculate zoom scale with padding
        const padding = 1.4;
        const zoomScaleX = (this.game.config.width / (deviceScaledWidth * padding));
        const zoomScaleY = (this.game.config.height / (deviceScaledHeight * padding));
        
        // Use smaller scale and clamp values
        const zoomScale = Math.min(
            Math.min(zoomScaleX, zoomScaleY),
            this.game.config.maxZoom
        );

        // Based on zoomScale, create a fontSize for text within the view

    
        // Immediately set scroll position to target device
        const targetScrollX = deviceCenterX - this.game.config.width/2;
        const targetScrollY = deviceCenterY - this.game.config.height/2;


        let parentScene = this.scene.get(this.parentWall);
        parentScene.cameras.main.setScroll(targetScrollX, targetScrollY);

        this.cameras.main.setScroll(targetScrollX, targetScrollY);

        
    
        // Animate only the zoom
        let tweens = this.tweens.add({
            targets: [this.cameras.main, parentScene.cameras.main],
            zoom: zoomScale,
            duration: this.game.config.animDuration,
            scrollX: targetScrollX,
            scrollY: targetScrollY,
            ease: 'Expo'
        });


        // Pointer out effect for device image
        this.deviceImage.input.cursor = 'default';
        this.deviceImage.clearTint();

        // tweens.on('complete', () => {
        // });
        eventsCenter.emit('enter-closeup', {current_device: this.scene.key,interaction_structure: this.interactionStructure, interaction_values: this.interactionValues});


    }

    resetZoom() {

        this.isZoomedIn = false;

        const deviceCenterX = this.cameras.main.getBounds().width / 2;
        const deviceCenterY = this.cameras.main.getBounds().height / 2;

        this.cameras.main.pan(deviceCenterX, deviceCenterY, this.game.config.animDuration, 'Expo');
        this.cameras.main.zoomTo(1, this.game.config.animDuration, 'Expo');

        let parentScene = this.scene.get(this.parentWall);
    
        const parentWallCenterX = parentScene.cameras.main.getBounds().width / 2;
        const parentWallCenterY = parentScene.cameras.main.getBounds().height / 2;

        parentScene.cameras.main.pan(parentWallCenterX, parentWallCenterY, this.game.config.animDuration, 'Expo');
        parentScene.cameras.main.zoomTo(1, this.game.config.animDuration, 'Expo');

        this.deviceImage.input.cursor = 'pointer';
    }

    updateInteraction(data){
        if(data.device != this.scene.key) return;
        this.interactionValues[data.interaction] = data.value;
        this.updateState();
    }

    updateState(){
        let visualState = this.findMatchingVisualState(this.visualStates, this.interactionValues);
        let stateIndex = this.states.findIndex(state => state.image === visualState.image);

        this.deviceImage.setTexture('device_' + this.scene.key + '_' + stateIndex);
    }

    findMatchingVisualState(visualStates, interactionValues) {
        // Helper function to evaluate a single condition
        function evaluateCondition(condition, interactionValues) {
            const currentValue = interactionValues[condition.name];
            
            // If no operator is specified, do direct comparison
            if (!condition.operator) {
                return currentValue === condition.value;
            }
            
            // Handle different operators
            switch (condition.operator) {
                case '>':
                    return currentValue > condition.value;
                case '>=':
                    return currentValue >= condition.value;
                case '<':
                    return currentValue < condition.value;
                case '<=':
                    return currentValue <= condition.value;
                case '===':
                case '==':
                    return currentValue === condition.value;
                case '!==':
                case '!=':
                    return currentValue !== condition.value;
                default:
                    throw new Error(`Unsupported operator: ${condition.operator}`);
            }
        }
    
        // Sort states to prioritize non-default states
        // More specific states (more conditions) are checked first
        const sortedStates = [...visualStates].sort((a, b) => {
            // Non-default states come before default states
            if (a.default && !b.default) return 1;
            if (!a.default && b.default) return -1;
            
            // Among non-default states, prioritize those with more conditions
            const aConditions = a.conditions?.length || 0;
            const bConditions = b.conditions?.length || 0;
            return bConditions - aConditions;
        });
    
        // Find the first state where all conditions match
        const matchingState = sortedStates.find(state => {
            // Skip default states if they come first in iteration
            if (state.default === true) {
                return false;
            }
    
            // If there are no conditions but it's not a default state, skip
            if (!state.conditions) {
                return false;
            }
    
            // Check if all conditions match
            return state.conditions.every(condition => 
                evaluateCondition(condition, interactionValues)
            );
        });
    
        // If no non-default states match, return the default state
        if (!matchingState) {
            return sortedStates.find(state => state.default === true);
        }
    
        return matchingState;
    }

    hideDevice(){
        this.deviceImage.setVisible(false);
    }

    showDevice(){
        this.deviceImage.setVisible(true);
    }


}

export default Device;