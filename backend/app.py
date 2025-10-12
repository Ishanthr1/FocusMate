"""
FocusMate Backend API
Flask server with Socket.IO for real-time video analysis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
from datetime import datetime
import os
from dotenv import load_dotenv
from utils.vision_processor import VisionProcessor

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')

# Enable CORS for React frontend
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# Initialize SocketIO for real-time communication
socketio = SocketIO(app, cors_allowed_origins="http://localhost:5173")

# Initialize vision processor
print("🔄 Initializing Vision Processor...")
vision_processor = VisionProcessor()

# Store active sessions
active_sessions = {}

# ============================================================
# REST API Endpoints
# ============================================================

@app.route('/', methods=['GET'])
def welcome():
    """Welcome endpoint"""
    return jsonify({
        'message': 'Welcome to FocusMate API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health',
            'start_session': '/api/session/start',
            'end_session': '/api/session/end'
        }
    }), 200


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'FocusMate backend is running',
        'vision_processor': 'active'
    }), 200


@app.route('/api/session/start', methods=['POST'])
def start_session():
    """
    Start a new study session
    Expected JSON: {
        user_id, duration, subject, study_mode,
        difficulty, break_preference, distraction_sensitivity
    }
    """
    try:
        data = request.json
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Store session data
        active_sessions[session_id] = {
            'user_id': data.get('user_id'),
            'start_time': datetime.now().isoformat(),
            'duration': data.get('duration'),
            'subject': data.get('subject'),
            'study_mode': data.get('study_mode'),
            'difficulty': data.get('difficulty'),
            'break_preference': data.get('break_preference'),
            'distraction_sensitivity': data.get('distraction_sensitivity'),
            'events': []
        }

        print(f"✅ Session started: {session_id}")

        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Session started successfully'
        }), 201

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/session/end', methods=['POST'])
def end_session():
    """
    End a study session and save data
    Expected JSON: { session_id }
    """
    try:
        data = request.json
        session_id = data.get('session_id')

        if session_id in active_sessions:
            session_data = active_sessions[session_id]
            session_data['end_time'] = datetime.now().isoformat()

            # TODO: Save to database
            print(f"💾 Session {session_id} ended. Total events: {len(session_data['events'])}")

            # Remove from active sessions
            del active_sessions[session_id]

            return jsonify({
                'success': True,
                'message': 'Session ended and data saved',
                'total_events': len(session_data['events'])
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# WebSocket Events for Real-time Video Analysis
# ============================================================

@socketio.on('connect')
def handle_connect():
    """Client connected"""
    print('🔗 Client connected')
    emit('connection_response', {'status': 'connected'})


@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected"""
    print('❌ Client disconnected')


@socketio.on('video_frame')
def handle_video_frame(data):
    """
    Receive video frame from frontend, analyze it, send back results
    Expected data: {
        session_id: str,
        frame: base64 encoded image,
        timestamp: str
    }
    """
    try:
        session_id = data.get('session_id')
        frame_data = data.get('frame')

        # Decode base64 image
        img_data = base64.b64decode(frame_data.split(',')[1])
        np_img = np.frombuffer(img_data, dtype=np.uint8)
        frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        # Analyze frame with ML models
        analysis_result = vision_processor.analyze_frame(frame)
        analysis_result['session_id'] = session_id
        analysis_result['timestamp'] = data.get('timestamp')

        # Log significant events
        if session_id in active_sessions and analysis_result['suggestion']:
            active_sessions[session_id]['events'].append({
                'type': 'detection',
                'timestamp': datetime.now().isoformat(),
                'emotion': analysis_result['emotion'],
                'distraction_level': analysis_result['distraction_level'],
                'suggestion': analysis_result['suggestion']
            })
            print(f"📊 {session_id}: {analysis_result['suggestion']}")

        # Emit results back to client
        emit('analysis_result', analysis_result)

    except Exception as e:
        print(f"❌ Error processing frame: {e}")
        emit('analysis_error', {'error': str(e)})


@socketio.on('request_help')
def handle_help_request(data):
    """Handle AI assistant help requests"""
    session_id = data.get('session_id')
    print(f"🆘 Help requested for session {session_id}")

    # Log event
    if session_id in active_sessions:
        active_sessions[session_id]['events'].append({
            'type': 'help_requested',
            'timestamp': datetime.now().isoformat()
        })

    emit('help_response', {
        'message': 'AI Assistant coming soon!'
    })


# ============================================================
# Run Server
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 FocusMate Backend Starting...")
    print("📡 Server running on http://localhost:5000")
    print("🤖 Vision Processor: ACTIVE")
    print("=" * 60)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)