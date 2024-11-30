import Phaser from 'phaser';
import GameScene from './Scenes/GameScene';
import configFile from './game.json'

// console.log(configFile.test);

// alert('test');


// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 768,
    height: 432,
    scaleRoomElementsX: 768 / 1024,
    scaleRoomElementsY: 432 / 576,
    maxZoom: 6,
    animDuration: 400,
    scene: GameScene,
    settings: configFile,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    }
};

let game = new Phaser.Game(config);

game.config.scaleRoomElementsX = 768 / 1024;
game.config.scaleRoomElementsY = 432 / 576;
game.config.maxZoom = 6;
game.config.animDuration = 400;
game.config.settings = configFile;