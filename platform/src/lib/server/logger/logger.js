class Logger {

    dbConn = null;
    sessionId = null;
    explanationEngine = null;
    metadataEngine = null;

    constructor(dbConn, sessionId, metadataEngine, explanationEngine = null) {
        this.dbConn = dbConn;
        this.sessionId = sessionId;
        this.explanationEngine = explanationEngine;
        this.metadataEngine = metadataEngine;
    }

    async logRuleTrigger(ruleId, ruleAction) {
        let log = {
            'type': 'RULE_TRIGGER',
            'metadata': {
                'rule_id': ruleId,
                'rule_action': ruleAction
            },
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logGameInteraction(interactionType, interactionData) {
        let log = {
            'type': interactionType,
            'metadata': interactionData,
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logTaskCompleted(taskId) {
        let log = {
            'type': 'TASK_COMPLETED',
            'metadata': { 'task_id': taskId },
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logTaskTimeout(taskId) {
        let log = {
            'type': 'TASK_TIMEOUT',
            'metadata': { 'task_id': taskId },
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logTaskBegin(taskId) {
        let log = {
            'type': 'TASK_BEGIN',
            'metadata': { 'task_id': taskId },
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logTaskAbort(taskId, abortReason) {
        let log = {
            'type': 'ABORT_TASK',
            'metadata': { 'task_id': taskId, 'abort_reason': abortReason },
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async logDeviceInteraction(metadata) {
        let log = {
            'type': 'DEVICE_INTERACTION',
            'metadata': metadata,
            'timestamp': Math.floor(new Date().getTime() / 1000)
        }

        await this.notifyExplanationEngine(log);

        await this.saveLogToDB(log);
    }

    async saveLogToDB(log) {
        log.userSessionId = this.sessionId;

        await this.dbConn.collection('logs').insertOne(log);
    }

    async notifyExplanationEngine(log) {
        if(this.explanationEngine == null)
            return;

        let data = await this.metadataEngine.generateMetadata();

        let explanationEngineType = (this.explanationEngine.getType()).toLowerCase();

        if(explanationEngineType == 'rest'){
            // Populate with logs
            let logs = await this.dbConn.collection('logs').find({ userSessionId: this.sessionId }).toArray();

            // Remove from each log _id and userSessionId
            for(let i = 0; i < logs.length; i++){
                delete logs[i]['_id'];
                delete logs[i]['userSessionId'];
            }

            data.logs = logs;

            data.logs.push(log);
        } else if(explanationEngineType == 'websocket') {
            data.log = log
        }

        await this.explanationEngine.logData(data);
    }
}

export default Logger;