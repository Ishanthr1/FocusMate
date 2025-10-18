import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { io } from 'socket.io-client';
import './StudyGroups.css';
import API_URL from './config';

const socket = io(API_URL);

function StudyGroups() {
    const { user } = useUser();
    const [view, setView] = useState('list');
    const [rooms, setRooms] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');

    const [roomForm, setRoomForm] = useState({
        roomName: '',
        subject: '',
        duration: 60,
        maxParticipants: 5,
        privacy: 'friends'
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (currentRoom) {
            socket.emit('join_study_room', {
                room_id: currentRoom.room_id,
                user_id: user?.id || 'user123',
                name: user?.fullName || 'User'
            });

            socket.on('user_joined', (data) => {
                console.log('User joined:', data);
            });

            socket.on('user_left', (data) => {
                console.log('User left:', data);
            });

            socket.on('new_room_chat', (data) => {
                setChatMessages(prev => [...prev, data]);
            });

            return () => {
                socket.off('user_joined');
                socket.off('user_left');
                socket.off('new_room_chat');
            };
        }
    }, [currentRoom]);

    const fetchRooms = async () => {
        try {
            const response = await fetch(`${API_URL}/api/study-groups/list?user_id=${user?.id || 'user123'}`);
            const data = await response.json();

            if (data.success) {
                setRooms(data.rooms);
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const createRoom = async () => {
        if (!roomForm.roomName || !roomForm.subject) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/study-groups/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id || 'user123',
                    user_name: user?.fullName || 'User',
                    ...roomForm
                })
            });

            const data = await response.json();

            if (data.success) {
                setCurrentRoom(data.room);
                setShowCreateModal(false);
                setView('active');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room');
        }
    };

    const joinRoom = async (room) => {
        try {
            const response = await fetch(`${API_URL}/api/study-groups/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_id: room.room_id,
                    user_id: user?.id || 'user123',
                    user_name: user?.fullName || 'User'
                })
            });

            const data = await response.json();

            if (data.success) {
                setCurrentRoom(data.room);
                setView('active');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room');
        }
    };

    const leaveRoom = async () => {
        if (!currentRoom) return;

        try {
            await fetch(`${API_URL}/api/study-groups/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_id: currentRoom.room_id,
                    user_id: user?.id || 'user123'
                })
            });

            socket.emit('leave_study_room', {
                room_id: currentRoom.room_id,
                user_id: user?.id || 'user123'
            });

            setCurrentRoom(null);
            setView('list');
            setChatMessages([]);
            fetchRooms();
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    };

    const sendChatMessage = () => {
        if (!chatInput.trim()) return;

        socket.emit('send_room_chat', {
            room_id: currentRoom.room_id,
            user_id: user?.id || 'user123',
            name: user?.fullName || 'User',
            message: chatInput
        });

        setChatInput('');
    };

    if (view === 'list') {
        return (
            <div className="study-groups-container">
                <div className="study-groups-header">
                    <h2>Study Groups</h2>
                    <button
                        className="create-room-btn"
                        onClick={() => setShowCreateModal(true)}
                    >
                        + Create New Room
                    </button>
                </div>

                <div className="rooms-grid">
                    {rooms.length === 0 ? (
                        <div className="no-rooms">
                            <p>No active study rooms</p>
                            <p>Create one to start studying with friends!</p>
                        </div>
                    ) : (
                        rooms.map(room => (
                            <div key={room.room_id} className="room-card">
                                <div className="room-header-info">
                                    <h3>{room.room_name}</h3>
                                    <span className={`subject-badge ${room.subject}`}>
                                        {room.subject}
                                    </span>
                                </div>
                                <div className="room-details">
                                    <div className="room-detail-item">
                                        <span className="detail-icon">👤</span>
                                        <span>Host: {room.host_name}</span>
                                    </div>
                                    <div className="room-detail-item">
                                        <span className="detail-icon">👥</span>
                                        <span>{room.participants.length}/{room.max_participants} participants</span>
                                    </div>
                                    <div className="room-detail-item">
                                        <span className="detail-icon">⏱️</span>
                                        <span>{room.duration} minutes</span>
                                    </div>
                                </div>
                                <button
                                    className="join-room-btn"
                                    onClick={() => joinRoom(room)}
                                    disabled={room.participants.length >= room.max_participants}
                                >
                                    {room.participants.length >= room.max_participants ? 'Full' : 'Join Room'}
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {showCreateModal && (
                    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                        <div className="create-room-modal" onClick={e => e.stopPropagation()}>
                            <h3>Create Study Room</h3>

                            <div className="form-group-modal">
                                <label>Room Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Calculus Study Session"
                                    value={roomForm.roomName}
                                    onChange={e => setRoomForm({...roomForm, roomName: e.target.value})}
                                />
                            </div>

                            <div className="form-group-modal">
                                <label>Subject *</label>
                                <select
                                    value={roomForm.subject}
                                    onChange={e => setRoomForm({...roomForm, subject: e.target.value})}
                                >
                                    <option value="">Select subject</option>
                                    <option value="mathematics">Mathematics</option>
                                    <option value="science">Science</option>
                                    <option value="history">History</option>
                                    <option value="language">Language Arts</option>
                                    <option value="computer-science">Computer Science</option>
                                    <option value="business">Business</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="form-group-modal">
                                <label>Duration (minutes)</label>
                                <select
                                    value={roomForm.duration}
                                    onChange={e => setRoomForm({...roomForm, duration: parseInt(e.target.value)})}
                                >
                                    <option value={30}>30 minutes</option>
                                    <option value={60}>1 hour</option>
                                    <option value={90}>1.5 hours</option>
                                    <option value={120}>2 hours</option>
                                </select>
                            </div>

                            <div className="form-group-modal">
                                <label>Max Participants</label>
                                <select
                                    value={roomForm.maxParticipants}
                                    onChange={e => setRoomForm({...roomForm, maxParticipants: parseInt(e.target.value)})}
                                >
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                    <option value={5}>5</option>
                                    <option value={8}>8</option>
                                </select>
                            </div>

                            <div className="form-group-modal">
                                <label>Privacy</label>
                                <select
                                    value={roomForm.privacy}
                                    onChange={e => setRoomForm({...roomForm, privacy: e.target.value})}
                                >
                                    <option value="friends">Friends Only</option>
                                    <option value="public">Public</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button
                                    className="cancel-btn"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="create-btn"
                                    onClick={createRoom}
                                >
                                    Create Room
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'active') {
        return (
            <div className="active-room-container">
                <div className="room-header-bar">
                    <div className="room-info-top">
                        <h3>{currentRoom?.room_name}</h3>
                        <span className="participants-count">
                            {currentRoom?.participants.length}/{currentRoom?.max_participants} participants
                        </span>
                    </div>
                    <button className="leave-room-btn" onClick={leaveRoom}>
                        Leave Room
                    </button>
                </div>

                <div className="room-content">
                    <div className="jitsi-container">
                        <JitsiMeeting
                            domain="meet.jit.si"
                            roomName={`FocusMate-${currentRoom?.room_id}`}
                            configOverwrite={{
                                startWithAudioMuted: true,
                                disableModeratorIndicator: true,
                                startScreenSharing: false,
                                enableEmailInStats: false
                            }}
                            interfaceConfigOverwrite={{
                                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
                            }}
                            userInfo={{
                                displayName: user?.fullName || 'User'
                            }}
                            onApiReady={(externalApi) => {
                                console.log('Jitsi Meet API ready');
                            }}
                            getIFrameRef={(iframeRef) => {
                                iframeRef.style.height = '100%';
                            }}
                        />
                    </div>

                    <div className="chat-sidebar-room">
                        <h4>Group Chat</h4>
                        <div className="chat-messages-room">
                            {chatMessages.map((msg, idx) => (
                                <div key={idx} className="chat-message-room">
                                    <div className="message-header">
                                        <strong>{msg.name}</strong>
                                        <span className="message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p>{msg.message}</p>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input-area">
                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                            />
                            <button onClick={sendChatMessage}>Send</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default StudyGroups;