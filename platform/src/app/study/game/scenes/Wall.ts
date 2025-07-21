import { eventsCenter } from "../EventsCenter";
import Device from "./Device";
import { 
    PreloadImage, 
    Door,  
    DeviceConfig, 
    WallData, 
    EnterCloseupData 
} from "../../types";

/**
 * Wall scene that displays a room wall with devices and doors
 * Manages device interactions, door navigation, and camera synchronization
 */
class Wall extends Phaser.Scene {
    /** Parent room scene key */
    private parentRoom: string;
    /** Array of device scene keys on this wall */
    private devices: string[] = [];
    /** Door image objects for navigation */
    private doors: Phaser.GameObjects.Image[] = [];
    /** Images to preload before scene creation */
    private preloadImage: PreloadImage[] = [];
    /** Whether devices are currently visible */
    private devicesVisible: boolean = false;

    /**
     * Initialize the wall scene
     * @param config Phaser scene configuration
     */
    constructor(config: Phaser.Types.Scenes.SettingsConfig) {
        super(config);
    }

    /**
     * Initialize the scene and prepare images for preloading
     * @param data Wall configuration with image paths and door data
     */
    init(data: WallData): void {
        // Queue wall background image for preloading
        this.preloadImage.push({key: 'wallimg_' + this.scene.key, path: data.image});
        
        // Queue door images if they exist
        if (data.doors && data.doors.length > 0) { 
            for (let i = 0; i < data.doors.length; i++) {
                this.preloadImage.push({key: this.scene.key + '_door_' + i, path: data.doors[i].image});
            }
        }

        this.showDevices();
    }

    /**
     * Preload all queued images for the wall and doors
     */
    preload(): void {
        if (this.preloadImage.length === 0) return;
        
        // Load all queued images
        for (let i = 0; i < this.preloadImage.length; i++) {
            this.load.image(this.preloadImage[i].key, this.preloadImage[i].path);
        }
        
        // Clear the preload queue
        this.preloadImage = [];
    }

    /**
     * Create the wall scene with background, devices, and doors
     * Sets up camera bounds and event listeners for device interactions
     * @param data Wall configuration data
     */
    create(data: WallData): void {
        this.parentRoom = data.parentRoom;

        // Create wall background image
        const wall = this.add.image(0, 0, 'wallimg_' + this.scene.key)
            .setOrigin(0)
            .setScale(
                this.game.config.scaleRoomElementsX,
                this.game.config.scaleRoomElementsY
            )
            .setDepth(0);
        
        // Set camera bounds to match scaled wall dimensions
        const boundWidth = wall.width * this.game.config.scaleRoomElementsX;
        const boundHeight = wall.height * this.game.config.scaleRoomElementsY;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
        
        // Ensure wall renders behind other elements
        this.scene.sendToBack();
        this.createDevices(data.devices);
        this.createDoors(data.doors);

        // Handle device closeup events
        eventsCenter.on('enter-closeup', (data: EnterCloseupData) => {
            // Only process if this wall contains the focused device
            if (this.scene.key !== data.device_wall) return;
            
            // Apply zoom to all devices for consistency
            if (data.zoom_info) {
                this.applyZoomToAllDevices(data.device_long_id, data.zoom_info);
            }
        });
    }

    /**
     * Creates device scenes for all devices configured on this wall
     * @param devices Array of device configurations, or undefined if no devices
     */
    private createDevices(devices: DeviceConfig[] | undefined): void {
        if (!devices) return; // Wall has no devices
        if (this.devices.length > 0) return; // Devices already created

        // Create a scene for each device
        for (let i = 0; i < devices.length; i++) {
            // Generate unique device scene key
            const deviceName = this.scene.key + '_' + devices[i].name.replace(' ', '_').toLowerCase();
            
            // Set parent wall reference
            devices[i].parentWall = this.scene.key;
            
            // Add device scene to the game
            this.scene.add(deviceName, Device, true, devices[i]);
            this.devices.push(deviceName);
        }
        
        this.devicesVisible = true;
    }

    /**
     * Hides all device scenes on this wall from view
     * Used when switching away from this wall
     */
    public hideDevices(): void {
        for (let i = 0; i < this.devices.length; i++) {
            this.scene.setVisible(false, this.devices[i]);
        }
        
        this.devicesVisible = false;
    }

    /**
     * Shows all device scenes on this wall
     * Used when switching to this wall or initializing
     */
    private showDevices(): void {
        for (let i = 0; i < this.devices.length; i++) {
            this.scene.setVisible(true, this.devices[i]);
        }
        
        this.devicesVisible = true;
    }

    /**
     * Applies zoom settings to all devices and manages interactivity
     * Synchronizes camera views and disables non-active device interactions
     * @param activeDeviceId The device currently in focus
     * @param zoomInfo Camera zoom and scroll information
     */
    private applyZoomToAllDevices(
        activeDeviceId: string, 
        zoomInfo: { scrollX: number; scrollY: number; zoomScale: number }
    ): void {
        for (let i = 0; i < this.devices.length; i++) {
            const deviceScene = this.scene.get(this.devices[i]) as Device;
            
            if (deviceScene) {
                if (this.devices[i] !== activeDeviceId) {
                    // Apply zoom to maintain visual consistency
                    deviceScene.applyZoom(zoomInfo.scrollX, zoomInfo.scrollY, zoomInfo.zoomScale);
                    // Disable interaction to focus on active device
                    deviceScene.disableInteractivity();
                }
            }
        }
    }

    /**
     * Creates interactive door objects for navigation between rooms
     * @param doors Array of door configurations, or undefined if no doors
     */
    private createDoors(doors: Door[] | undefined): void {
        if (!doors) return; // Wall has no doors

        let doorTemp: Phaser.GameObjects.Image;
        
        // Create each door with navigation functionality
        for (let i = 0; i < doors.length; i++) {
            doorTemp = this.add.image(
                doors[i].position.x,
                doors[i].position.y,
                this.scene.key + '_door_' + i
            )
            .setOrigin(0)
            .setScale(
                this.game.config.scaleRoomElementsX,
                this.game.config.scaleRoomElementsY
            )
            .setDepth(1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Clean up current wall state
                this.hideDevices();

                // Stop current room scene
                const roomName = this.scene.key.split('_wall')[0];
                this.scene.stop(roomName);

                // Start destination room
                this.scene.start(doors[i].destination.room);

                // Navigate to specific wall once room is loaded
                eventsCenter.once('room-loaded', () => {
                    eventsCenter.emit('show-wall', doors[i].destination.room, doors[i].destination.wall);
                    // Log room switch for analytics
                    eventsCenter.emit('game-interaction', {
                        type: 'ROOM_SWITCH',
                        data: {
                            destination_room: doors[i].destination.room,
                            destination_wall: doors[i].destination.wall,
                        }
                    });
                });
            })
            .on('pointerover', function() {
                this.setTint(0xAAAAAA); // Visual feedback on hover
            })
            .on('pointerout', function() {
                this.clearTint(); // Remove hover effect
            });

            this.doors.push(doorTemp);
        }
    }

    /**
     * Returns the parent room scene key
     * @returns Parent room identifier
     */
    public getParentRoomKey(): string {
        return this.parentRoom;
    }
}

export default Wall;