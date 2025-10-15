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
from routes.quiz_generator import generate_quiz, save_quiz_result, get_user_quizzes
import PyPDF2
import docx
from routes.ai_assistant import (
    get_or_create_chat,
    send_message,
    get_all_chats,
    delete_chat,
    load_chat_from_file
)

report_generator = ReportGenerator()
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
socketio = SocketIO(app, cors_allowed_origins="http://localhost:5173")
vision_processor = None

def get_vision_processor():
    global vision_processor
    if vision_processor is None:
        vision_processor = VisionProcessor()
    return vision_processor

active_sessions = {}

@app.route('/', methods=['GET'])
def welcome():
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
    return jsonify({
        'status': 'healthy',
        'message': 'FocusMate backend is running',
        'vision_processor': 'active'
    }), 200

@app.route('/api/session/start', methods=['POST'])
def start_session():
    try:
        data = request.json
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        active_sessions[session_id] = {
            'session_id': session_id,
            'user_id': data.get('user_id'),
            'start_time': datetime.now().isoformat(),
            'end_time': None,
            'duration_planned': data.get('duration'),
            'duration_actual': 0,
            'subject': data.get('subject'),
            'study_mode': data.get('study_mode'),
            'difficulty': data.get('difficulty'),
            'break_preference': data.get('break_preference'),
            'distraction_sensitivity': data.get('distraction_sensitivity'),
            'music_choice': data.get('music_choice', 'none'),
            'pauses': [],
            'breaks': [],
            'events': [],
            'emotions_detected': {},
            'posture_warnings': 0,
            'distraction_warnings': 0,
            'help_requests': 0,
            'total_paused_time': 0,
            'focus_score': 0,
            'completed': False
        }
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
    try:
        data = request.json
        session_id = data.get('session_id')
        if session_id in active_sessions:
            active_sessions[session_id]['pauses'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'paused'
            })
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/resume', methods=['POST'])
def resume_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        if session_id in active_sessions:
            session = active_sessions[session_id]
            session['pauses'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'resumed'
            })
            pauses = session['pauses']
            if len(pauses) >= 2:
                last_pause = pauses[-2]
                last_resume = pauses[-1]
                pause_time = (datetime.fromisoformat(last_resume['timestamp']) -
                              datetime.fromisoformat(last_pause['timestamp'])).total_seconds()
                session['total_paused_time'] += pause_time
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/break', methods=['POST'])
def log_break():
    try:
        data = request.json
        session_id = data.get('session_id')
        break_type = data.get('break_type', 'manual')
        if session_id in active_sessions:
            active_sessions[session_id]['breaks'].append({
                'timestamp': datetime.now().isoformat(),
                'type': break_type,
                'duration': data.get('duration', 0)
            })
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/end', methods=['POST'])
def end_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        completed = data.get('completed', False)
        if session_id in active_sessions:
            session_data = active_sessions[session_id]
            session_data['end_time'] = datetime.now().isoformat()
            session_data['completed'] = completed
            start = datetime.fromisoformat(session_data['start_time'])
            end = datetime.fromisoformat(session_data['end_time'])
            total_time = (end - start).total_seconds() / 60
            active_time = total_time - (session_data['total_paused_time'] / 60)
            session_data['duration_actual'] = round(active_time, 2)
            focus_score = 100
            focus_score -= session_data['distraction_warnings'] * 5
            focus_score -= session_data['posture_warnings'] * 3
            focus_score = max(0, min(100, focus_score))
            session_data['focus_score'] = focus_score
            for event in session_data['events']:
                if event.get('emotion'):
                    emotion = event['emotion']
                    session_data['emotions_detected'][emotion] = \
                        session_data['emotions_detected'].get(emotion, 0) + 1
            save_session_to_file(session_data)
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
    try:
        sessions = []
        session_files = glob.glob('data/sessions/*.json')
        for file_path in session_files:
            with open(file_path, 'r') as f:
                session_data = json.load(f)
                sessions.append(session_data)
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
    try:
        file_path = f'data/sessions/{session_id}.json'
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        with open(file_path, 'r') as f:
            session_data = json.load(f)
        pdf_path = f'data/reports/{session_id}.pdf'
        os.makedirs('data/reports', exist_ok=True)
        report_generator.generate_single_session_report(session_data, pdf_path)
        from flask import send_file
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FocusMate_Session_{session_id}.pdf'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/report/combined/<period>', methods=['GET'])
def download_combined_report(period):
    try:
        sessions = []
        session_files = glob.glob('data/sessions/*.json')
        for file_path in session_files:
            with open(file_path, 'r') as f:
                session_data = json.load(f)
                sessions.append(session_data)
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
            return jsonify({'success': False, 'error': f'No sessions found for {period}'}), 404
        filtered_sessions.sort(key=lambda x: x['start_time'], reverse=True)
        pdf_path = f'data/reports/{period}_report_{now.strftime("%Y%m%d")}.pdf'
        os.makedirs('data/reports', exist_ok=True)
        report_generator.generate_combined_report(filtered_sessions, period, pdf_path)
        from flask import send_file
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FocusMate_{period}_Report.pdf'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def save_session_to_file(session_data):
    import json
    import os
    data_dir = 'data/sessions'
    os.makedirs(data_dir, exist_ok=True)
    filename = f"{data_dir}/{session_data['session_id']}.json"
    with open(filename, 'w') as f:
        json.dump(session_data, f, indent=2)

@app.route('/api/chat/new', methods=['POST'])
def create_new_chat():
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/message', methods=['POST'])
def send_chat_message():
    try:
        data = request.json
        chat_id = data.get('chat_id')
        message = data.get('message')
        image = data.get('image')
        if not chat_id or not message:
            return jsonify({'success': False, 'error': 'Missing chat_id or message'}), 400
        response, error = send_message(chat_id, message, image)
        if error:
            return jsonify({'success': False, 'error': error}), 500
        return jsonify({'success': True, 'response': response, 'timestamp': datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/history/<chat_id>', methods=['GET'])
def get_chat_history(chat_id):
    try:
        chat = load_chat_from_file(chat_id)
        if not chat:
            return jsonify({'success': False, 'error': 'Chat not found'}), 404
        return jsonify({'success': True, 'chat_id': chat['chat_id'], 'messages': chat['messages']}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/all', methods=['GET'])
def get_user_chats():
    try:
        user_id = request.args.get('user_id', 'user123')
        chats = get_all_chats(user_id)
        return jsonify({'success': True, 'chats': chats, 'count': len(chats)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/delete/<chat_id>', methods=['DELETE'])
def delete_chat_route(chat_id):
    try:
        delete_chat(chat_id)
        return jsonify({'success': True, 'message': 'Chat deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz/generate', methods=['POST'])
def generate_quiz_route():
    try:
        data = request.json
        user_id = data.get('user_id', 'user123')
        topic = data.get('topic')
        question_count = data.get('question_count', 5)
        quiz_type = data.get('quiz_type', 'Multiple Choice')
        difficulty = data.get('difficulty', 'medium')
        document_text = data.get('document_text')
        if not topic and not document_text:
            return jsonify({'success': False, 'error': 'Please provide a topic or upload a document'}), 400
        quiz_data, error = generate_quiz(user_id, topic, question_count, quiz_type, difficulty, document_text)
        if error:
            return jsonify({'success': False, 'error': error}), 500
        return jsonify({'success': True, 'quiz': quiz_data}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz/submit', methods=['POST'])
def submit_quiz_route():
    try:
        data = request.json
        quiz_id = data.get('quiz_id')
        user_answers = data.get('answers')
        time_taken = data.get('time_taken')
        with open(f'data/quizzes/{quiz_id}.json', 'r') as f:
            quiz_data = json.load(f)
        score = 0
        detailed_results = []
        for i, question in enumerate(quiz_data['questions']):
            user_answer = user_answers.get(str(i), '')
            correct_answer = question['correct_answer']
            is_correct = False
            if quiz_data['quiz_type'] in ['Multiple Choice', 'True/False', 'Fill in the Blank']:
                is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
            else:
                is_correct = correct_answer.strip().lower() in user_answer.strip().lower()
            if is_correct:
                score += 1
            detailed_results.append({
                'question_number': i + 1,
                'user_answer': user_answer,
                'correct_answer': correct_answer,
                'is_correct': is_correct,
                'explanation': question.get('explanation', '')
            })
        results, error = save_quiz_result(quiz_id, user_answers, score, time_taken)
        if error:
            return jsonify({'success': False, 'error': error}), 500
        return jsonify({
            'success': True,
            'score': score,
            'total': len(quiz_data['questions']),
            'percentage': results['percentage'],
            'detailed_results': detailed_results
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz/history', methods=['GET'])
def get_quiz_history_route():
    try:
        user_id = request.args.get('user_id', 'user123')
        quizzes = get_user_quizzes(user_id)
        return jsonify({'success': True, 'quizzes': quizzes, 'count': len(quizzes)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz/upload-document', methods=['POST'])
def upload_document_route():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'}), 400
        file = request.files['file']
        filename = file.filename.lower()
        text = ""
        if filename.endswith('.txt'):
            text = file.read().decode('utf-8')
        elif filename.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text()
        elif filename.endswith('.docx'):
            doc = docx.Document(file)
            for paragraph in doc.paragraphs:
                text += paragraph.text + '\n'
        else:
            return jsonify({'success': False, 'error': 'Unsupported file type. Please upload .txt, .pdf, or .docx'}), 400
        if len(text) > 10000:
            text = text[:10000] + "..."
        return jsonify({'success': True, 'text': text}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    emit('connection_response', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    pass

@socketio.on('video_frame')
def handle_video_frame(data):
    try:
        session_id = data.get('session_id')
        frame_data = data.get('frame')
        if not frame_data:
            emit('analysis_error', {'error': 'No frame data'})
            return
        img_data = base64.b64decode(frame_data.split(',')[1])
        np_img = np.frombuffer(img_data, dtype=np.uint8)
        frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
        if frame is None:
            emit('analysis_error', {'error': 'Failed to decode frame'})
            return
        processor = get_vision_processor()
        analysis_result = processor.analyze_frame(frame)
        analysis_result['session_id'] = session_id
        analysis_result['timestamp'] = data.get('timestamp')
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
                if analysis_result['looking_away'] or analysis_result['distraction_level'] > 0.5:
                    session['distraction_warnings'] += 1
                if analysis_result['posture'] == 'slouching':
                    session['posture_warnings'] += 1
        emit('analysis_result', analysis_result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        emit('analysis_error', {'error': str(e)})

@socketio.on('request_help')
def handle_help_request(data):
    session_id = data.get('session_id')
    if session_id in active_sessions:
        active_sessions[session_id]['help_requests'] += 1
        active_sessions[session_id]['events'].append({
            'type': 'help_requested',
            'timestamp': datetime.now().isoformat()
        })
    emit('help_response', {'message': 'Redirecting to My Notes...'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
