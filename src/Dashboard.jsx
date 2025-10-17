import { useUser, UserButton } from '@clerk/clerk-react';
import { useState } from 'react';
import StudySession from './StudySession';
import Analytics from './Analytics';
import AIAssistant from './AIAssistant';
import QuizMaker from './QuizMaker';
import Profile from './Profile';
import StudyGroups from './StudyGroups';
import './Dashboard.css';

function Dashboard() {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState('study');
    const [showStudySession, setShowStudySession] = useState(false);

    if (showStudySession && activeTab === 'study') {
        return (
            <StudySession
                onBack={() => setShowStudySession(false)}
                onNavigateToNotes={() => {
                    setShowStudySession(false);
                    setActiveTab('notes');
                }}
            />
        );
    }

    return (
        <div className="dashboard">
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
                    {activeTab === 'analytics' && <Analytics />}

                    {activeTab === 'notes' && <AIAssistant />}

                    {activeTab === 'quiz' && <QuizMaker />}

                    {activeTab === 'profile' && <Profile />}

                    {activeTab === 'group' && <StudyGroups />}

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
                </div>
            </main>
        </div>
    );
}

export default Dashboard;