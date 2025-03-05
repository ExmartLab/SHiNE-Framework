import { AUTO, Game } from 'phaser';
import GameScene from './scenes/GameScene';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 768,
    height: 432,
    scene: GameScene
};

const StartGame = (parent: string, customConfig?: any) => {

    let game:any = new Game({ ...config, parent });

    game.config.scaleRoomElementsX = 768 / 1024;
    game.config.scaleRoomElementsY = 432 / 576;
    game.config.maxZoom = 6;
    game.config.animDuration = 400;
    
    // Use custom config from API if available, otherwise use default configFile
    game.config.settings = customConfig;
    
    console.log(customConfig);

    // // Store device states if available
    // if (customConfig?.deviceStates) {
    //     game.config.deviceStates = customConfig.deviceStates;
    // }

    return game;

}

export default StartGame;