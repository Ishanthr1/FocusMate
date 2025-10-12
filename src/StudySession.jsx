import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './StudySession.css';

// Connect to backend
const socket = io('http://localhost:5000');

function StudySession({ onBack }) {
    const [currentStep, setCurrentStep] = useState('setup'); // 'setup', 'music', 'session'
    const [sessionConfig, setSessionConfig] = useState({
        duration: 25,
        subject: '',
        studyMode: '',
        difficulty: 'medium',
        breakPreference: 'yes',
        distractionSensitivity: 'medium'
    });
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const timerIntervalRef = useRef(null);

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate progress percentage
    const getProgress = () => {
        const totalSeconds = sessionConfig.duration * 60;
        return ((totalSeconds - timeRemaining) / totalSeconds) * 100;
    };

    // Start webcam
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCameraActive(true);
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please check permissions.');
        }
    };

    // Stop webcam
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            setCameraActive(false);
        }
    };

    // Timer countdown effect
    useEffect(() => {
        if (currentStep === 'session' && timeRemaining !== null && !isPaused) {
            timerIntervalRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        handleSessionComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timerIntervalRef.current);
        }
    }, [currentStep, timeRemaining, isPaused]);

    // Start camera when session starts
    useEffect(() => {
        if (currentStep === 'session') {
            startCamera();
        }
        return () => {
            stopCamera();
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [currentStep]);

    const handleInputChange = (field, value) => {
        setSessionConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleStartSession = () => {
        if (!sessionConfig.subject || !sessionConfig.studyMode) {
            alert('Please fill in all required fields!');
            return;
        }
        setCurrentStep('music');
    };

    const handleMusicSelection = (music) => {
        setSelectedMusic(music);
    };

    const handleStartWithMusic = () => {
        setTimeRemaining(sessionConfig.duration * 60);
        setCurrentStep('session');
    };

    const handlePauseToggle = () => {
        setIsPaused(!isPaused);
    };

    const handleEndSession = () => {
        if (confirm('Are you sure you want to end this session?')) {
            stopCamera();
            clearInterval(timerIntervalRef.current);
            // TODO: Save session data
            alert('Session ended! Data will be saved to analytics.');
            if (onBack) onBack();
        }
    };

    const handleSessionComplete = () => {
        stopCamera();
        alert('Session complete! Great work! 🎉');
        // TODO: Save session data
        if (onBack) onBack();
    };

    // Setup Form Screen
    if (currentStep === 'setup') {
        return (
            <div className="study-session">
                <div className="session-form-container">
                    <h2 className="form-title">Start Your Focus Session</h2>
                    <p className="form-subtitle">Let's set up your perfect study environment</p>

                    <form className="session-form">
                        {/* Duration */}
                        <div className="form-group">
                            <label className="form-label">
                                Study Duration <span className="required">*</span>
                            </label>
                            <div className="duration-options">
                                {[15, 25, 45, 60, 90].map(minutes => (
                                    <button
                                        key={minutes}
                                        type="button"
                                        className={`duration-btn ${sessionConfig.duration === minutes ? 'active' : ''}`}
                                        onClick={() => handleInputChange('duration', minutes)}
                                    >
                                        {minutes} min
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="form-group">
                            <label className="form-label">
                                What are you studying? <span className="required">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={sessionConfig.subject}
                                onChange={(e) => handleInputChange('subject', e.target.value)}
                            >
                                <option value="">Select a subject</option>
                                <option value="mathematics">Mathematics</option>
                                <option value="science">Science</option>
                                <option value="history">History</option>
                                <option value="language">Language Arts</option>
                                <option value="computer-science">Computer Science</option>
                                <option value="business">Business</option>
                                <option value="arts">Arts</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* Study Mode */}
                        <div className="form-group">
                            <label className="form-label">
                                Study Mode <span className="required">*</span>
                            </label>
                            <div className="mode-grid">
                                {[
                                    { value: 'reading', label: 'Reading', emoji: '📖' },
                                    { value: 'practice', label: 'Practice Problems', emoji: '✍️' },
                                    { value: 'review', label: 'Review', emoji: '🔄' },
                                    { value: 'writing', label: 'Writing/Essays', emoji: '📝' }
                                ].map(mode => (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        className={`mode-card ${sessionConfig.studyMode === mode.value ? 'active' : ''}`}
                                        onClick={() => handleInputChange('studyMode', mode.value)}
                                    >
                                        <span className="mode-emoji">{mode.emoji}</span>
                                        <span className="mode-label">{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty Level */}
                        <div className="form-group">
                            <label className="form-label">Difficulty Level</label>
                            <div className="difficulty-selector">
                                {['easy', 'medium', 'hard'].map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={`difficulty-btn ${sessionConfig.difficulty === level ? 'active' : ''}`}
                                        onClick={() => handleInputChange('difficulty', level)}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Break Preference */}
                        <div className="form-group">
                            <label className="form-label">Enable Pomodoro Breaks?</label>
                            <div className="toggle-group">
                                <button
                                    type="button"
                                    className={`toggle-btn ${sessionConfig.breakPreference === 'yes' ? 'active' : ''}`}
                                    onClick={() => handleInputChange('breakPreference', 'yes')}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${sessionConfig.breakPreference === 'no' ? 'active' : ''}`}
                                    onClick={() => handleInputChange('breakPreference', 'no')}
                                >
                                    No
                                </button>
                            </div>
                        </div>

                        {/* Distraction Sensitivity */}
                        <div className="form-group">
                            <label className="form-label">Distraction Sensitivity</label>
                            <div className="sensitivity-slider">
                                {['low', 'medium', 'high'].map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={`sensitivity-btn ${sessionConfig.distractionSensitivity === level ? 'active' : ''}`}
                                        onClick={() => handleInputChange('distractionSensitivity', level)}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            className="continue-btn"
                            onClick={handleStartSession}
                        >
                            Continue to Music Selection
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Music Selection Screen
    if (currentStep === 'music') {
        const musicOptions = [
            { id: 'lofi', name: 'Lo-fi Beats', preview: '🎵' },
            { id: 'classical', name: 'Classical Music', preview: '🎼' },
            { id: 'ambient', name: 'Ambient Sounds', preview: '🌊' },
            { id: 'nature', name: 'Nature Sounds', preview: '🌲' },
            { id: 'whitenoise', name: 'White Noise', preview: '📻' },
            { id: 'piano', name: 'Piano Instrumental', preview: '🎹' }
        ];

        return (
            <div className="study-session">
                <div className="music-selection-container">
                    <h2 className="form-title">Choose Your Focus Music</h2>
                    <p className="form-subtitle">Select background music to help you concentrate</p>

                    <div className="music-grid">
                        {musicOptions.map(music => (
                            <button
                                key={music.id}
                                className={`music-card ${selectedMusic === music.id ? 'active' : ''}`}
                                onClick={() => handleMusicSelection(music.id)}
                            >
                                <span className="music-preview">{music.preview}</span>
                                <span className="music-name">{music.name}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        className={`no-music-btn ${selectedMusic === 'none' ? 'active-no-music' : ''}`}
                        onClick={() => handleMusicSelection('none')}
                    >
                        No Music - Silent Study
                    </button>

                    <div className="music-actions">
                        <button
                            className="back-btn"
                            onClick={() => setCurrentStep('setup')}
                        >
                            Back
                        </button>
                        <button
                            className="start-session-btn"
                            onClick={handleStartWithMusic}
                            disabled={!selectedMusic}
                        >
                            Start Focus Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Active Session Screen (Timer + Camera)
    if (currentStep === 'session') {
        return (
            <div className="active-session-screen">
                {/* Main Timer Display */}
                <div className="timer-container">
                    <div className="session-header">
                        <div className="session-info">
                            <h2 className="session-subject">{sessionConfig.subject}</h2>
                            <p className="session-mode">{sessionConfig.studyMode}</p>
                        </div>
                        <button className="end-session-icon-btn" onClick={handleEndSession}>
                            ✕
                        </button>
                    </div>

                    <div className="timer-display">
                        <div className="progress-ring">
                            <svg className="progress-ring-svg" width="300" height="300">
                                <circle
                                    className="progress-ring-circle-bg"
                                    stroke="#e2e8f0"
                                    strokeWidth="12"
                                    fill="transparent"
                                    r="140"
                                    cx="150"
                                    cy="150"
                                />
                                <circle
                                    className="progress-ring-circle"
                                    stroke="url(#gradient)"
                                    strokeWidth="12"
                                    fill="transparent"
                                    r="140"
                                    cx="150"
                                    cy="150"
                                    strokeDasharray={`${2 * Math.PI * 140}`}
                                    strokeDashoffset={`${2 * Math.PI * 140 * (1 - getProgress() / 100)}`}
                                    transform="rotate(-90 150 150)"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#5B7BA6" />
                                        <stop offset="100%" stopColor="#2C3E50" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="timer-text">
                                <div className="time-remaining">{formatTime(timeRemaining)}</div>
                                <div className="time-label">Remaining</div>
                            </div>
                        </div>
                    </div>

                    <div className="session-controls">
                        <button className="control-btn pause-btn" onClick={handlePauseToggle}>
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button className="control-btn end-btn" onClick={handleEndSession}>
                            End Session
                        </button>
                    </div>

                    {/* Notification Area (for ML messages later) */}
                    <div className="notification-area">
                        <p className="notification-placeholder">Focus tracking active...</p>
                    </div>
                </div>

                {/* Webcam Feed */}
                <div className="camera-feed">
                    <div className="camera-header">
                        <span className="camera-status">
                            {cameraActive ? '🔴 Recording' : '⚪ Camera Off'}
                        </span>
                    </div>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="video-element"
                    />
                </div>
            </div>
        );
    }
}

export default StudySession;