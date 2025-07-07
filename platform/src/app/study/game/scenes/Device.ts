import { eventsCenter } from "../EventsCenter";
import { Scene, GameObjects, Types } from 'phaser';
import { 
    Position, 
    Condition, 
    VisualState, 
    State,  
    Interaction, 
    DeviceData, 
    InteractionUpdateData,
    GameConfig 
} from "../../types";

/**
 * Device scene class that manages individual smart home devices
 * Handles visual states, interactions, zoom functionality, and user input
 */
class Device extends Scene {
    /** Flag to prevent duplicate initialization */
    private deviceInstantiated: boolean = false;
    /** ID of the parent wall scene */
    private parentWall: string;
    /** Array of image paths to preload */
    private preloadedImages: string[] = [];
    /** Return button for navigation */
    private returnButton: GameObjects.Image;

    /** Internal state mappings */
    private states: State[] = [];
    /** Available visual states for this device */
    private visualStates: VisualState[] = [];
    /** Unique identifier for this device */
    private deviceId: string;
    /** Structure defining device interactions */
    private interactionStructure: Interaction[] = [];
    /** Current values of all device interactions */
    private interactionValues: { [key: string]: unknown } = {};

    /** Main device image game object */
    private deviceImage: GameObjects.Image;
    /** Device position and scaling information */
    private position: Position;

    /** Whether the device is currently zoomed in */
    private isZoomedIn: boolean = false;

    /** Reference to smart home control panel */
    private smartHomePanel: unknown;

    /**
     * Initialize the device scene
     * @param config Phaser scene configuration
     */
    constructor(config: Types.Scenes.SettingsConfig) {
        super(config);
    }

    /**
     * Initialize the scene with visual state data
     * Collects image paths for preloading
     * @param data Object containing visual state information
     */
    init(data: { visualState: VisualState[] }): void {
        if (this.deviceInstantiated) return;

        for (let i = 0; i < data.visualState.length; i++) {
            this.preloadedImages.push(data.visualState[i].image);
        }
    }

    /**
     * Preload all required assets for the device
     * Creates texture keys for each visual state image
     */
    preload(): void {
        if (this.deviceInstantiated) return;

        for (let i = 0; i < this.preloadedImages.length; i++) {
            this.load.image('device_' + this.scene.key + '_' + i, this.preloadedImages[i]);
            this.states.push({ state: 'device_' + i, image: this.preloadedImages[i] });
        }
        this.preloadedImages = [];

        this.load.image('return_btn', 'assets/images/control/return.png');
    }

    /**
     * Create and initialize the device scene
     * Sets up interactions, camera, visual states, and event listeners
     * @param data Complete device configuration data
     */
    create(data: DeviceData): void {
        this.parentWall = data.parentWall;
        this.deviceId = data.id;
        this.createInteractions(data.interactions);
        this.setupCamera();
        this.createDefaultState(data.position);
        this.createVisualStates(data.visualState);
        this.updateState();

        this.deviceInstantiated = true;

        // Listen for zoom exit events
        eventsCenter.on('exit-closeup', () => {
            if (this.isZoomedIn) {
                this.resetZoom();
            }
        });

        // Listen for interaction updates
        eventsCenter.on('update-interaction', (data: InteractionUpdateData) => {
            this.updateInteraction(data);
        });

        // Periodic visibility updates for interactivity
        this.time.addEvent({
            delay: 200,
            callback: this.visibilityUpdate,
            callbackScope: this,
            loop: true
        });
    }

    /**
     * Updates device interactivity based on scene visibility
     * Disables interaction when scene is not visible
     */
    private visibilityUpdate(){
        if(!this.scene.isVisible(this.scene.key)){
            this.deviceImage.disableInteractive();
        } else {
            this.deviceImage.setInteractive({ useHandCursor: true });
        }
    }

    /**
     * Creates the initial device image with default positioning and interaction handlers
     * @param position Position and scaling configuration for the device
     */
    private createDefaultState(position: Position): void {
        const customScale = (position.scale ? position.scale : 1);
        const customOrigin = (position.origin ? position.origin : 0.5);
        
        const device = this.add.image(position.x, position.y, 'device_' + this.scene.key + '_0')
            .setOrigin(customOrigin)
            .setScale(
                (this.game.config as GameConfig).scaleRoomElementsX * customScale, 
                (this.game.config as GameConfig).scaleRoomElementsY * customScale
            )
            .setDepth(0.9)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleDeviceClick())
            .on('pointerover', () => {
                if (this.isZoomedIn) return;
                device.setTint(0xAAAAAA); // Visual feedback on hover
            })
            .on('pointerout', () => {
                if (this.isZoomedIn) return;
                device.clearTint(); // Remove hover effect
            });
            
        this.deviceImage = device;
        this.position = position;
    }

    /**
     * Stores the available visual states for the device
     * @param states Array of visual state configurations
     */
    private createVisualStates(states: VisualState[]): void {
        for (let i = 0; i < states.length; i++) {
            this.visualStates.push(states[i]);
        }
    }

    /**
     * Processes and stores device interactions
     * Separates interaction values from structure for state management
     * @param interactions Array of interaction configurations
     */
    private createInteractions(interactions: Interaction[]): void {
        for (let i = 0; i < interactions.length; i++) {
            const interaction = interactions[i];

            // Store current value separately
            this.interactionValues[interaction.name] = interaction.currentState.value;

            // Remove value from structure to avoid duplication
            delete interaction.currentState.value;

            this.interactionStructure.push(interaction);
        }
    }

    /**
     * Handles click events on the device
     * Triggers zoom functionality when device is clicked
     */
    private handleDeviceClick(): void {
        if (!this.isZoomedIn) {
            this.zoomToDevice();
            this.isZoomedIn = true;
        }
        return;
    }

    /**
     * Configures camera bounds for the device scene
     * Sets bounds to match the game's configured dimensions
     */
    private setupCamera(): void {
        const gameConfig = this.game.config as GameConfig;
        const boundWidth = gameConfig.width as number;
        const boundHeight = gameConfig.height as number;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
    }

    /**
     * Zooms the camera to focus on this device and shows interaction panel
     * Calculates optimal zoom level and triggers closeup mode
     */
    private zoomToDevice(): void {
        // Calculate device center position for camera targeting
        const deviceCenterX = this.deviceImage.x - (this.deviceImage.width * this.deviceImage.scale * 0.5);
        const deviceCenterY = this.deviceImage.y - (this.deviceImage.height * this.deviceImage.scale * 0.5);

        // Calculate device dimensions with current scaling
        const scale = this.deviceImage.scale || 1;
        const gameConfig = this.game.config as GameConfig;
        const deviceScaledWidth = this.deviceImage.width * (gameConfig.scaleRoomElementsX * scale);
        const deviceScaledHeight = this.deviceImage.height * (gameConfig.scaleRoomElementsY * scale);

        // Calculate optimal zoom scale with padding for better visibility
        const padding = 1.4;
        const zoomScaleX = ((gameConfig.width as number) / (deviceScaledWidth * padding));
        const zoomScaleY = ((gameConfig.height as number) / (deviceScaledHeight * padding));

        // Use smaller scale and respect maximum zoom limit
        const zoomScale = Math.min(
            Math.min(zoomScaleX, zoomScaleY),
            gameConfig.maxZoom
        );

        // Calculate target scroll position to center device
        const targetScrollX = deviceCenterX - (gameConfig.width as number) / 2;
        const targetScrollY = deviceCenterY - (gameConfig.height as number) / 2;

        // Synchronize zoom with parent wall scene
        const parentScene = this.scene.get(this.parentWall) as Phaser.Scene;
        parentScene.cameras.main.setScroll(targetScrollX, targetScrollY);
        this.cameras.main.setScroll(targetScrollX, targetScrollY);

        // Animate zoom transition for both cameras
        this.tweens.add({
            targets: [this.cameras.main, parentScene.cameras.main],
            zoom: zoomScale,
            duration: gameConfig.animDuration,
            scrollX: targetScrollX,
            scrollY: targetScrollY,
            ease: 'Expo'
        });

        // Update device visual feedback
        if(this.deviceImage.input != null){
            this.deviceImage.input.cursor = 'default';
            this.deviceImage.clearTint();
        }

        // Notify other systems about entering closeup mode
        eventsCenter.emit('enter-closeup', {
            current_device: this.deviceId,
            device_long_id: this.scene.key,
            interaction_structure: this.interactionStructure,
            interaction_values: this.interactionValues,
            device_wall: this.parentWall,
            zoom_info: {
                scrollX: targetScrollX,
                scrollY: targetScrollY,
                zoomScale: zoomScale
            }
        });
    }

    /**
     * Resets the camera zoom to normal view and exits closeup mode
     * Restores default camera positioning and device interactivity
     */
    private resetZoom(): void {
        this.isZoomedIn = false;

        // Calculate center positions for camera reset
        const deviceCenterX = this.cameras.main.getBounds().width / 2;
        const deviceCenterY = this.cameras.main.getBounds().height / 2;

        // Animate device camera back to normal
        const gameConfig = this.game.config as GameConfig;
        this.cameras.main.pan(deviceCenterX, deviceCenterY, gameConfig.animDuration, 'Expo');
        this.cameras.main.zoomTo(1, gameConfig.animDuration, 'Expo');

        // Reset parent wall camera as well
        const parentScene = this.scene.get(this.parentWall) as Phaser.Scene;
        const parentWallCenterX = parentScene.cameras.main.getBounds().width / 2;
        const parentWallCenterY = parentScene.cameras.main.getBounds().height / 2;

        parentScene.cameras.main.pan(parentWallCenterX, parentWallCenterY, gameConfig.animDuration, 'Expo');
        parentScene.cameras.main.zoomTo(1, gameConfig.animDuration, 'Expo');

        // Restore device interactivity
        if(this.deviceImage.input != null)
            this.deviceImage.input.cursor = 'pointer';
    }

    /**
     * Updates a specific interaction value and refreshes device state
     * @param data Update data containing device, interaction, and new value
     */
    private updateInteraction(data: InteractionUpdateData): void {
        if (data.device != this.deviceId) return;
        this.interactionValues[data.interaction] = data.value;
        this.updateState();
    }

    /**
     * Updates the device's visual state based on current interaction values
     * Changes texture, position, scale, and origin as needed
     */
    private updateState(): void {
        // Find the appropriate visual state for current interaction values
        const visualState = this.findMatchingVisualState(this.visualStates, this.interactionValues);
        const stateIndex = this.states.findIndex(state => state.image === visualState.image);

        // Update device texture to match current state
        this.deviceImage.setTexture('device_' + this.scene.key + '_' + stateIndex);

        // Apply default positioning from device configuration
        this.deviceImage.setPosition(
            this.position.x,
            this.position.y
        );
        this.deviceImage.setScale(
            (this.game.config as GameConfig).scaleRoomElementsX * (this.position.scale || 1),
            (this.game.config as GameConfig).scaleRoomElementsY * (this.position.scale || 1)
        )
        .setOrigin(this.position.origin || 0.5);

        // Apply visual state-specific positioning overrides if present
        if (visualState.position) {
            if(visualState.position.x && visualState.position.y){
                this.deviceImage.setPosition(
                    visualState.position.x,
                    visualState.position.y
                );
            }
            if (visualState.position.scale) {
                this.deviceImage.setScale(
                    (this.game.config as GameConfig).scaleRoomElementsX * visualState.position.scale,
                    (this.game.config as GameConfig).scaleRoomElementsY * visualState.position.scale
                );
            }
            if (visualState.position.origin) {
                this.deviceImage.setOrigin(visualState.position.origin);
            }
        }
    }

    /**
     * Finds the appropriate visual state based on current interaction values
     * Evaluates conditions and returns the best matching state
     * @param visualStates Available visual states to choose from
     * @param interactionValues Current values of device interactions
     * @returns The matching visual state
     */
    private findMatchingVisualState(visualStates: VisualState[], interactionValues: { [key: string]: unknown }): VisualState {
        /**
         * Evaluates a single condition against current interaction values
         * @param condition Condition to evaluate
         * @param interactionValues Current interaction values
         * @returns Whether the condition is met
         */
        function evaluateCondition(condition: Condition, interactionValues: { [key: string]: unknown }): boolean {
            const currentValue = interactionValues[condition.name];

            // Default to equality comparison if no operator specified
            if (!condition.operator) {
                return currentValue === condition.value;
            }

            // Handle various comparison operators
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

        // Sort states by specificity - more specific states checked first
        const sortedStates = [...visualStates].sort((a, b) => {
            // Non-default states have priority over default states
            if (a.default && !b.default) return 1;
            if (!a.default && b.default) return -1;

            // Among non-default states, prefer those with more conditions
            const aConditions = a.conditions?.length || 0;
            const bConditions = b.conditions?.length || 0;
            return bConditions - aConditions;
        });

        // Find first state where all conditions are satisfied
        const matchingState = sortedStates.find(state => {
            // Skip default states in this pass
            if (state.default === true) {
                return false;
            }

            // Skip states without conditions (unless default)
            if (!state.conditions) {
                return false;
            }

            // All conditions must be met for a match
            return state.conditions.every(condition =>
                evaluateCondition(condition, interactionValues)
            );
        });

        // Fall back to default state if no specific state matches
        if (!matchingState) {
            const defaultState = sortedStates.find(state => state.default === true);
            if (!defaultState) {
                throw new Error("No default visual state found for device");
            }
            return defaultState;
        }

        return matchingState;
    }

    /**
     * Applies zoom settings from another device to maintain synchronized view
     * @param scrollX Horizontal scroll position
     * @param scrollY Vertical scroll position
     * @param zoomScale Zoom level to apply
     */
    public applyZoom(scrollX: number, scrollY: number, zoomScale: number): void {
        this.cameras.main.setScroll(scrollX, scrollY);
        this.cameras.main.setZoom(zoomScale);
    }

    /**
     * Disables interactivity for this device
     * Used when another device is in focus or during certain game states
     */
    public disableInteractivity(): void {
        this.deviceImage.disableInteractive();
        if(this.deviceImage.input != null){
            this.deviceImage.input.cursor = 'default';
            this.deviceImage.clearTint();
            this.isZoomedIn = true;
        }
    }

    /**
     * Enables interactivity for this device
     * Restores click functionality and hover cursor
     */
    public enableInteractivity(): void {
        if(this.deviceImage.input != null)
            this.deviceImage.input.cursor = 'pointer';
        this.deviceImage.setInteractive({ useHandCursor: true });
        this.isZoomedIn = false;
    }

    /**
     * Hides the device from view
     */
    public hideDevice(): void {
        this.deviceImage.setVisible(false);
    }

    /**
     * Shows the device in the scene
     */
    public showDevice(): void {
        this.deviceImage.setVisible(true);
    }
}

export default Device;