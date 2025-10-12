"""
Computer Vision Processing with MediaPipe
Handles face detection, emotion recognition, and posture analysis
"""

import cv2
import mediapipe as mp
import numpy as np
from fer import FER

class VisionProcessor:
    def __init__(self):
        """Initialize MediaPipe and emotion detector"""
        # MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Emotion detector
        self.emotion_detector = FER(mtcnn=True)

        print("✅ Vision Processor initialized")

    def analyze_frame(self, frame):
        """
        Analyze a single video frame
        Returns dict with face, emotion, and posture data
        """
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

        # Convert BGR to RGB (OpenCV uses BGR, MediaPipe uses RGB)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Detect face landmarks
        face_results = self.face_mesh.process(rgb_frame)
        if face_results.multi_face_landmarks:
            results['face_detected'] = True
            landmarks = face_results.multi_face_landmarks[0]

            # Check if looking away
            results['looking_away'] = self._check_looking_away(landmarks, frame.shape)

        # Detect posture
        pose_results = self.pose.process(rgb_frame)
        if pose_results.pose_landmarks:
            results['posture'] = self._analyze_posture(pose_results.pose_landmarks)

        # Detect emotion
        emotion_data = self.emotion_detector.detect_emotions(frame)
        if emotion_data and len(emotion_data) > 0:
            emotions = emotion_data[0]['emotions']
            dominant_emotion = max(emotions, key=emotions.get)
            results['emotion'] = dominant_emotion
            results['emotion_confidence'] = emotions[dominant_emotion]

            # Determine if user needs help or is tired
            results['needs_help'] = self._check_needs_help(emotions)
            results['is_tired'] = self._check_tired(emotions)

        # Calculate overall distraction level
        results['distraction_level'] = self._calculate_distraction(results)

        # Generate suggestion if needed
        results['suggestion'] = self._generate_suggestion(results)

        return results

    def _check_looking_away(self, landmarks, frame_shape):
        """Check if user is looking away from screen"""
        # Get nose tip landmark
        nose_tip = landmarks.landmark[1]

        # Simple check: if nose is too far to the side, user is looking away
        h, w = frame_shape[:2]
        nose_x = nose_tip.x * w

        # If nose is in outer 20% of frame, likely looking away
        if nose_x < w * 0.2 or nose_x > w * 0.8:
            return True
        return False

    def _analyze_posture(self, pose_landmarks):
        """Analyze if user has good posture or is slouching"""
        try:
            # Get shoulder and ear landmarks
            left_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
            left_ear = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EAR]
            right_ear = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EAR]

            # Calculate average shoulder and ear positions
            avg_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2
            avg_ear_y = (left_ear.y + right_ear.y) / 2

            # If ears are significantly below shoulders, user is slouching
            if avg_ear_y > avg_shoulder_y + 0.1:
                return 'slouching'
            else:
                return 'good'

        except:
            return 'unknown'

    def _check_needs_help(self, emotions):
        """Check if facial expression indicates need for help"""
        # Confused, sad, or angry expressions might indicate need for help
        help_emotions = ['sad', 'angry', 'fear']
        for emotion in help_emotions:
            if emotions.get(emotion, 0) > 0.4:
                return True
        return False

    def _check_tired(self, emotions):
        """Check if user appears tired or sleepy"""
        # Check for low energy emotions
        if emotions.get('neutral', 0) > 0.6 and emotions.get('happy', 0) < 0.2:
            return True
        return False

    def _calculate_distraction(self, results):
        """Calculate overall distraction level (0-1)"""
        distraction = 0.0

        if results['looking_away']:
            distraction += 0.4

        if results['posture'] == 'slouching':
            distraction += 0.2

        if not results['face_detected']:
            distraction += 0.4

        return min(distraction, 1.0)

    def _generate_suggestion(self, results):
        """Generate suggestion based on analysis"""
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
        """Clean up resources"""
        self.face_mesh.close()
        self.pose.close()