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
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from utils.vision_processor import VisionProcessor
from utils.report_generator import ReportGenerator
import json
import glob
from routes.ai_assistant import (
    get_or_create_chat,
    send_message,
    get_all_chats,
    delete_chat,
    load_chat_from_file
)

# Initialize report generator
report_generator = ReportGenerator()

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
vision_processor = None


def get_vision_processor():
    """Lazy load the vision processor"""
    global vision_processor
    if vision_processor is None:
        print("🔄 Initializing Vision Processor...")
        vision_processor = VisionProcessor()
    return vision_processor


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
    """Start a new study session with comprehensive tracking"""
    try:
        data = request.json
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Store detailed session data
        active_sessions[session_id] = {
            'session_id': session_id,
            'user_id': data.get('user_id'),
            'start_time': datetime.now().isoformat(),
            'end_time': None,
            'duration_planned': data.get('duration'),  # in minutes
            'duration_actual': 0,  # will calculate on end
            'subject': data.get('subject'),
            'study_mode': data.get('study_mode'),
            'difficulty': data.get('difficulty'),
            'break_preference': data.get('break_preference'),
            'distraction_sensitivity': data.get('distraction_sensitivity'),
            'music_choice': data.get('music_choice', 'none'),

            # Tracking data
            'pauses': [],  # List of pause events
            'breaks': [],  # List of micro breaks
            'events': [],  # ML detections
            'emotions_detected': {},  # Count of each emotion
            'posture_warnings': 0,
            'distraction_warnings': 0,
            'help_requests': 0,
            'total_paused_time': 0,  # seconds
            'focus_score': 0,  # calculated at end
            'completed': False  # True if finished, False if ended early
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


@app.route('/api/session/pause', methods=['POST'])
def pause_session():
    """Record when user pauses the session"""
    try:
        data = request.json
        session_id = data.get('session_id')

        if session_id in active_sessions:
            active_sessions[session_id]['pauses'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'paused'
            })
            print(f"⏸️ Session {session_id} paused")

            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/session/resume', methods=['POST'])
def resume_session():
    """Record when user resumes the session"""
    try:
        data = request.json
        session_id = data.get('session_id')

        if session_id in active_sessions:
            session = active_sessions[session_id]
            session['pauses'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'resumed'
            })

            # Calculate paused time
            pauses = session['pauses']
            if len(pauses) >= 2:
                last_pause = pauses[-2]
                last_resume = pauses[-1]
                pause_time = (datetime.fromisoformat(last_resume['timestamp']) -
                              datetime.fromisoformat(last_pause['timestamp'])).total_seconds()
                session['total_paused_time'] += pause_time

            print(f"▶️ Session {session_id} resumed")

            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/session/break', methods=['POST'])
def log_break():
    """Record a micro break"""
    try:
        data = request.json
        session_id = data.get('session_id')
        break_type = data.get('break_type', 'manual')  # 'manual' or 'suggested'

        if session_id in active_sessions:
            active_sessions[session_id]['breaks'].append({
                'timestamp': datetime.now().isoformat(),
                'type': break_type,
                'duration': data.get('duration', 0)
            })
            print(f"☕ Break logged for session {session_id}")

            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/session/end', methods=['POST'])
def end_session():
    """End a study session and calculate statistics"""
    try:
        data = request.json
        session_id = data.get('session_id')
        completed = data.get('completed', False)

        if session_id in active_sessions:
            session_data = active_sessions[session_id]
            session_data['end_time'] = datetime.now().isoformat()
            session_data['completed'] = completed

            # Calculate actual duration
            start = datetime.fromisoformat(session_data['start_time'])
            end = datetime.fromisoformat(session_data['end_time'])
            total_time = (end - start).total_seconds() / 60  # minutes
            active_time = total_time - (session_data['total_paused_time'] / 60)
            session_data['duration_actual'] = round(active_time, 2)

            # Calculate focus score (0-100)
            focus_score = 100
            focus_score -= session_data['distraction_warnings'] * 5
            focus_score -= session_data['posture_warnings'] * 3
            focus_score = max(0, min(100, focus_score))
            session_data['focus_score'] = focus_score

            # Count emotions
            for event in session_data['events']:
                if event.get('emotion'):
                    emotion = event['emotion']
                    session_data['emotions_detected'][emotion] = \
                        session_data['emotions_detected'].get(emotion, 0) + 1

            save_session_to_file(session_data)

            print(f"💾 Session {session_id} ended. Focus Score: {focus_score}")

            # Remove from active sessions
            del active_sessions[session_id]

            return jsonify({
                'success': True,
                'message': 'Session ended and data saved',
                'focus_score': focus_score,
                'session_data': session_data
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


@app.route('/api/sessions/all', methods=['GET'])
def get_all_sessions():
    """Get all saved sessions"""
    try:
        sessions = []
        session_files = glob.glob('data/sessions/*.json')

        for file_path in session_files:
            with open(file_path, 'r') as f:
                session_data = json.load(f)
                sessions.append(session_data)

        # Sort by start_time (most recent first)
        sessions.sort(key=lambda x: x['start_time'], reverse=True)

        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/report/single/<session_id>', methods=['GET'])
def download_single_report(session_id):
    """Generate and download PDF report for a single session"""
    try:
        # Load session data
        file_path = f'data/sessions/{session_id}.json'
        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404

        with open(file_path, 'r') as f:
            session_data = json.load(f)

        # Generate PDF
        pdf_path = f'data/reports/{session_id}.pdf'
        os.makedirs('data/reports', exist_ok=True)

        report_generator.generate_single_session_report(session_data, pdf_path)

        # Send file
        from flask import send_file
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FocusMate_Session_{session_id}.pdf'
        )

    except Exception as e:
        print(f"Error generating report: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/report/combined/<period>', methods=['GET'])
def download_combined_report(period):
    """Generate and download combined PDF report for a period"""
    try:
        # Load all sessions
        sessions = []
        session_files = glob.glob('data/sessions/*.json')

        for file_path in session_files:
            with open(file_path, 'r') as f:
                session_data = json.load(f)
                sessions.append(session_data)

        # Filter by period
        now = datetime.now()
        filtered_sessions = []

        for session in sessions:
            session_date = datetime.fromisoformat(session['start_time'])

            if period == 'today':
                if session_date.date() == now.date():
                    filtered_sessions.append(session)
            elif period == 'week':
                week_ago = now - timedelta(days=7)
                if session_date >= week_ago:
                    filtered_sessions.append(session)
            elif period == 'month':
                month_ago = now - timedelta(days=30)
                if session_date >= month_ago:
                    filtered_sessions.append(session)

        if not filtered_sessions:
            return jsonify({
                'success': False,
                'error': f'No sessions found for {period}'
            }), 404

        # Sort by date
        filtered_sessions.sort(key=lambda x: x['start_time'], reverse=True)

        # Generate PDF
        pdf_path = f'data/reports/{period}_report_{now.strftime("%Y%m%d")}.pdf'
        os.makedirs('data/reports', exist_ok=True)

        report_generator.generate_combined_report(filtered_sessions, period, pdf_path)

        # Send file
        from flask import send_file
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FocusMate_{period}_Report.pdf'
        )

    except Exception as e:
        print(f"Error generating combined report: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def save_session_to_file(session_data):
    """Save session data to JSON file"""
    import json
    import os

    # Create data directory if it doesn't exist
    data_dir = 'data/sessions'
    os.makedirs(data_dir, exist_ok=True)

    # Save to JSON file
    filename = f"{data_dir}/{session_data['session_id']}.json"
    with open(filename, 'w') as f:
        json.dump(session_data, f, indent=2)

    print(f"📄 Session saved to {filename}")


@app.route('/api/chat/new', methods=['POST'])
def create_new_chat():
    """Create a new chat session"""
    try:
        data = request.json
        user_id = data.get('user_id', 'user123')

        chat = get_or_create_chat(user_id)

        return jsonify({
            'success': True,
            'chat_id': chat['chat_id'],
            'message': 'New chat created'
        }), 201

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/chat/message', methods=['POST'])
def send_chat_message():
    """Send a message to the AI assistant"""
    try:
        data = request.json
        chat_id = data.get('chat_id')
        message = data.get('message')
        image = data.get('image')  # Base64 encoded image (optional)

        if not chat_id or not message:
            return jsonify({
                'success': False,
                'error': 'Missing chat_id or message'
            }), 400

        response, error = send_message(chat_id, message, image)

        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 500

        return jsonify({
            'success': True,
            'response': response,
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/chat/history/<chat_id>', methods=['GET'])
def get_chat_history(chat_id):
    """Get full chat history"""
    try:
        chat = load_chat_from_file(chat_id)

        if not chat:
            return jsonify({
                'success': False,
                'error': 'Chat not found'
            }), 404

        # Return messages without model_chat object
        return jsonify({
            'success': True,
            'chat_id': chat['chat_id'],
            'messages': chat['messages']
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/chat/all', methods=['GET'])
def get_user_chats():
    """Get all chats for a user"""
    try:
        user_id = request.args.get('user_id', 'user123')  # TODO: Get from Clerk

        chats = get_all_chats(user_id)

        return jsonify({
            'success': True,
            'chats': chats,
            'count': len(chats)
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/chat/delete/<chat_id>', methods=['DELETE'])
def delete_chat_route(chat_id):
    """Delete a chat"""
    try:
        delete_chat(chat_id)

        return jsonify({
            'success': True,
            'message': 'Chat deleted'
        }), 200

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
    """Receive video frame from frontend, analyze it, send back results"""
    try:
        session_id = data.get('session_id')
        frame_data = data.get('frame')

        # Decode base64 image
        img_data = base64.b64decode(frame_data.split(',')[1])
        np_img = np.frombuffer(img_data, dtype=np.uint8)
        frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        # Get vision processor (lazy load)
        processor = get_vision_processor()

        # Analyze frame with ML models
        analysis_result = processor.analyze_frame(frame)
        analysis_result['session_id'] = session_id
        analysis_result['timestamp'] = data.get('timestamp')

        # Log significant events and count warnings
        if session_id in active_sessions:
            session = active_sessions[session_id]

            if analysis_result['suggestion']:
                session['events'].append({
                    'type': 'detection',
                    'timestamp': datetime.now().isoformat(),
                    'emotion': analysis_result['emotion'],
                    'distraction_level': analysis_result['distraction_level'],
                    'suggestion': analysis_result['suggestion']
                })

                # Count warnings
                if analysis_result['looking_away'] or analysis_result['distraction_level'] > 0.5:
                    session['distraction_warnings'] += 1

                if analysis_result['posture'] == 'slouching':
                    session['posture_warnings'] += 1

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
        active_sessions[session_id]['help_requests'] += 1
        active_sessions[session_id]['events'].append({
            'type': 'help_requested',
            'timestamp': datetime.now().isoformat()
        })

    emit('help_response', {
        'message': 'Redirecting to My Notes...'
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
