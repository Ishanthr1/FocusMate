import { useState, useEffect, useRef } from 'react';
import './AIAssistant.css';

function AIAssistant() {
    const [chats, setChats] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchUserChats();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchUserChats = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/chat/all?user_id=user123');
            const data = await response.json();

            if (data.success) {
                setChats(data.chats);
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
        }
    };

    const createNewChat = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/chat/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'user123' })
            });

            const data = await response.json();

            if (data.success) {
                setCurrentChatId(data.chat_id);
                setMessages([]);
                fetchUserChats();
            }
        } catch (error) {
            console.error('Error creating chat:', error);
        }
    };

    const loadChat = async (chatId) => {
        try {
            const response = await fetch(`http://localhost:5000/api/chat/history/${chatId}`);
            const data = await response.json();

            if (data.success) {
                setCurrentChatId(chatId);
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result);
                setImagePreview(URL.createObjectURL(file));
            };
            reader.readAsDataURL(file);
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() && !selectedImage) return;
        if (!currentChatId) {
            await createNewChat();
            return;
        }

        const userMessage = inputMessage;
        const imageData = selectedImage;

        // Add user message to UI immediately
        setMessages(prev => [...prev, {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
            has_image: !!imageData
        }]);

        setInputMessage('');
        setSelectedImage(null);
        setImagePreview(null);
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: currentChatId,
                    message: userMessage,
                    image: imageData
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response,
                    timestamp: data.timestamp
                }]);

                fetchUserChats(); // Refresh chat list
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const deleteChat = async (chatId) => {
        if (!confirm('Delete this chat?')) return;

        try {
            await fetch(`http://localhost:5000/api/chat/delete/${chatId}`, {
                method: 'DELETE'
            });

            if (currentChatId === chatId) {
                setCurrentChatId(null);
                setMessages([]);
            }

            fetchUserChats();
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    };

    return (
        <div className="ai-assistant-container">
            {/* Chat Sidebar */}
            <div className="chat-sidebar">
                <button className="new-chat-btn" onClick={createNewChat}>
                    + New Chat
                </button>

                <div className="chat-list">
                    {chats.length === 0 ? (
                        <p className="no-chats">No chats yet</p>
                    ) : (
                        chats.map(chat => (
                            <div
                                key={chat.chat_id}
                                className={`chat-item ${currentChatId === chat.chat_id ? 'active' : ''}`}
                                onClick={() => loadChat(chat.chat_id)}
                            >
                                <div className="chat-item-content">
                                    <p className="chat-preview">{chat.last_message}</p>
                                    <span className="chat-count">{chat.message_count} messages</span>
                                </div>
                                <button
                                    className="delete-chat-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChat(chat.chat_id);
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="chat-main">
                {!currentChatId ? (
                    <div className="chat-welcome">
                        <h2>Welcome to FocusMate AI Assistant!</h2>
                        <p>I'm here to help you with your studies. Ask me anything about:</p>
                        <ul>
                            <li>📚 Understanding difficult concepts</li>
                            <li>✏️ Solving homework problems</li>
                            <li>📝 Writing and essay help</li>
                            <li>🧪 Science and math questions</li>
                            <li>📖 Study tips and strategies</li>
                        </ul>
                        <button className="start-chat-btn" onClick={createNewChat}>
                            Start a New Chat
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="messages-container">
                            {messages.map((msg, index) => (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        {msg.content}
                                    </div>
                                    <span className="message-time">
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                            {loading && (
                                <div className="message assistant">
                                    <div className="message-content typing">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="input-area">
                            {imagePreview && (
                                <div className="image-preview-container">
                                    <img src={imagePreview} alt="Preview" className="image-preview" />
                                    <button
                                        className="remove-image-btn"
                                        onClick={() => {
                                            setSelectedImage(null);
                                            setImagePreview(null);
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <div className="input-controls">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageSelect}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className="attach-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Upload image"
                                >
                                    📎
                                </button>

                                <textarea
                                    className="message-input"
                                    placeholder="Ask me anything about your studies..."
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    rows={1}
                                />

                                <button
                                    className="send-btn"
                                    onClick={sendMessage}
                                    disabled={loading || (!inputMessage.trim() && !selectedImage)}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default AIAssistant;