
class RestExplanationEngine {

    connectionUrl = null;
    explanationCallback = null;

    constructor(connectionUrl, explanationCallback) {
        this.connectionUrl = connectionUrl;
        this.explanationCallback = explanationCallback;
    }

    getType() {
        return 'Rest';
    }

    async logData(data) {
        let response = await fetch(this.connectionUrl + '/logger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        let responseData = await response.json();
  
        if(responseData['success'] && responseData['show_explanation']){
            let explanationText = responseData['explanation'];
  
            let explanationData = {
                'user_id': responseData['user_id'],
                'explanation': explanationText,
            }

            await this.explanationCallback(explanationData);
        }
        return;
    }

    
}

export default RestExplanationEngine;