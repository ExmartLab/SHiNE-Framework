import Wall from "./Wall";
import eventsCenter from "../EventsCenter";

class Room extends Phaser.Scene {

    walls = [];

    preloadImages;
    currentWall;

    navigators = [];

    constructor(config){
        super(config);
    }

    preload(){
        this.load.image('left_nav_btn', 'assets/images/control/left.png');
        this.load.image('right_nav_btn', 'assets/images/control/right.png');
    }

    create(data){
        this.createWalls(data.walls);
        this.showRoomLocationText(data.name);
        this.navigationWall();

        eventsCenter.on('enter-closeup', () => this.hideNavigators());
        eventsCenter.on('exit-closeup', () => this.showNavigators());
    }

    createWalls(walls){

        let currentSceneKey = this.scene.key;

        for(let i = 0; i < walls.length; i++){
            let wallName = currentSceneKey + '_wall' + (i+1);

            walls[i].parentRoom = currentSceneKey;

            let showWall = false;
            if(walls[i].default){
                this.currentWall = i;
                showWall = true;
            } else {
                showWall = false;
            }
            
            this.scene.add(wallName, Wall, showWall, walls[i]);
            this.walls.push(wallName);
        }
    }

    showRoomLocationText(locationRoom){
        this.add.text(Math.floor(this.game.config.width * 0.05), Math.floor(this.game.config.height * 0.90), locationRoom, { fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setDepth(1);
    }

    navigationWall(){
        const leftArrow = this.add.image(this.game.config.width * 0.075, this.game.config.height * 0.3, 'left_nav_btn').setOrigin(1).setScale(0.25).setDepth(1);
        const rightArrow = this.add.image(this.game.config.width * 0.95, this.game.config.height * 0.3, 'right_nav_btn').setOrigin(1).setScale(0.25).setDepth(1);

        leftArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.prevWall, this);
        rightArrow.setInteractive({ useHandCursor: true }).on('pointerdown', this.nextWall, this);

        this.navigators.push(leftArrow);
        this.navigators.push(rightArrow);
    }

    nextWall(){
        this.scene.get(this.walls[this.currentWall]).hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        this.currentWall++;
        if(this.currentWall < this.walls.length){
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            this.currentWall = 0;
            this.scene.launch(this.walls[this.currentWall]);
        }
    }

    prevWall(){
        this.scene.get(this.walls[this.currentWall]).hideDevices();
        this.scene.stop(this.walls[this.currentWall]);
        this.currentWall--;
        if(this.currentWall >= 0){
            this.scene.launch(this.walls[this.currentWall]);
        } else {
            this.currentWall = this.walls.length - 1;
            this.scene.launch(this.walls[this.currentWall]);
        }
    }

    hideNavigators(){
        for(let i = 0; i < this.navigators.length; i++){
            this.navigators[i].setVisible(false);
        }
    }

    showNavigators(){
        for(let i = 0; i < this.navigators.length; i++){
            this.navigators[i].setVisible(true);
        }
    }


}

export default Room;