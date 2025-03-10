import { eventsCenter } from "../EventsCenter";
import { Scene, GameObjects, Types } from 'phaser';

// Define interfaces for the data structures
interface Position {
    x: number;
    y: number;
    scale?: number;
    origin?: number;
}

interface Condition {
    name: string;
    value: any;
    operator?: string;
}

interface VisualState {
    image: string;
    default?: boolean;
    conditions?: Condition[];
}

interface State {
    state: string;
    image: string;
}

interface InteractionState {
    value: any;
    [key: string]: any;
}

interface Interaction {
    name: string;
    currentState: InteractionState;
    [key: string]: any;
}

interface DeviceData {
    id: string;
    parentWall: string;
    position: Position;
    visualState: VisualState[];
    interactions: Interaction[];
}

interface InteractionUpdateData {
    device: string;
    interaction: string;
    value: any;
}

class Device extends Scene {
    private deviceInstantiated: boolean = false;
    private parentWall: string;
    private preloadedImages: string[] = [];
    private returnButton: GameObjects.Image;

    private states: State[] = [];
    private visualStates: VisualState[] = [];
    private deviceId: string;
    private interactionStructure: Interaction[] = [];
    private interactionValues: { [key: string]: any } = {};

    private deviceImage: GameObjects.Image;
    private position: Position;

    private isZoomedIn: boolean = false;

    private smartHomePanel: any;

    constructor(config: Types.Scenes.SettingsConfig) {
        super(config);
    }

    init(data: { visualState: VisualState[] }): void {
        if (this.deviceInstantiated) return;

        for (let i = 0; i < data.visualState.length; i++) {
            this.preloadedImages.push(data.visualState[i].image);
        }
    }

    preload(): void {
        if (this.deviceInstantiated) return;

        for (let i = 0; i < this.preloadedImages.length; i++) {
            this.load.image('device_' + this.scene.key + '_' + i, this.preloadedImages[i]);
            this.states.push({ state: 'device_' + i, image: this.preloadedImages[i] });
        }
        this.preloadedImages = [];

        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    create(data: DeviceData): void {
        this.parentWall = data.parentWall;
        this.deviceId = data.id;
        this.createInteractions(data.interactions);
        this.setupCamera();
        this.createDefaultState(data.position);
        this.createVisualStates(data.visualState);

        this.deviceInstantiated = true;

        eventsCenter.on('exit-closeup', () => {
            if (this.isZoomedIn) {
                this.resetZoom();
            }
        });

        eventsCenter.on('update-interaction', (data: InteractionUpdateData) => {
            this.updateInteraction(data);
        });
    }

    private createDefaultState(position: Position): void {
        let customScale = (position.scale ? position.scale : 1);
        let customOrigin = (position.origin ? position.origin : 0.5);
        
        const device = this.add.image(position.x, position.y, 'device_' + this.scene.key + '_0')
            .setOrigin(customOrigin)
            .setScale(
                (this.game.config as any).scaleRoomElementsX * customScale, 
                (this.game.config as any).scaleRoomElementsY * customScale
            )
            .setDepth(1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleDeviceClick())
            .on('pointerover', () => {
                if (this.isZoomedIn) return;
                // Apply some visual effect when hovering over the image
                device.setTint(0xAAAAAA); // Light grey tint
            })
            .on('pointerout', () => {
                if (this.isZoomedIn) return;
                // Remove the visual effect when pointer leaves the image
                device.clearTint();
            });
            
        this.deviceImage = device;
        this.position = position;
    }

    private createVisualStates(states: VisualState[]): void {
        for (let i = 0; i < states.length; i++) {
            this.visualStates.push(states[i]);
        }
    }

    private createInteractions(interactions: Interaction[]): void {
        for (let i = 0; i < interactions.length; i++) {
            let interaction = interactions[i];

            this.interactionValues[interaction.name] = interaction.currentState.value;

            delete interaction.currentState.value;

            this.interactionStructure.push(interaction);
        }
    }

    private handleDeviceClick(): void {
        if (!this.isZoomedIn) {
            this.zoomToDevice();
            this.isZoomedIn = true;
        }
        return;
    }

    private setupCamera(): void {
        // Set up camera with bounds matching the scaled wall size
        const boundWidth = (this.game.config as any).width;
        const boundHeight = (this.game.config as any).height;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
    }

    private zoomToDevice(): void {
        // Calculate device center position
        const deviceCenterX = this.deviceImage.x - (this.deviceImage.width * this.deviceImage.scale * 0.5);
        const deviceCenterY = this.deviceImage.y - (this.deviceImage.height * this.deviceImage.scale * 0.5);

        // Calculate scaled dimensions
        const scale = this.position.scale || 1;
        const deviceScaledWidth = this.deviceImage.width * ((this.game.config as any).scaleRoomElementsX * scale);
        const deviceScaledHeight = this.deviceImage.height * ((this.game.config as any).scaleRoomElementsY * scale);

        // Calculate zoom scale with padding
        const padding = 1.4;
        const zoomScaleX = ((this.game.config as any).width / (deviceScaledWidth * padding));
        const zoomScaleY = ((this.game.config as any).height / (deviceScaledHeight * padding));

        // Use smaller scale and clamp values
        const zoomScale = Math.min(
            Math.min(zoomScaleX, zoomScaleY),
            (this.game.config as any).maxZoom
        );

        // Immediately set scroll position to target device
        const targetScrollX = deviceCenterX - (this.game.config as any).width / 2;
        const targetScrollY = deviceCenterY - (this.game.config as any).height / 2;

        let parentScene = this.scene.get(this.parentWall) as Phaser.Scene;
        parentScene.cameras.main.setScroll(targetScrollX, targetScrollY);

        this.cameras.main.setScroll(targetScrollX, targetScrollY);

        // Animate only the zoom
        let tweens = this.tweens.add({
            targets: [this.cameras.main, parentScene.cameras.main],
            zoom: zoomScale,
            duration: (this.game.config as any).animDuration,
            scrollX: targetScrollX,
            scrollY: targetScrollY,
            ease: 'Expo'
        });

        // Pointer out effect for device image
        if(this.deviceImage.input != null){
            this.deviceImage.input.cursor = 'default';
            this.deviceImage.clearTint();
        }

        eventsCenter.emit('enter-closeup', {
            current_device: this.deviceId,
            device_long_id: this.scene.key,
            interaction_structure: this.interactionStructure,
            interaction_values: this.interactionValues
        });
    }

    private resetZoom(): void {
        this.isZoomedIn = false;

        const deviceCenterX = this.cameras.main.getBounds().width / 2;
        const deviceCenterY = this.cameras.main.getBounds().height / 2;

        this.cameras.main.pan(deviceCenterX, deviceCenterY, (this.game.config as any).animDuration, 'Expo');
        this.cameras.main.zoomTo(1, (this.game.config as any).animDuration, 'Expo');

        let parentScene = this.scene.get(this.parentWall) as Phaser.Scene;

        const parentWallCenterX = parentScene.cameras.main.getBounds().width / 2;
        const parentWallCenterY = parentScene.cameras.main.getBounds().height / 2;

        parentScene.cameras.main.pan(parentWallCenterX, parentWallCenterY, (this.game.config as any).animDuration, 'Expo');
        parentScene.cameras.main.zoomTo(1, (this.game.config as any).animDuration, 'Expo');

        if(this.deviceImage.input != null)
            this.deviceImage.input.cursor = 'pointer';
    }

    private updateInteraction(data: InteractionUpdateData): void {
        if (data.device != this.deviceId) return;
        this.interactionValues[data.interaction] = data.value;
        this.updateState();
    }

    private updateState(): void {
        let visualState = this.findMatchingVisualState(this.visualStates, this.interactionValues);
        let stateIndex = this.states.findIndex(state => state.image === visualState.image);

        this.deviceImage.setTexture('device_' + this.scene.key + '_' + stateIndex);
    }

    private findMatchingVisualState(visualStates: VisualState[], interactionValues: { [key: string]: any }): VisualState {
        // Helper function to evaluate a single condition
        function evaluateCondition(condition: Condition, interactionValues: { [key: string]: any }): boolean {
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
            const defaultState = sortedStates.find(state => state.default === true);
            if (!defaultState) {
                throw new Error("No default visual state found for device");
            }
            return defaultState;
        }

        return matchingState;
    }

    public hideDevice(): void {
        this.deviceImage.setVisible(false);
    }

    public showDevice(): void {
        this.deviceImage.setVisible(true);
    }
}

export default Device;