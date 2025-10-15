import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import './Profile.css';

function Profile() {
    const { user } = useUser();
    const [activeSubTab, setActiveSubTab] = useState('profile');
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [questionnaireData, setQuestionnaireData] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendEmail, setFriendEmail] = useState('');
    const [pendingRequests, setPendingRequests] = useState([]);

    useEffect(() => {
        checkQuestionnaire();
        fetchFriends();
        fetchPendingRequests();
    }, []);

    const checkQuestionnaire = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/profile/questionnaire?user_id=${user?.id || 'user123'}`);
            const data = await response.json();

            if (!data.completed) {
                setShowQuestionnaire(true);
            } else {
                setQuestionnaireData(data.data);
            }
        } catch (error) {
            console.error('Error checking questionnaire:', error);
            setShowQuestionnaire(true);
        }
    };

    const handleQuestionnaireSubmit = async (answers) => {
        try {
            const response = await fetch('http://localhost:5000/api/profile/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id || 'user123',
                    ...answers
                })
            });

            const data = await response.json();

            if (data.success) {
                setQuestionnaireData(answers);
                setShowQuestionnaire(false);
            }
        } catch (error) {
            console.error('Error submitting questionnaire:', error);
        }
    };

    const fetchFriends = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/friends/list?user_id=${user?.id || 'user123'}`);
            const data = await response.json();

            if (data.success) {
                setFriends(data.friends);
            }
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/friends/pending?user_id=${user?.id || 'user123'}`);
            const data = await response.json();

            if (data.success) {
                setPendingRequests(data.requests);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
    };

    const sendFriendRequest = async () => {
        if (!friendEmail.trim()) {
            alert('Please enter an email address');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_user_id: user?.id || 'user123',
                    from_email: user?.primaryEmailAddress?.emailAddress || 'user@example.com',
                    from_name: user?.fullName || 'User',
                    to_email: friendEmail
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Friend request sent!');
                setFriendEmail('');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
            alert('Failed to send friend request');
        }
    };

    const acceptFriendRequest = async (requestId) => {
        try {
            const response = await fetch('http://localhost:5000/api/friends/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: requestId,
                    user_id: user?.id || 'user123'
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchFriends();
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error accepting request:', error);
        }
    };

    if (showQuestionnaire) {
        return <Questionnaire onComplete={handleQuestionnaireSubmit} />;
    }

    return (
        <div className="profile-container">
            <div className="profile-tabs">
                <button
                    className={`profile-tab ${activeSubTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('profile')}
                >
                    My Profile
                </button>
                <button
                    className={`profile-tab ${activeSubTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('friends')}
                >
                    Friends
                </button>
            </div>

            {activeSubTab === 'profile' && (
                <div className="profile-content">
                    <div className="profile-card">
                        <div className="profile-header-section">
                            <div className="profile-avatar">
                                {user?.imageUrl ? (
                                    <img src={user.imageUrl} alt="Profile" className="avatar-img" />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {user?.firstName?.charAt(0) || 'U'}
                                    </div>
                                )}
                            </div>
                            <div className="profile-info">
                                <h2>{user?.fullName || 'User Name'}</h2>
                                <p className="profile-email">{user?.primaryEmailAddress?.emailAddress || 'email@example.com'}</p>
                                <p className="profile-joined">Member since {new Date(user?.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    {questionnaireData && (
                        <div className="questionnaire-results">
                            <h3>Your Study Profile</h3>
                            <div className="results-grid">
                                <div className="result-item-profile">
                                    <span className="result-label">Learning Style:</span>
                                    <span className="result-value">{questionnaireData.learningStyle}</span>
                                </div>
                                <div className="result-item-profile">
                                    <span className="result-label">Study Environment:</span>
                                    <span className="result-value">{questionnaireData.studyEnvironment}</span>
                                </div>
                                <div className="result-item-profile">
                                    <span className="result-label">Preferred Time:</span>
                                    <span className="result-value">{questionnaireData.preferredTime}</span>
                                </div>
                                <div className="result-item-profile">
                                    <span className="result-label">Study Duration:</span>
                                    <span className="result-value">{questionnaireData.studyDuration}</span>
                                </div>
                                <div className="result-item-profile">
                                    <span className="result-label">Main Goal:</span>
                                    <span className="result-value">{questionnaireData.mainGoal}</span>
                                </div>
                                <div className="result-item-profile">
                                    <span className="result-label">Biggest Challenge:</span>
                                    <span className="result-value">{questionnaireData.biggestChallenge}</span>
                                </div>
                            </div>
                            <button
                                className="retake-btn"
                                onClick={() => setShowQuestionnaire(true)}
                            >
                                Retake Questionnaire
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === 'friends' && (
                <div className="friends-content">
                    <div className="add-friend-section">
                        <h3>Add a Friend</h3>
                        <div className="add-friend-form">
                            <input
                                type="email"
                                placeholder="Enter friend's email address"
                                value={friendEmail}
                                onChange={(e) => setFriendEmail(e.target.value)}
                                className="friend-email-input"
                            />
                            <button
                                className="send-request-btn"
                                onClick={sendFriendRequest}
                            >
                                Send Request
                            </button>
                        </div>
                    </div>

                    {pendingRequests.length > 0 && (
                        <div className="pending-requests-section">
                            <h3>Friend Requests</h3>
                            {pendingRequests.map(request => (
                                <div key={request.id} className="request-card">
                                    <div className="request-info">
                                        <strong>{request.from_name}</strong>
                                        <span className="request-email">{request.from_email}</span>
                                    </div>
                                    <button
                                        className="accept-btn"
                                        onClick={() => acceptFriendRequest(request.id)}
                                    >
                                        Accept
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="friends-list-section">
                        <h3>My Friends ({friends.length})</h3>
                        {friends.length === 0 ? (
                            <p className="no-friends">No friends yet. Add some above!</p>
                        ) : (
                            <div className="friends-grid">
                                {friends.map(friend => (
                                    <FriendCard key={friend.friend_id} friend={friend} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function Questionnaire({ onComplete }) {
    const [answers, setAnswers] = useState({
        learningStyle: '',
        studyEnvironment: '',
        preferredTime: '',
        studyDuration: '',
        mainGoal: '',
        biggestChallenge: ''
    });

    const handleSubmit = () => {
        if (Object.values(answers).some(v => !v)) {
            alert('Please answer all questions');
            return;
        }
        onComplete(answers);
    };

    return (
        <div className="questionnaire-container">
            <h2>Welcome to FocusMate!</h2>
            <p className="questionnaire-subtitle">Help us personalize your study experience</p>

            <div className="questionnaire-form">
                <div className="question-group">
                    <label>What's your learning style?</label>
                    <div className="options-grid">
                        {['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.learningStyle === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, learningStyle: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="question-group">
                    <label>Preferred study environment?</label>
                    <div className="options-grid">
                        {['Quiet room', 'Library', 'Coffee shop', 'With music'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.studyEnvironment === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, studyEnvironment: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="question-group">
                    <label>When do you study best?</label>
                    <div className="options-grid">
                        {['Early morning', 'Afternoon', 'Evening', 'Late night'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.preferredTime === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, preferredTime: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="question-group">
                    <label>Ideal study session length?</label>
                    <div className="options-grid">
                        {['15-30 minutes', '30-60 minutes', '1-2 hours', '2+ hours'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.studyDuration === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, studyDuration: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="question-group">
                    <label>What's your main goal?</label>
                    <div className="options-grid">
                        {['Better grades', 'Exam preparation', 'Learn new skills', 'Stay organized'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.mainGoal === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, mainGoal: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="question-group">
                    <label>Biggest study challenge?</label>
                    <div className="options-grid">
                        {['Staying focused', 'Time management', 'Understanding material', 'Motivation'].map(option => (
                            <button
                                key={option}
                                className={`option-btn ${answers.biggestChallenge === option ? 'selected' : ''}`}
                                onClick={() => setAnswers({...answers, biggestChallenge: option})}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <button className="submit-questionnaire-btn" onClick={handleSubmit}>
                    Complete Setup
                </button>
            </div>
        </div>
    );
}

function FriendCard({ friend }) {
    return (
        <div className="friend-card">
            <div className="friend-avatar">
                {friend.name?.charAt(0) || 'F'}
            </div>
            <div className="friend-info-section">
                <h4>{friend.name}</h4>
                <div className="friend-stats">
                    <div className="stat">
                        <span className="stat-label">Top Subject:</span>
                        <span className="stat-value">{friend.stats?.top_subject || 'N/A'}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Study Time:</span>
                        <span className="stat-value">{friend.stats?.total_hours || 0}h</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Avg Focus:</span>
                        <span className="stat-value">{friend.stats?.avg_focus || 0}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
