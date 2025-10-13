import { useUser, UserButton } from '@clerk/clerk-react';
import { useState } from 'react';
import StudySession from './StudySession';
import Analytics from './Analytics';
import AIAssistant from './AIAssistant';  // Add this import
import './Dashboard.css';

function Dashboard() {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState('study');
    const [showStudySession, setShowStudySession] = useState(false);

    // If study session is active, show it full screen
    if (showStudySession && activeTab === 'study') {
        return <StudySession onBack={() => setShowStudySession(false)} />;
    }

    return (
        <div className="dashboard">
            {/* Sidebar - same as before */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/logo.png" alt="FocusMate" className="sidebar-logo" />
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${activeTab === 'study' ? 'active' : ''}`}
                        onClick={() => setActiveTab('study')}
                    >
                        <span className="nav-text">Focus Session</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notes')}
                    >
                        <span className="nav-text">My Notes</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'quiz' ? 'active' : ''}`}
                        onClick={() => setActiveTab('quiz')}
                    >
                        <span className="nav-text">Practice Quizzes</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'group' ? 'active' : ''}`}
                        onClick={() => setActiveTab('group')}
                    >
                        <span className="nav-text">Study Groups</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <span className="nav-text">Analytics</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button
                        className={`nav-item profile-item ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <UserButton afterSignOutUrl="/" />
                        <span className="nav-text">Profile</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content-dashboard">
                <header className="dashboard-header">
                    <div className="welcome-section">
                        <h1 className="welcome-title">Welcome back, {user?.firstName}!</h1>
                        <p className="welcome-subtitle">
                            Let's make today productive. Track your focus, build better study habits, and achieve your learning goals.
                        </p>
                    </div>
                </header>

                <div className="dashboard-content">
                    {/* Analytics Tab Content */}
                    {activeTab === 'analytics' && <Analytics />}

                    {/* My Notes (AI Assistant) Tab Content */}
                    {activeTab === 'notes' && <AIAssistant />}

                    {/* Focus Session Tab Content */}
                    {activeTab === 'study' && (
                        <div className="content-card">
                            <div className="coming-soon">
                                <h2>Ready to Focus?</h2>
                                <p className="feature-description">
                                    Start a focus session with AI-powered tracking to improve your study habits and productivity.
                                </p>

                                <button
                                    className="start-study-btn"
                                    onClick={() => setShowStudySession(true)}
                                >
                                    Start Focus Session
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Other Tabs - Coming Soon */}
                    {(activeTab === 'quiz' || activeTab === 'group' || activeTab === 'profile') && (
                        <div className="content-card">
                            <div className="coming-soon">
                                <h2>Coming Soon!</h2>
                                <p className="feature-description">
                                    The {activeTab === 'quiz' ? 'Practice Quizzes' :
                                        activeTab === 'group' ? 'Study Groups' :
                                        'Profile'} feature is currently under development and will be available soon.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;