import { AUTO, Game } from 'phaser';
import GameScene from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 768,
    height: 432,
    scene: GameScene
};

const StartGame = (parent: string, customConfig?: any) => {

    let game:any = new Game({ ...config, parent });

    // Set up room height and width, max zoom, and animation duration
    game.config.scaleRoomElementsX = 768 / 1024;
    game.config.scaleRoomElementsY = 432 / 576;
    game.config.maxZoom = 4;
    game.config.animDuration = 400;
    
    game.config.settings = customConfig;

    return game;

}

export default StartGame;