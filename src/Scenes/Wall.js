import eventsCenter from "../EventsCenter";
import Device from "./Device";

class Wall extends Phaser.Scene {

    parentRoom;

    devices = [];
    devicesVisible = false;

    preloadImage;

    constructor(config){
        super(config);
    }

    preload(){

    }

    init(data){
        this.preloadImage = data.image;
        this.showDevices();
    }

    preload(){
        this.load.image('wallimg_' + this.scene.key, this.preloadImage);
        this.preloadImage = null;
    }

    create(data){
        this.parentRoom = data.parentRoom;

        let wall = this.add.image(0, 0, 'wallimg_' + this.scene.key).setOrigin(0).setScale(this.game.config.scaleRoomElementsX, this.game.config.scaleRoomElementsY).setDepth(0);
        
        const boundWidth = wall.width * this.game.config.scaleRoomElementsX;
        const boundHeight = wall.height * this.game.config.scaleRoomElementsY;
        this.cameras.main.setBounds(0, 0, boundWidth, boundHeight);
        
        this.scene.sendToBack();
        this.createDevices(data.devices);

        eventsCenter.on('enter-closeup', (data) => {
            // console.log(data);
            this.hideAllDevicesExcept(data.current_device);
        });

        eventsCenter.on('exit-closeup', () => {
            this.showDevices();
        });
    }

    createDevices(devices){
        if(!devices) return; // In case a wall has no devices
        if(this.devices.length > 0) return; // In case devices are already created

        for(let i = 0; i < devices.length; i++){
            let deviceName = this.scene.key + '_' + devices[i].name.replace(' ', '_').toLowerCase();
            
            devices[i].parentWall = this.scene.key;
            
            this.scene.add(deviceName, Device, true, devices[i]);
            this.devices.push(deviceName);
        }
        this.devicesVisible = true;
    }

    hideDevices(){
        for(let i = 0; i < this.devices.length; i++){
            this.scene.setVisible(false, this.devices[i]);
        }
        this.devicesVisible = false;
    }

    showDevices(){
        for(let i = 0; i < this.devices.length; i++){
            this.scene.setVisible(true, this.devices[i]);
        }
        this.devicesVisible = true;
    }

    hideAllDevicesExcept(deviceName){
        for(let i = 0; i < this.devices.length; i++){
            // If deviceName does not contains this.devices[i] then stop it
            if(!deviceName.includes(this.devices[i])){
                this.scene.setVisible(false, this.devices[i]);
            }
        }
    }

    getParentRoomKey(){
        return this.parentRoom;
    }


}

export default Wall;