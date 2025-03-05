import Wall from "./Wall";
import { eventsCenter } from "../EventsCenter";
import { Scene, GameObjects } from 'phaser';

// Define interfaces for the wall data
interface WallData {
    parentRoom?: string;
    default?: boolean;
    [key: string]: any;
}

// Interface for room data
interface RoomData {
    name: string;
    walls: WallData[];
    [key: string]: any;
}

class Room extends Phaser.Scene {
    private walls: string[] = [];
    private preloadImages: any;
    private currentWall: number;
    private navigators: Phaser.GameObjects.Image[] = [];

    constructor(config: Phaser.Types.Scenes.SettingsConfig) {
        super(config);
    }

    preload(): void {
        this.load.image('left_nav_btn', 'assets/images/control/left.png');
        this.load.image('right_nav_btn', 'assets/images/control/right.png');
    }

    create(data: RoomData): void {
        this.createWalls(data.walls);
        this.showRoomLocationText(data.name);
        this.navigationWall();

        eventsCenter.on('enter-closeup', () => this.hideNavigators());
        eventsCenter.on('exit-closeup', () => this.showNavigators());

        eventsCenter.on('show-wall', (room: string, wall: string) => {            
            if (this.scene.key === room) {
                let wallID = parseInt(wall.charAt(wall.length - 1)) - 1;
                this.currentWall = wallID;
                this.scene.launch(this.walls[wallID]); // Co-launch the wall scene
            }
        });

        eventsCenter.emit('room-loaded', this.scene.key);
    }

    private createWalls(walls: WallData[]): void {
        if (this.walls.length > 0)
            return;

        let currentSceneKey = this.scene.key;

        for (let i = 0; i < walls.length; i++) {
            let wallName = currentSceneKey + '_wall' + (i + 1);

            walls[i].parentRoom = currentSceneKey;

            let showWall = false;
            if (walls[i].default) {
                this.currentWall = i;
                showWall = true;
            } else {
                showWall = false;
            }
            
            this.scene.add(wallName, Wall, showWall, walls[i]);
            this.walls.push(wallName);
        }
    }

    private showRoomLocationText(locationRoom: string): void {
        this.add.text(
            Math.floor(Number(this.game.config.width) * 0.05), 
            Math.floor(Number(this.game.config.height) * 0.90), 
            locationRoom, 
            { 
                fontSize: '24px',
                color: '#ffffff', 
                stroke: '#000000', 
                strokeThickness: 4 
            }
        ).setDepth(1);
    }

    private navigationWall(): void {
        const leftArrow = this.add.image(
            Number(this.game.config.width) * 0.075, 
            Number(this.game.config.height) * 0.3, 
            'left_nav_btn'
        ).setOrigin(1).setScale(0.25).setDepth(1);
        
        const rightArrow = this.add.image(
            Number(this.game.config.width) * 0.95, 
            Number(this.game.config.height) * 0.3, 
            'right_nav_btn'
        ).setOrigin(1).setScale(0.25).setDepth(1);

        leftArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.prevWall, this);
        rightArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.nextWall, this);

        this.navigators.push(leftArrow);
        this.navigators.push(rightArrow);
    }

    private nextWall(): void {
        const currentWallScene = this.scene.get(this.walls[this.currentWall]) as Wall;
        currentWallScene.hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        
        this.currentWall++;
        if (this.currentWall < this.walls.length) {
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            this.currentWall = 0;
            this.scene.launch(this.walls[this.currentWall]);
        }
    }

    private prevWall(): void {
        console.log(this.currentWall);
        const currentWallScene = this.scene.get(this.walls[this.currentWall]) as Wall;
        currentWallScene.hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        
        this.currentWall--;
        if (this.currentWall >= 0) {
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            this.currentWall = this.walls.length - 1;
            this.scene.launch(this.walls[this.currentWall]);
        }
    }

    private hideNavigators(): void {
        for (let i = 0; i < this.navigators.length; i++) {
            this.navigators[i].setVisible(false);
        }
    }

    private showNavigators(): void {
        for (let i = 0; i < this.navigators.length; i++) {
            this.navigators[i].setVisible(true);
        }
    }
}

export default Room;