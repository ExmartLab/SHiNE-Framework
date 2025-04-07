from explanation import generate_explanation, check_if_explanation_needed

def register_socket_events(socketio, user_data):
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')


    @socketio.on('disconnect')
    def handle_disconnect():
        print('Client disconnected')


    @socketio.on('user_metadata')
    def handle_user_metadata(data):
        user_id = data.get('user_id')
        if user_id:
            if user_id not in user_data:
                user_data[user_id] = {}
            
            # Update everything except logs
            user_data[user_id].update({
                key: value for key, value in data.items() if key != 'logs'
            })
            
            print(f"Received metadata for user {user_id}")


    @socketio.on('user_log')
    def handle_user_log(data):
        user_id = data.get('user_id')
        if user_id:
            # Store the log
            if user_id not in user_data:
                user_data[user_id] = {'logs': []}
            
            if 'logs' not in user_data[user_id]:
                user_data[user_id]['logs'] = []
                
            user_data[user_id]['logs'].append(data.get('log'))
            
            # For demo, send an explanation after receiving log events
            # This could be based on specific conditions in real implementation
            should_explain = data.get('log')['type'] == 'RULE'
            
            if should_explain:
                explanation, available = generate_explanation(user_id, user_data)
                if available:
                    socketio.emit('explanation_receival', {
                        'user_id': user_id,
                        'explanation': explanation
                    })


    @socketio.on('explanation_request')
    def handle_explanation_request(data):
        user_id = data.get('user_id')
        if user_id:
            explanation, available = generate_explanation(user_id, user_data)
            if available:
                socketio.emit('explanation_receival', {
                    'user_id': user_id,
                    'explanation': explanation
                })