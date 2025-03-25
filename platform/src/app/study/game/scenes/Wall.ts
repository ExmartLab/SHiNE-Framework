import { eventsCenter } from "../EventsCenter";
import Device from "./Device";
import { Scene, GameObject } from 'phaser';

// Define interfaces for the configuration data
interface PreloadImage {
    key: string;
    path: string;
}

interface DoorPosition {
    x: number;
    y: number;
}

interface DoorDestination {
    room: string;
    wall: string;
}

interface Door {
    image: string;
    position: DoorPosition;
    destination: DoorDestination;
}

interface DeviceConfig {
    name: string;
    parentWall?: string;
    [key: string]: any;
}

interface WallData {
    parentRoom: string;
    image: string;
    doors?: Door[];
    devices?: DeviceConfig[];
    [key: string]: any;
}

interface EnterCloseupData {
    current_device: string;
    device_long_id: string;
    device_wall: string;
    zoom_info?: {
        scrollX: number;
        scrollY: number;
        zoomScale: number;
    };
    [key: string]: any;
}

class Wall extends Phaser.Scene {
    private parentRoom: string;
    private devices: string[] = [];
    private devicesVisible: boolean = false;
    private doors: Phaser.GameObjects.Image[] = [];
    private preloadImage: PreloadImage[] = [];

    constructor(config: Phaser.Types.Scenes.SettingsConfig) {
        super(config);
    }

    init(data: WallData): void {
        this.preloadImage.push({key: 'wallimg_' + this.scene.key, path: data.image});
        
        if (data.doors && data.doors.length > 0) { 
            for (let i = 0; i < data.doors.length; i++) {
                this.preloadImage.push({key: this.scene.key + '_door_' + i, path: data.doors[i].image});
            }
        }

        this.showDevices();
    }

    preload(): void {
        if (this.preloadImage.length === 0) return;
        
        for (let i = 0; i < this.preloadImage.length; i++) {
            this.load.image(this.preloadImage[i].key, this.preloadImage[i].path);
        }
        
        this.preloadImage = [];
    }

    create(data: WallData): void {
        this.parentRoom = data.parentRoom;

        let wall = this.add.image(0, 0, 'wallimg_' + this.scene.key)
            .setOrigin(0)
            .setScale(
                this.game.config.scaleRoomElementsX,
                this.game.config.scaleRoomElementsY
            )
            .setDepth(0);
        
        const boundWidth = wall.width * this.game.config.scaleRoomElementsX;
        const boundHeight = wall.height * this.game.config.scaleRoomElementsY;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
        
        this.scene.sendToBack();
        this.createDevices(data.devices);
        this.createDoors(data.doors);

        eventsCenter.on('enter-closeup', (data: EnterCloseupData) => {
            // Only process if this is the wall being zoomed in
            if (this.scene.key !== data.device_wall) return;
            
            // Instead of hiding devices, apply the same zoom to all devices on this wall
            if (data.zoom_info) {
                this.applyZoomToAllDevices(data.device_long_id, data.zoom_info);
            }
        });

        // eventsCenter.on('exit-closeup', (wallKey: string, data?: { resetZoom: boolean }) => {
        //     if(this.scene.key !== wallKey) return;
        //     console.log('exiting closeup wall')
            
        //     // Show all devices on this wall
        //     this.showDevices();
            
        //     // If resetZoom flag is true, reset zoom for all devices
        //     if (data && data.resetZoom) {
        //         this.resetZoomForAllDevices();
        //     }
        // });
    }

    private createDevices(devices: DeviceConfig[] | undefined): void {
        if (!devices) return; // In case a wall has no devices
        if (this.devices.length > 0) return; // In case devices are already created

        for (let i = 0; i < devices.length; i++) {
            let deviceName = this.scene.key + '_' + devices[i].name.replace(' ', '_').toLowerCase();
            
            devices[i].parentWall = this.scene.key;
            
            this.scene.add(deviceName, Device, true, devices[i]);
            this.devices.push(deviceName);
        }
        
        this.devicesVisible = true;
    }

    public hideDevices(): void {
        for (let i = 0; i < this.devices.length; i++) {
            this.scene.setVisible(false, this.devices[i]);
        }
        
        this.devicesVisible = false;
    }

    private showDevices(): void {
        for (let i = 0; i < this.devices.length; i++) {
            this.scene.setVisible(true, this.devices[i]);
        }
        
        this.devicesVisible = true;
    }

    // Method to apply zoom to all devices and disable interactivity for non-active devices
    private applyZoomToAllDevices(
        activeDeviceId: string, 
        zoomInfo: { scrollX: number; scrollY: number; zoomScale: number }
    ): void {
        for (let i = 0; i < this.devices.length; i++) {
            const deviceScene = this.scene.get(this.devices[i]) as Device;
            
            if (deviceScene) {
                if (this.devices[i] !== activeDeviceId) {
                    // For non-active devices, apply zoom and disable interactivity
                    deviceScene.applyZoom(zoomInfo.scrollX, zoomInfo.scrollY, zoomInfo.zoomScale);

                    deviceScene.disableInteractivity();

                }
            }
        }
    }

    private createDoors(doors: Door[] | undefined): void {
        if (!doors) return; // In case a wall has no doors

        let doorTemp: Phaser.GameObjects.Image;
        
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
                // Stop parent room
                this.hideDevices();

                let roomName = this.scene.key.split('_wall')[0];
                this.scene.stop(roomName);

                this.scene.start(doors[i].destination.room);

                eventsCenter.once('room-loaded', () => {
                    console.log('room loaded');
                    eventsCenter.emit('show-wall', doors[i].destination.room, doors[i].destination.wall);
                });
            });

            this.doors.push(doorTemp);
        }
    }

    public getParentRoomKey(): string {
        return this.parentRoom;
    }
}

export default Wall;