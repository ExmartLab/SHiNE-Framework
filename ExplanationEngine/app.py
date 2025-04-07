from flask import Flask
from flask_socketio import SocketIO

engine_type = "REST" # Alternatively: "Websocket"

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Shared data store (for demonstration only)
user_data = {}

if engine_type == "REST":
    from rest_routes import register_routes
    register_routes(app, user_data)
elif engine_type == "Websocket":
    from socket_events import register_socket_events
    register_socket_events(socketio, user_data)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)