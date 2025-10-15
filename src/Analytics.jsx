import { useState, useEffect } from 'react';
import './Analytics.css';

function Analytics() {
    const [sessions, setSessions] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSessions: 0,
        totalStudyTime: 0,
        averageFocusScore: 0,
        mostStudiedSubject: '',
        totalBreaks: 0
    });

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (sessions.length > 0) {
            calculateStats();
        }
    }, [sessions, selectedPeriod]);

    const fetchSessions = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/sessions/all');
            const data = await response.json();

            if (data.success) {
                setSessions(data.sessions);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching sessions:', error);
            setLoading(false);
        }
    };

    const calculateStats = () => {
        const filteredSessions = getFilteredSessions();

        if (filteredSessions.length === 0) {
            setStats({
                totalSessions: 0,
                totalStudyTime: 0,
                averageFocusScore: 0,
                mostStudiedSubject: '',
                totalBreaks: 0
            });
            return;
        }

        const totalTime = filteredSessions.reduce((sum, s) => sum + s.duration_actual, 0);
        const avgScore = filteredSessions.reduce((sum, s) => sum + s.focus_score, 0) / filteredSessions.length;

        const subjects = {};
        filteredSessions.forEach(s => {
            subjects[s.subject] = (subjects[s.subject] || 0) + 1;
        });
        const mostStudied = Object.keys(subjects).reduce((a, b) => subjects[a] > subjects[b] ? a : b, '');

        const totalBreaks = filteredSessions.reduce((sum, s) => sum + s.breaks.length, 0);

        setStats({
            totalSessions: filteredSessions.length,
            totalStudyTime: Math.round(totalTime),
            averageFocusScore: Math.round(avgScore),
            mostStudiedSubject: mostStudied,
            totalBreaks: totalBreaks
        });
    };

    const getFilteredSessions = () => {
        const now = new Date();

        return sessions.filter(session => {
            const sessionDate = new Date(session.start_time);

            switch (selectedPeriod) {
                case 'today':
                    return sessionDate.toDateString() === now.toDateString();
                case 'week':
                    { const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return sessionDate >= weekAgo; }
                case 'month':
                    { const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return sessionDate >= monthAgo; }
                default:
                    return true;
            }
        });
    };

    const downloadSingleReport = async (sessionId) => {
        try {
            const response = await fetch(`http://localhost:5000/api/report/single/${sessionId}`);
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FocusMate_Session_${sessionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading report:', error);
            alert('Error downloading report. Please try again.');
        }
    };

    const downloadCombinedReport = async (period) => {
        try {
            const response = await fetch(`http://localhost:5000/api/report/combined/${period}`);
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FocusMate_${period}_Report.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading combined report:', error);
            alert('Error downloading report. Please try again.');
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    if (loading) {
        return (
            <div className="analytics-inner">
                <div className="loading">Loading analytics...</div>
            </div>
        );
    }

    const filteredSessions = getFilteredSessions();

    return (
        <div className="analytics-inner">
            <div className="analytics-top-bar">
                <h2 className="analytics-title">Study Analytics</h2>
                <div className="period-selector">
                    <button
                        className={`period-btn ${selectedPeriod === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedPeriod('all')}
                    >
                        All Time
                    </button>
                    <button
                        className={`period-btn ${selectedPeriod === 'today' ? 'active' : ''}`}
                        onClick={() => setSelectedPeriod('today')}
                    >
                        Today
                    </button>
                    <button
                        className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
                        onClick={() => setSelectedPeriod('week')}
                    >
                        Week
                    </button>
                    <button
                        className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
                        onClick={() => setSelectedPeriod('month')}
                    >
                        Month
                    </button>
                </div>
            </div>

            <div className="stats-grid-compact">
                <div className="stat-card-compact">
                    <div className="stat-icon-small"></div>
                    <div className="stat-info">
                        <div className="stat-value-small">{stats.totalSessions}</div>
                        <div className="stat-label-small">Sessions</div>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-small"></div>
                    <div className="stat-info">
                        <div className="stat-value-small">{formatDuration(stats.totalStudyTime)}</div>
                        <div className="stat-label-small">Study Time</div>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-small"></div>
                    <div className="stat-info">
                        <div className="stat-value-small">{stats.averageFocusScore}%</div>
                        <div className="stat-label-small">Avg Focus</div>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-small"></div>
                    <div className="stat-info">
                        <div className="stat-value-small">{stats.mostStudiedSubject || 'N/A'}</div>
                        <div className="stat-label-small">Top Subject</div>
                    </div>
                </div>
            </div>

            <div className="download-section-compact">
                <h3>Download Reports</h3>
                <div className="download-buttons-compact">
                    <button
                        className="download-btn-compact"
                        onClick={() => downloadCombinedReport('today')}
                    >
                        Today
                    </button>
                    <button
                        className="download-btn-compact"
                        onClick={() => downloadCombinedReport('week')}
                    >
                        Week
                    </button>
                    <button
                        className="download-btn-compact"
                        onClick={() => downloadCombinedReport('month')}
                    >
                        Month
                    </button>
                </div>
            </div>

            <div className="sessions-section-compact">
                <h3>Recent Sessions ({filteredSessions.length})</h3>

                {filteredSessions.length === 0 ? (
                    <div className="empty-state">
                        <p>No sessions found.</p>
                        <p>Start a focus session to see your analytics!</p>
                    </div>
                ) : (
                    <div className="sessions-list-compact">
                        {filteredSessions.slice(0, 10).map(session => (
                            <div key={session.session_id} className="session-card-compact">
                                <div className="session-compact-header">
                                    <div>
                                        <h4 className="session-subject-compact">{session.subject}</h4>
                                        <span className="session-date-compact">{formatDate(session.start_time)}</span>
                                    </div>
                                    <div className="score-badge" style={{
                                        background: session.focus_score >= 80 ? '#48bb78' :
                                                   session.focus_score >= 60 ? '#ed8936' : '#f56565'
                                    }}>
                                        {session.focus_score}%
                                    </div>
                                </div>

                                <div className="session-compact-details">
                                    <span className="detail-badge">{formatDuration(session.duration_actual)}</span>
                                    <span className="detail-badge">{session.study_mode}</span>
                                    <span className="detail-badge">{session.pauses.length / 2} pauses</span>
                                    {!session.completed && <span className="detail-badge warning">Ended Early</span>}
                                </div>

                                <button
                                    className="download-session-btn-compact"
                                    onClick={() => downloadSingleReport(session.session_id)}
                                >
                                    Download Report
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Analytics;
