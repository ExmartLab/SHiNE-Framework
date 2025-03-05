import 'phaser';

declare module 'phaser' {
  namespace Types {
    namespace Core {
      interface GameConfig {
        scaleRoomElementsX?: number;
        scaleRoomElementsY?: number;
        maxZoom?: number;
        animDuration?: number;
        settings?: any;
      }
    }
  }
}