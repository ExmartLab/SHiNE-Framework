import Room from "./Room";
import Smarty from "./Smarty";

/**
 * Main game scene that orchestrates the smart home simulation
 * Initializes and manages all rooms and the Smarty assistant character
 */
class GameScene extends Phaser.Scene {

    /**
     * Initialize the GameScene with its unique key
     */
    constructor() {
        super({ key: 'GameScene' });
    }

    /**
     * Preload assets for the game scene
     * Currently empty as assets are loaded by individual room scenes
     */
    preload(): void {

    }

    /**
     * Initialize the game scene and create all necessary components
     * Sets up all rooms from configuration and adds the Smarty assistant
     */
    create(): void {
        this.setupRooms();
        this.game.scene.add('Smarty', Smarty, true);
    }

    /**
     * Creates and initializes all room scenes from the game configuration
     * Determines which room should be shown by default and creates scene instances
     */
    private setupRooms(): void {
        let rooms = this.game.config.settings.rooms;

        // Find which room should be displayed initially
        let defaultRoom = this.getDefaultRoom();

        // Create a scene for each room in the configuration
        for(let i = 0; i < rooms.length; i++) {
            // Generate scene key from room name (lowercase, underscores for spaces)
            let roomName = (rooms[i].name).toLowerCase().replace(" ", "_");

            // Determine if this room should be visible initially
            let showRoom = false;
            if(defaultRoom === rooms[i].name) {
                showRoom = true;
            }

            // Add the room scene to the game with its configuration
            this.game.scene.add(roomName, Room, showRoom, this.game.config.settings.rooms[i]);
        }
    }

    /**
     * Finds the room that should be displayed by default
     * Searches through all rooms and walls to find one marked as default
     * @returns The name of the default room, or undefined if none found
     */
    private getDefaultRoom(): string | undefined {
        let rooms = this.game.config.settings.rooms;

        // Search through all rooms and their walls
        for(let i = 0; i < rooms.length; i++) {
            for(let j = 0; j < rooms[i].walls.length; j++) {
                // Return the room name if any of its walls is marked as default
                if(rooms[i].walls[j].default) {
                    return rooms[i].name;
                }
            }
        }
        return undefined;
    }

}

export default GameScene;