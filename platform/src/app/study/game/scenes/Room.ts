import Wall from "./Wall";
import { eventsCenter } from "../EventsCenter";

/**
 * Configuration data for a wall within a room
 */
interface WallData {
    /** Reference to the parent room scene */
    parentRoom?: string;
    /** Whether this wall should be shown by default */
    default?: boolean;
    /** Additional wall properties */
    [key: string]: any;
}

/**
 * Configuration data for a room containing multiple walls
 */
interface RoomData {
    /** Display name of the room */
    name: string;
    /** Array of wall configurations for this room */
    walls: WallData[];
    /** Additional room properties */
    [key: string]: any;
}

/**
 * Room scene that manages multiple wall views and navigation between them
 * Handles wall switching, navigation controls, and room-level interactions
 */
class Room extends Phaser.Scene {
    /** Array of wall scene keys belonging to this room */
    private walls: string[] = [];
    /** Display name of this room */
    private roomName: string;
    /** Index of the currently active wall */
    private currentWall: number;
    /** Navigation arrow UI elements */
    private navigators: Phaser.GameObjects.Image[] = [];

    /**
     * Initialize the room scene
     * @param config Phaser scene configuration
     */
    constructor(config: Phaser.Types.Scenes.SettingsConfig) {
        super(config);
    }

    /**
     * Preload navigation button assets
     */
    preload(): void {
        this.load.image('left_nav_btn', 'assets/images/control/left.png');
        this.load.image('right_nav_btn', 'assets/images/control/right.png');
    }

    /**
     * Initialize the room scene with walls, navigation, and event listeners
     * @param data Room configuration containing walls and display name
     */
    create(data: RoomData): void {
        this.createWalls(data.walls);
        this.showRoomLocationText(data.name);
        this.navigationWall();

        // Hide navigation during device closeup mode
        eventsCenter.on('enter-closeup', () => this.hideNavigators());
        eventsCenter.on('exit-closeup', () => this.showNavigators());

        // Handle programmatic wall switching requests
        eventsCenter.on('show-wall', (room: string, wall: string) => {            
            if (this.scene.key === room) {
                let wallID = parseInt(wall.charAt(wall.length - 1)) - 1;
                this.currentWall = wallID;
                this.scene.launch(this.walls[wallID]);
            }
        });

        // Notify that this room has finished loading
        eventsCenter.emit('room-loaded', this.scene.key);

        this.roomName = data.name;
    }

    /**
     * Creates wall scenes from configuration data
     * Sets up parent-child relationships and determines default wall
     * @param walls Array of wall configuration data
     */
    private createWalls(walls: WallData[]): void {
        // Prevent duplicate wall creation
        if (this.walls.length > 0)
            return;

        let currentSceneKey = this.scene.key;

        // Create a scene for each wall in the room
        for (let i = 0; i < walls.length; i++) {
            // Generate unique wall scene key
            let wallName = currentSceneKey + '_wall' + (i + 1);

            // Establish parent-child relationship
            walls[i].parentRoom = currentSceneKey;

            // Determine if this wall should be visible initially
            let showWall = false;
            if (walls[i].default) {
                this.currentWall = i;
                showWall = true;
            }
            
            // Add wall scene to the game
            this.scene.add(wallName, Wall, showWall, walls[i]);
            this.walls.push(wallName);
        }
    }

    /**
     * Displays the room name as text overlay in the bottom-left corner
     * @param locationRoom Name of the room to display
     */
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

    /**
     * Creates left and right navigation arrows for wall switching
     * Positions arrows on screen edges and sets up click handlers
     */
    private navigationWall(): void {
        // Create left navigation arrow
        const leftArrow = this.add.image(
            Number(this.game.config.width) * 0.075, 
            Number(this.game.config.height) * 0.3, 
            'left_nav_btn'
        ).setOrigin(1).setScale(0.25).setDepth(1);
        
        // Create right navigation arrow
        const rightArrow = this.add.image(
            Number(this.game.config.width) * 0.95, 
            Number(this.game.config.height) * 0.3, 
            'right_nav_btn'
        ).setOrigin(1).setScale(0.25).setDepth(1);

        // Set up click handlers for navigation
        leftArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.prevWall, this);
        rightArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.nextWall, this);

        // Store references for show/hide functionality
        this.navigators.push(leftArrow);
        this.navigators.push(rightArrow);
    }

    /**
     * Switches to the next wall in sequence
     * Wraps around to the first wall if at the end
     */
    private nextWall(): void {
        // Hide devices on current wall and stop its scene
        const currentWallScene = this.scene.get(this.walls[this.currentWall]) as Wall;
        currentWallScene.hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        
        // Move to next wall index
        this.currentWall++;
        if (this.currentWall < this.walls.length) {
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            // Wrap around to first wall
            this.currentWall = 0;
            this.scene.launch(this.walls[this.currentWall]);
        }

        // Log wall switch interaction for analytics
        eventsCenter.emit('game-interaction', {
            type: 'WALL_SWITCH',
            data: {
                room: this.roomName,
                wall: this.currentWall.toString(),
            }
        });
    }

    /**
     * Switches to the previous wall in sequence
     * Wraps around to the last wall if at the beginning
     */
    private prevWall(): void {
        // Hide devices on current wall and stop its scene
        const currentWallScene = this.scene.get(this.walls[this.currentWall]) as Wall;
        currentWallScene.hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        
        // Move to previous wall index
        this.currentWall--;
        if (this.currentWall >= 0) {
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            // Wrap around to last wall
            this.currentWall = this.walls.length - 1;
            this.scene.launch(this.walls[this.currentWall]);
        }

        // Log wall switch interaction for analytics
        eventsCenter.emit('game-interaction', {
            type: 'WALL_SWITCH',
            data: {
                room: this.roomName,
                wall: this.currentWall.toString(),
            }
        });
    }

    /**
     * Hides navigation arrows from view
     * Used during device closeup mode to avoid UI clutter
     */
    private hideNavigators(): void {
        for (let i = 0; i < this.navigators.length; i++) {
            this.navigators[i].setVisible(false);
        }
    }

    /**
     * Shows navigation arrows on screen
     * Used when exiting device closeup mode
     */
    private showNavigators(): void {
        for (let i = 0; i < this.navigators.length; i++) {
            this.navigators[i].setVisible(true);
        }
    }
}

export default Room;