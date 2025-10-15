import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './StudySession.css';

const socket = io('http://localhost:5000');

function StudySession({ onBack, onNavigateToNotes }) {
    const [currentStep, setCurrentStep] = useState('setup');
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
    const [sessionId, setSessionId] = useState(null);
    const [currentSuggestion, setCurrentSuggestion] = useState(null);
    const [analysisData, setAnalysisData] = useState({
        emotion: 'neutral',
        posture: 'unknown',
        distraction_level: 0
    });

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const frameIntervalRef = useRef(null);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getProgress = () => {
        const totalSeconds = sessionConfig.duration * 60;
        return ((totalSeconds - timeRemaining) / totalSeconds) * 100;
    };

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

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            setCameraActive(false);
        }
    };

    const sendFrameToBackend = () => {
        if (videoRef.current && canvasRef.current && sessionId) {
            const canvas = canvasRef.current;
            const video = videoRef.current;

            if (video.videoWidth === 0 || video.videoHeight === 0) {
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const frameData = canvas.toDataURL('image/jpeg', 0.8);

            socket.emit('video_frame', {
                session_id: sessionId,
                frame: frameData,
                timestamp: new Date().toISOString()
            });
        }
    };

    const startBackendSession = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/session/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: 'user123',
                    duration: sessionConfig.duration,
                    subject: sessionConfig.subject,
                    study_mode: sessionConfig.studyMode,
                    difficulty: sessionConfig.difficulty,
                    break_preference: sessionConfig.breakPreference,
                    distraction_sensitivity: sessionConfig.distractionSensitivity,
                    music_choice: selectedMusic
                })
            });

            const data = await response.json();
            if (data.success) {
                setSessionId(data.session_id);
            }
        } catch (error) {
            console.error('Error starting backend session:', error);
        }
    };

    const logPause = async () => {
        if (sessionId) {
            try {
                await fetch('http://localhost:5000/api/session/pause', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
            } catch (error) {
                console.error('Error logging pause:', error);
            }
        }
    };

    const logResume = async () => {
        if (sessionId) {
            try {
                await fetch('http://localhost:5000/api/session/resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
            } catch (error) {
                console.error('Error logging resume:', error);
            }
        }
    };

    const endBackendSession = async (completed = false) => {
        if (sessionId) {
            try {
                const response = await fetch('http://localhost:5000/api/session/end', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        completed: completed
                    })
                });

                const data = await response.json();
            } catch (error) {
                console.error('Error ending backend session:', error);
            }
        }
    };

    useEffect(() => {
        socket.on('connect', () => {});

        socket.on('connection_response', (data) => {});

        socket.on('analysis_result', (data) => {
            setAnalysisData({
                emotion: data.emotion || 'neutral',
                posture: data.posture || 'unknown',
                distraction_level: data.distraction_level || 0
            });

            if (data.suggestion) {
                setCurrentSuggestion(data.suggestion);

                setTimeout(() => {
                    setCurrentSuggestion(null);
                }, 10000);
            }
        });

        socket.on('analysis_error', (data) => {
            console.error('Analysis error:', data.error);
        });

        socket.on('disconnect', () => {});

        return () => {
            socket.off('connect');
            socket.off('connection_response');
            socket.off('analysis_result');
            socket.off('analysis_error');
            socket.off('disconnect');
        };
    }, []);

    useEffect(() => {
        if (currentStep === 'session' && timeRemaining !== null && timeRemaining > 0 && !isPaused) {
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

            return () => {
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                }
            };
        }
    }, [currentStep, timeRemaining, isPaused]);

    useEffect(() => {
        if (currentStep === 'session') {
            startCamera();
            startBackendSession();
        }

        return () => {
            stopCamera();
        };
    }, [currentStep]);

    useEffect(() => {
        if (currentStep === 'session' && sessionId && cameraActive) {
            const timeoutId = setTimeout(() => {
                frameIntervalRef.current = setInterval(() => {
                    sendFrameToBackend();
                }, 3000);
            }, 2000);

            return () => {
                clearTimeout(timeoutId);
                if (frameIntervalRef.current) {
                    clearInterval(frameIntervalRef.current);
                }
            };
        }
    }, [sessionId, cameraActive, currentStep]);

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
        if (isPaused) {
            logResume();
        } else {
            logPause();
        }
        setIsPaused(!isPaused);
    };

    const handleEndSession = async () => {
        if (confirm('Are you sure you want to end this session?')) {
            stopCamera();
            if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            await endBackendSession(false);
            if (onBack) onBack();
        }
    };

    const handleSessionComplete = () => {
        stopCamera();
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        endBackendSession(true);

        alert('Session complete! Great work!');
        if (onBack) onBack();
    };

    const handleDismissSuggestion = () => {
        setCurrentSuggestion(null);
    };

    const handleRequestHelp = async () => {
        if (!isPaused) {
            setIsPaused(true);
            await logPause();
        }

        socket.emit('request_help', { session_id: sessionId });

        stopCamera();
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        await endBackendSession(false);

        if (onNavigateToNotes) {
            onNavigateToNotes();
        }
    };

    if (currentStep === 'setup') {
        return (
            <div className="study-session">
                <div className="session-form-container">
                    <h2 className="form-title">Start Your Focus Session</h2>
                    <p className="form-subtitle">Let's set up your perfect study environment</p>

                    <form className="session-form">
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

                        <div className="form-group">
                            <label className="form-label">
                                Study Mode <span className="required">*</span>
                            </label>
                            <div className="mode-grid">
                                {[
                                    { value: 'reading', label: 'Reading' },
                                    { value: 'practice', label: 'Practice Problems' },
                                    { value: 'review', label: 'Review' },
                                    { value: 'writing', label: 'Writing/Essays' }
                                ].map(mode => (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        className={`mode-card ${sessionConfig.studyMode === mode.value ? 'active' : ''}`}
                                        onClick={() => handleInputChange('studyMode', mode.value)}
                                    >
                                        <span className="mode-label">{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

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

    if (currentStep === 'music') {
        const musicOptions = [
            { id: 'lofi', name: 'Lo-fi Beats' },
            { id: 'classical', name: 'Classical Music' },
            { id: 'ambient', name: 'Ambient Sounds' },
            { id: 'nature', name: 'Nature Sounds' },
            { id: 'whitenoise', name: 'White Noise' },
            { id: 'piano', name: 'Piano Instrumental' }
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

    if (currentStep === 'session') {
        return (
            <div className="active-session-screen">
                <canvas ref={canvasRef} style={{ display: 'none' }} />

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

                    <div className="analysis-display">
                        <div className="analysis-item">
                            <span className="analysis-label">Emotion:</span>
                            <span className="analysis-value">{analysisData.emotion}</span>
                        </div>
                        <div className="analysis-item">
                            <span className="analysis-label">Posture:</span>
                            <span className="analysis-value">{analysisData.posture}</span>
                        </div>
                        <div className="analysis-item">
                            <span className="analysis-label">Focus:</span>
                            <span className="analysis-value">
                                {Math.round((1 - analysisData.distraction_level) * 100)}%
                            </span>
                        </div>
                    </div>

                    <div className="notification-area">
                        {currentSuggestion ? (
                            <div className="notification-active">
                                <p className="notification-message">{currentSuggestion}</p>
                                <div className="notification-actions">
                                    <button className="help-btn" onClick={handleRequestHelp}>
                                        Get Help
                                    </button>
                                    <button className="dismiss-btn" onClick={handleDismissSuggestion}>
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="notification-placeholder">
                                Focus tracking active... {cameraActive ? '' : ''}
                            </p>
                        )}
                    </div>
                </div>

                <div className="camera-feed">
                    <div className="camera-header">
                        <span className="camera-status">
                            {cameraActive ? 'Recording' : 'Camera Off'}
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
