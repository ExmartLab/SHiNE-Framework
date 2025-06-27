import { eventsCenter } from "../EventsCenter";
import { Scene, GameObjects, Types } from 'phaser';

/**
 * Represents a position in 2D space with optional scaling and origin settings
 */
interface Position {
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
    /** Optional scaling factor */
    scale?: number;
    /** Optional origin point (0-1) */
    origin?: number;
}

/**
 * Defines a condition for visual state evaluation
 */
interface Condition {
    /** Name of the interaction or variable to check */
    name: string;
    /** Expected value for the condition */
    value: any;
    /** Comparison operator (>, <, >=, <=, ==, !=) */
    operator?: string;
}

/**
 * Defines a visual state for the device with conditions and positioning
 */
interface VisualState {
    /** Path to the image asset for this state */
    image: string;
    /** Whether this is the default state */
    default?: boolean;
    /** Conditions that must be met for this state to be active */
    conditions?: Condition[];
    /** Optional position override for this state */
    position?: Position;
}

/**
 * Internal state representation linking state names to images
 */
interface State {
    /** State identifier */
    state: string;
    /** Associated image path */
    image: string;
}

/**
 * Current state of an interaction with its value and additional properties
 */
interface InteractionState {
    /** Current value of the interaction */
    value: any;
    /** Additional state properties */
    [key: string]: any;
}

/**
 * Device interaction definition with current state
 */
interface Interaction {
    /** Unique name identifier for the interaction */
    name: string;
    /** Current state of the interaction */
    currentState: InteractionState;
    /** Additional interaction properties */
    [key: string]: any;
}

/**
 * Complete device configuration data used for initialization
 */
interface DeviceData {
    /** Unique device identifier */
    id: string;
    /** ID of the wall scene this device belongs to */
    parentWall: string;
    /** Initial position and scaling */
    position: Position;
    /** Available visual states for the device */
    visualState: VisualState[];
    /** Interactive elements of the device */
    interactions: Interaction[];
}

/**
 * Data structure for updating device interactions
 */
interface InteractionUpdateData {
    /** Target device ID */
    device: string;
    /** Interaction name to update */
    interaction: string;
    /** New value for the interaction */
    value: any;
}

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
    private interactionValues: { [key: string]: any } = {};

    /** Main device image game object */
    private deviceImage: GameObjects.Image;
    /** Device position and scaling information */
    private position: Position;

    /** Whether the device is currently zoomed in */
    private isZoomedIn: boolean = false;

    /** Reference to smart home control panel */
    private smartHomePanel: any;

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
        let customScale = (position.scale ? position.scale : 1);
        let customOrigin = (position.origin ? position.origin : 0.5);
        
        const device = this.add.image(position.x, position.y, 'device_' + this.scene.key + '_0')
            .setOrigin(customOrigin)
            .setScale(
                (this.game.config as any).scaleRoomElementsX * customScale, 
                (this.game.config as any).scaleRoomElementsY * customScale
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
            let interaction = interactions[i];

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
        const boundWidth = (this.game.config as any).width;
        const boundHeight = (this.game.config as any).height;
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
        const deviceScaledWidth = this.deviceImage.width * ((this.game.config as any).scaleRoomElementsX * scale);
        const deviceScaledHeight = this.deviceImage.height * ((this.game.config as any).scaleRoomElementsY * scale);

        // Calculate optimal zoom scale with padding for better visibility
        const padding = 1.4;
        const zoomScaleX = ((this.game.config as any).width / (deviceScaledWidth * padding));
        const zoomScaleY = ((this.game.config as any).height / (deviceScaledHeight * padding));

        // Use smaller scale and respect maximum zoom limit
        const zoomScale = Math.min(
            Math.min(zoomScaleX, zoomScaleY),
            (this.game.config as any).maxZoom
        );

        // Calculate target scroll position to center device
        const targetScrollX = deviceCenterX - (this.game.config as any).width / 2;
        const targetScrollY = deviceCenterY - (this.game.config as any).height / 2;

        // Synchronize zoom with parent wall scene
        let parentScene = this.scene.get(this.parentWall) as Phaser.Scene;
        parentScene.cameras.main.setScroll(targetScrollX, targetScrollY);
        this.cameras.main.setScroll(targetScrollX, targetScrollY);

        // Animate zoom transition for both cameras
        let tweens = this.tweens.add({
            targets: [this.cameras.main, parentScene.cameras.main],
            zoom: zoomScale,
            duration: (this.game.config as any).animDuration,
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
        this.cameras.main.pan(deviceCenterX, deviceCenterY, (this.game.config as any).animDuration, 'Expo');
        this.cameras.main.zoomTo(1, (this.game.config as any).animDuration, 'Expo');

        // Reset parent wall camera as well
        let parentScene = this.scene.get(this.parentWall) as Phaser.Scene;
        const parentWallCenterX = parentScene.cameras.main.getBounds().width / 2;
        const parentWallCenterY = parentScene.cameras.main.getBounds().height / 2;

        parentScene.cameras.main.pan(parentWallCenterX, parentWallCenterY, (this.game.config as any).animDuration, 'Expo');
        parentScene.cameras.main.zoomTo(1, (this.game.config as any).animDuration, 'Expo');

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
        let visualState = this.findMatchingVisualState(this.visualStates, this.interactionValues);
        let stateIndex = this.states.findIndex(state => state.image === visualState.image);

        // Update device texture to match current state
        this.deviceImage.setTexture('device_' + this.scene.key + '_' + stateIndex);

        // Apply default positioning from device configuration
        this.deviceImage.setPosition(
            this.position.x,
            this.position.y
        );
        this.deviceImage.setScale(
            (this.game.config as any).scaleRoomElementsX * (this.position.scale || 1),
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
                    (this.game.config as any).scaleRoomElementsX * visualState.position.scale,
                    (this.game.config as any).scaleRoomElementsY * visualState.position.scale
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
    private findMatchingVisualState(visualStates: VisualState[], interactionValues: { [key: string]: any }): VisualState {
        /**
         * Evaluates a single condition against current interaction values
         * @param condition Condition to evaluate
         * @param interactionValues Current interaction values
         * @returns Whether the condition is met
         */
        function evaluateCondition(condition: Condition, interactionValues: { [key: string]: any }): boolean {
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