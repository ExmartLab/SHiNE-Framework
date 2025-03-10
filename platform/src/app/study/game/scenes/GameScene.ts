import { eventsCenter } from "../EventsCenter";
import Room from "./Room";
import Smarty from "./Smarty";
import { Scene, GameObjects } from 'phaser';

// Define interfaces for device configuration
interface DeviceConfig {
    key: string;
    x: number;
    y: number;
    origin: number;
    scaleFactor: number;
}

// Interface for game config settings
interface GameSettings {
    rooms: {
        name: string;
        walls: {
            default?: boolean;
            [key: string]: any;
        }[];
        [key: string]: any;
    }[];
    [key: string]: any;
}

class GameScene extends Phaser.Scene {
    private rooms: any = null;
    private isZoomedIn: boolean;
    private activeDevice: Phaser.GameObjects.Image | null;
    private devices: Phaser.GameObjects.Image[];
    private deviceConfigs: DeviceConfig[];
    private wall: Phaser.GameObjects.Image;

    constructor() {
        super({ key: 'GameScene' });
        this.isZoomedIn = false;
        this.activeDevice = null;
        this.devices = [];
    }

    preload(): void {
        // Load room background
        //this.load.image('wall', 'assets/wall1.webp');
        
        // Load device images
        //this.load.image('oven', 'assets/wall1_oven.webp');
        // Add a placeholder device (replace with your actual second device)
        // this.load.image('microwave', 'assets/wall1_microwave.webp');
        //this.load.image('deepfryer', 'assets/wall1_deepfryer.webp');

        //this.load.image('coffee_machine', 'assets/coffee_machine-removebg-preview.png');
    }

    create(): void {
        // this.setupRoom();
        this.setupRooms();
        // this.setupDevices();
        // this.setupCamera();
        this.game.scene.add('Smarty', Smarty, true);
    }

    private setupRooms(): void {
        console.log(this.game.config.settings);
        let rooms = this.game.config.settings.rooms;

        let defaultRoom = this.getDefaultRoom();

        for(let i = 0; i < rooms.length; i++) {
            let roomName = (rooms[i].name).toLowerCase().replace(" ", "_");

            let showRoom = false;

            if(defaultRoom === rooms[i].name) {
                showRoom = true;
            }

            this.game.scene.add(roomName, Room, showRoom, this.game.config.settings.rooms[i]);
        }
    }

    private getDefaultRoom(): string | undefined {
        let rooms = this.game.config.settings.rooms;

        for(let i = 0; i < rooms.length; i++) {
            for(let j = 0; j < rooms[i].walls.length; j++) {
                if(rooms[i].walls[j].default) {
                    return rooms[i].name;
                }
            }
        }
        return undefined;
    }

    private setupDevices(): void {
        // Define device configurations
        this.deviceConfigs = [
            {
                key: 'oven',
                x: 598,
                y: 404,
                origin: 1,
                scaleFactor: 1
            },
            {
                key: 'deepfryer',
                x: 657,  // Adjust position as needed
                y: 285,  // Adjust position as needed
                origin: 1,
                scaleFactor: 1
            },
            {
                key: 'coffee_machine',
                x: 357,  // Adjust position as needed
                y: 285,  // Adjust position as needed
                origin: 1,
                scaleFactor: 0.19
            }
        ];

        // Create all devices
        this.deviceConfigs.forEach(deviceConfig => {
            const device = this.add.image(deviceConfig.x, deviceConfig.y, deviceConfig.key)
                .setOrigin(deviceConfig.origin)
                .setScale(
                    (this.game.config).scaleRoomElementsX * deviceConfig.scaleFactor, 
                    (this.game.config).scaleRoomElementsY * deviceConfig.scaleFactor
                )
                .setInteractive()
                .on('pointerdown', () => this.handleDeviceClick(device));
            
            this.devices.push(device);
        });
    }

    private setupCamera(): void {
        // Set up camera with bounds matching the scaled wall size
        const boundWidth = this.wall.width * this.game.config.scaleRoomElementsX;
        const boundHeight = this.wall.height * this.game.config.scaleRoomElementsY;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
    }

    private handleDeviceClick(device: Phaser.GameObjects.Image): void {
        if (!this.isZoomedIn || this.activeDevice !== device) {
            this.activeDevice = device;
            this.zoomToDevice(device);
            this.isZoomedIn = true;
        } else {
            this.resetZoom(device);
            this.isZoomedIn = false;
            this.activeDevice = null;
        }
    }

    private handleWallClick(): void {
        if (this.isZoomedIn) {
            this.resetZoom();
            this.isZoomedIn = false;
            this.activeDevice = null;
        }
    }

    private getScaleFactorByDevice(device: Phaser.GameObjects.Image): number {
        // Find device in deviceConfig by image key
        const deviceConfig = this.deviceConfigs.find(config => config.key === device.texture.key);
        return deviceConfig ? deviceConfig.scaleFactor : 1;
    }

    private zoomToDevice(device: Phaser.GameObjects.Image): void {
        let scaleFactor = this.getScaleFactorByDevice(device);
        // Calculate device center position
        const deviceCenterX = device.x - (device.width * device.scale * 0.5);
        const deviceCenterY = device.y - (device.height * device.scale * 0.5);

        console.log(deviceCenterX, deviceCenterY);
        console.log(device.width, device.height);
    
        // Calculate scaled dimensions
        const deviceScaledWidth = device.width * (this.game.config.scaleRoomElementsX * scaleFactor);
        const deviceScaledHeight = device.height * (this.game.config.scaleRoomElementsY * scaleFactor);
    
        console.log(deviceScaledWidth, deviceScaledHeight);

        // Calculate zoom scale with padding
        const padding = 1.4;
        const zoomScaleX = (Number(this.game.config.width) / (deviceScaledWidth * padding));
        const zoomScaleY = (Number(this.game.config.height) / (deviceScaledHeight * padding));
        
        // Use smaller scale and clamp values
        const zoomScale = Math.min(
            Math.min(zoomScaleX, zoomScaleY),
            this.game.config.maxZoom
        );
    
        // Immediately set scroll position to target device
        const targetScrollX = deviceCenterX - Number(this.game.config.width)/2;
        const targetScrollY = deviceCenterY - Number(this.game.config.height)/2;
        this.cameras.main.setScroll(targetScrollX, targetScrollY);
    
        // Animate only the zoom
        this.tweens.add({
            targets: this.cameras.main,
            zoom: zoomScale,
            duration: this.game.config.animDuration,
            scrollX: targetScrollX,
            scrollY: targetScrollY,
            ease: 'Expo'
        });
    }

    private resetZoom(device?: Phaser.GameObjects.Image): void {
        const centerX = this.cameras.main.getBounds().width / 2;
        const centerY = this.cameras.main.getBounds().height / 2;

        this.cameras.main.pan(centerX, centerY, this.game.config.animDuration, 'Expo');
        this.cameras.main.zoomTo(1, this.game.config.animDuration, 'Expo');
    }
}

export default GameScene;