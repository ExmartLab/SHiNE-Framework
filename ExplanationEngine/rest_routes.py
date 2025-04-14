from flask import request, jsonify
from explanation import generate_explanation

def register_routes(app, user_data):
    @app.route('/engine/logger', methods=['POST'])
    def logger():
        data = request.json
        user_id = data.get('user_id')
        
        if user_id:
            user_data[user_id] = data
            
            # For demo purposes, always return an explanation
            # In a real implementation, you'd have logic to determine when to show explanations
            explanation, available = generate_explanation(user_id, user_data)
            
            if available:
                return jsonify({
                    "success": True,
                    "user_id": user_id,
                    "show_explanation": True,
                    "explanation": explanation
                })
            else:
                return jsonify({
                    "success": True,
                    "user_id": user_id,
                    "show_explanation": False,
                })
        
        return jsonify({
            "success": True,
            "show_explanation": False
        })
        

    @app.route('/engine/explanation', methods=['POST'])
    def explanation():
        data = request.json
        user_id = data.get('user_id')
        
        if user_id and user_id in user_data:
            # Generate an explanation based on stored user data
            explanation, available = generate_explanation(user_id, user_data)
            if available:
                return jsonify({
                    "success": True,
                    "show_explanation": True,
                    "explanation": explanation
                })
        
        return jsonify({
            "success": True,
            "show_explanation": False
        })