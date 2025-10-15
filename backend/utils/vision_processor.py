import os
os.environ['GLOG_minloglevel'] = '2'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import cv2
import mediapipe as mp
import numpy as np
from fer import FER

class VisionProcessor:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.emotion_detector = FER(mtcnn=True)
        print("Vision Processor initialized")

    def analyze_frame(self, frame):
        results = {
            'face_detected': False,
            'emotion': None,
            'emotion_confidence': 0,
            'posture': 'unknown',
            'looking_away': False,
            'distraction_level': 0.0,
            'needs_help': False,
            'is_tired': False,
            'suggestion': None
        }
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_results = self.face_mesh.process(rgb_frame)
        if face_results.multi_face_landmarks:
            results['face_detected'] = True
            landmarks = face_results.multi_face_landmarks[0]
            results['looking_away'] = self._check_looking_away(landmarks, frame.shape)
        pose_results = self.pose.process(rgb_frame)
        if pose_results.pose_landmarks:
            results['posture'] = self._analyze_posture(pose_results.pose_landmarks)
        emotion_data = self.emotion_detector.detect_emotions(frame)
        if emotion_data and len(emotion_data) > 0:
            emotions = emotion_data[0]['emotions']
            dominant_emotion = max(emotions, key=emotions.get)
            results['emotion'] = dominant_emotion
            results['emotion_confidence'] = emotions[dominant_emotion]
            results['needs_help'] = self._check_needs_help(emotions)
            results['is_tired'] = self._check_tired(emotions)
        results['distraction_level'] = self._calculate_distraction(results)
        results['suggestion'] = self._generate_suggestion(results)
        return results

    def _check_looking_away(self, landmarks, frame_shape):
        nose_tip = landmarks.landmark[1]
        h, w = frame_shape[:2]
        nose_x = nose_tip.x * w
        if nose_x < w * 0.2 or nose_x > w * 0.8:
            return True
        return False

    def _analyze_posture(self, pose_landmarks):
        try:
            left_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
            left_ear = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EAR]
            right_ear = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EAR]
            avg_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2
            avg_ear_y = (left_ear.y + right_ear.y) / 2
            if avg_ear_y > avg_shoulder_y + 0.1:
                return 'slouching'
            else:
                return 'good'
        except:
            return 'unknown'

    def _check_needs_help(self, emotions):
        help_emotions = ['sad', 'angry', 'fear']
        for emotion in help_emotions:
            if emotions.get(emotion, 0) > 0.4:
                return True
        return False

    def _check_tired(self, emotions):
        if emotions.get('neutral', 0) > 0.6 and emotions.get('happy', 0) < 0.2:
            return True
        return False

    def _calculate_distraction(self, results):
        distraction = 0.0
        if results['looking_away']:
            distraction += 0.4
        if results['posture'] == 'slouching':
            distraction += 0.2
        if not results['face_detected']:
            distraction += 0.4
        return min(distraction, 1.0)

    def _generate_suggestion(self, results):
        if results['is_tired']:
            return "You look tired. Time for a break?"
        if results['needs_help']:
            return "You seem stuck. Need help?"
        if results['looking_away']:
            return "Stay focused! Keep your eyes on your work."
        if results['posture'] == 'slouching':
            return "Sit up straight for better focus!"
        if results['distraction_level'] > 0.6:
            return "You're getting distracted. Refocus on your goal."
        return None

    def cleanup(self):
        self.face_mesh.close()
        self.pose.close()
