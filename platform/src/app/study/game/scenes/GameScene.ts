import Room from "./Room";
import Smarty from "./Smarty";

class GameScene extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {

    }

    create(): void {
        this.setupRooms();
        this.game.scene.add('Smarty', Smarty, true);
    }

    private setupRooms(): void {
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

}

export default GameScene;