
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
        try {
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
        } catch (error) {
            console.error('Error calling Explanation REST API: ' + error);
        }

        return;
    }

    async requestExplanation(userId, userMessage) {
        try {
            const response = await fetch(this.connectionUrl + '/explanation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId, user_message: userMessage })
            });

            const responseData = await response.json();

            if (responseData.success && responseData.show_explanation) {
                return {
                    success: true,
                    explanation: responseData.explanation
                };
            }

            return { success: false };
        } catch (error) {
            console.error('Error fetching explanation from REST API:', error);
            return { success: false, error: error.message };
        }
    }

    
}

export default RestExplanationEngine;