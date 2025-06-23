class Metadata {

    userData = null;
    sessionId = null;
    dbConn = null;
    gameConfig = null;

    constructor(dbConn, gameConfig, sessionId) {
        this.dbConn = dbConn;
        this.gameConfig = gameConfig;
        this.sessionId = sessionId;
    }

    async loadUserData() {
        let userData = await this.dbConn.collection('sessions').findOne({ sessionId: this.sessionId });

        this.userData = userData;
    }

    async generateMetadata() {

        let currentTask = await this.getCurrentUserTask();

        let inGameTime = this.getInGameTime(this.userData['startTime']);

        let userDevices = await this.getUserDevices();

        let environmentContext = this.getContextVariables();

        return {
            "user_id": this.sessionId,
            "current_task": currentTask['taskDetail']['id'],
            "ingame_time": inGameTime['hour'] + ':' + inGameTime['minute'],
            "environment": environmentContext,
            "devices": userDevices,
            "logs": []
        };
    }

    async getCurrentUserTask() {
        let currentTime = new Date();

        let currentTask = await this.dbConn.collection('tasks').findOne({ userSessionId: this.userData.sessionId, startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });

        let taskDetail = [];

        if (currentTask == null) {
            taskDetail['id'] = null;
            return { taskDetail, currentTask };
        }

        taskDetail = null;

        taskDetail = this.gameConfig.tasks.tasks.filter((task) => task.id == currentTask.taskId)[0];

        return { taskDetail, currentTask };
    }

    async getUserDevices() {
        let devices = await this.dbConn.collection('devices').find({ userSessionId: this.sessionId }).toArray();

        let userDevices = [];

        for(let i = 0; i < devices.length; i++){
          let device = devices[i];
          let deviceProperties = [];

          for(let j = 0; j < device.deviceInteraction.length; j++){
            deviceProperties.push({
              'name': device.deviceInteraction[j].name,
              'value': device.deviceInteraction[j].value
            });
          }

          userDevices.push({
            'device': device.deviceId,
            'interactions': deviceProperties 
          });
        }


        return userDevices;
    }

    getContextVariables() {
        if (!this.userData['customData']) {
            return [];
        }

        let contextVariables = [];


        for (let property in this.userData['customData']) {
            contextVariables.push({
                'name': property,
                'value': this.userData['customData'][property]
            })
        }

        return contextVariables;
    }

    getInGameTime(startTime) {
        let currentTime = new Date();
        let timeDifference = ((currentTime.getTime() - startTime.getTime()) / 1000) * this.gameConfig.environment.time.speed;

        // Based on start time
        let minute = this.gameConfig.environment.time.startTime.minute + Math.floor(timeDifference / 60);
        let hour = this.gameConfig.environment.time.startTime.hour + Math.floor(minute / 60);
        minute = (minute % 60);
        hour = (hour % 24);

        if (minute < 10) {
            minute = '0' + minute;
        }

        if (hour < 10) {
            hour = '0' + hour;
        }

        return { hour, minute };
    }
}

export default Metadata;