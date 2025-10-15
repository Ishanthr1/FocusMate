import { useState, useEffect, useRef } from 'react';
import './QuizMaker.css';

function QuizMaker() {
    const [view, setView] = useState('setup');
    const [quizConfig, setQuizConfig] = useState({
        topic: '',
        questionCount: 5,
        quizType: 'Multiple Choice',
        difficulty: 'medium',
        documentText: null
    });
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [quizHistory, setQuizHistory] = useState([]);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchQuizHistory();
    }, []);

    const fetchQuizHistory = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/quiz/history?user_id=user123');
            const data = await response.json();

            if (data.success) {
                setQuizHistory(data.quizzes);
            }
        } catch (error) {
            console.error('Error fetching quiz history:', error);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/quiz/upload-document', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setQuizConfig(prev => ({
                    ...prev,
                    documentText: data.text,
                    topic: file.name
                }));
                alert('Document uploaded successfully!');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Failed to upload document');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!quizConfig.topic && !quizConfig.documentText) {
            alert('Please enter a topic or upload a document');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/quiz/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: 'user123',
                    topic: quizConfig.topic,
                    question_count: quizConfig.questionCount,
                    quiz_type: quizConfig.quizType,
                    difficulty: quizConfig.difficulty,
                    document_text: quizConfig.documentText
                })
            });

            const data = await response.json();

            if (data.success) {
                setCurrentQuiz(data.quiz);
                setView('taking');
                setCurrentQuestion(0);
                setUserAnswers({});
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            alert('Failed to generate quiz');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (questionIndex, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionIndex]: answer
        }));
    };

    const handleSubmitQuiz = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quiz_id: currentQuiz.quiz_id,
                    answers: userAnswers,
                    time_taken: 0
                })
            });

            const data = await response.json();

            if (data.success) {
                setResults(data);
                setView('results');
                fetchQuizHistory();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Failed to submit quiz');
        } finally {
            setLoading(false);
        }
    };

    const resetQuiz = () => {
        setView('setup');
        setCurrentQuiz(null);
        setCurrentQuestion(0);
        setUserAnswers({});
        setResults(null);
        setQuizConfig({
            topic: '',
            questionCount: 5,
            quizType: 'Multiple Choice',
            difficulty: 'medium',
            documentText: null
        });
    };

    if (view === 'setup') {
        return (
            <div className="quiz-maker-container">
                <div className="quiz-setup">
                    <h2>Create Your Practice Quiz</h2>
                    <p className="quiz-subtitle">Customize your quiz to match your learning needs</p>

                    <div className="setup-form">
                        <div className="form-group-quiz">
                            <label>Quiz Topic *</label>
                            <input
                                type="text"
                                className="topic-input"
                                placeholder="e.g., World War 2, Calculus, Photosynthesis"
                                value={quizConfig.topic}
                                onChange={(e) => setQuizConfig(prev => ({ ...prev, topic: e.target.value }))}
                            />
                        </div>

                        <div className="form-group-quiz">
                            <label>Or Upload Document</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".txt,.pdf,.docx"
                                style={{ display: 'none' }}
                            />
                            <button
                                className="upload-doc-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Upload Study Material
                            </button>
                            {quizConfig.documentText && (
                                <span className="doc-uploaded">Document uploaded</span>
                            )}
                        </div>

                        <div className="form-group-quiz">
                            <label>Number of Questions</label>
                            <div className="question-count-btns">
                                {[5, 10, 15, 20].map(count => (
                                    <button
                                        key={count}
                                        className={`count-btn ${quizConfig.questionCount === count ? 'active' : ''}`}
                                        onClick={() => setQuizConfig(prev => ({ ...prev, questionCount: count }))}
                                    >
                                        {count}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group-quiz">
                            <label>Question Type</label>
                            <div className="quiz-type-grid">
                                {['Multiple Choice', 'True/False', 'Short Answer', 'Fill in the Blank'].map(type => (
                                    <button
                                        key={type}
                                        className={`type-btn ${quizConfig.quizType === type ? 'active' : ''}`}
                                        onClick={() => setQuizConfig(prev => ({ ...prev, quizType: type }))}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group-quiz">
                            <label>Difficulty Level</label>
                            <div className="difficulty-btns">
                                {['easy', 'medium', 'hard'].map(level => (
                                    <button
                                        key={level}
                                        className={`diff-btn ${quizConfig.difficulty === level ? 'active' : ''}`}
                                        onClick={() => setQuizConfig(prev => ({ ...prev, difficulty: level }))}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            className="generate-quiz-btn"
                            onClick={handleGenerateQuiz}
                            disabled={loading}
                        >
                            {loading ? 'Generating...' : 'Generate Quiz'}
                        </button>
                    </div>

                    {quizHistory.length > 0 && (
                        <div className="quiz-history-section">
                            <h3>Recent Quizzes</h3>
                            <div className="history-list">
                                {quizHistory.slice(0, 5).map(quiz => (
                                    <div key={quiz.quiz_id} className="history-item">
                                        <div>
                                            <strong>{quiz.topic}</strong>
                                            <span className="history-meta">
                                                {quiz.quiz_type} • {quiz.question_count} questions
                                            </span>
                                        </div>
                                        {quiz.completed && (
                                            <span className="history-score">{quiz.last_score}%</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (view === 'taking' && currentQuiz) {
        const question = currentQuiz.questions[currentQuestion];
        const progress = ((currentQuestion + 1) / currentQuiz.questions.length) * 100;

        return (
            <div className="quiz-taking-container">
                <div className="quiz-header-bar">
                    <div className="quiz-progress-info">
                        <span className="question-number">Question {currentQuestion + 1}/{currentQuiz.questions.length}</span>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="question-container">
                    <h3 className="question-text">{question.question}</h3>

                    <div className="answer-section">
                        {currentQuiz.quiz_type === 'Multiple Choice' && (
                            <div className="mcq-options">
                                {question.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        className={`mcq-option ${userAnswers[currentQuestion] === option.charAt(0) ? 'selected' : ''}`}
                                        onClick={() => handleAnswerSelect(currentQuestion, option.charAt(0))}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {currentQuiz.quiz_type === 'True/False' && (
                            <div className="tf-options">
                                {question.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        className={`tf-option ${userAnswers[currentQuestion] === option ? 'selected' : ''}`}
                                        onClick={() => handleAnswerSelect(currentQuestion, option)}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {(currentQuiz.quiz_type === 'Short Answer' || currentQuiz.quiz_type === 'Fill in the Blank') && (
                            <textarea
                                className="text-answer-input"
                                placeholder="Type your answer here..."
                                value={userAnswers[currentQuestion] || ''}
                                onChange={(e) => handleAnswerSelect(currentQuestion, e.target.value)}
                                rows={4}
                            />
                        )}
                    </div>

                    <div className="quiz-navigation">
                        <button
                            className="nav-btn prev"
                            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestion === 0}
                        >
                            Previous
                        </button>

                        {currentQuestion === currentQuiz.questions.length - 1 ? (
                            <button
                                className="submit-quiz-btn"
                                onClick={handleSubmitQuiz}
                                disabled={loading}
                            >
                                Submit Quiz
                            </button>
                        ) : (
                            <button
                                className="nav-btn next"
                                onClick={() => setCurrentQuestion(prev => prev + 1)}
                            >
                                Next
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'results' && results) {
        return (
            <div className="quiz-results-container">
                <div className="results-header">
                    <h2>Quiz Complete!</h2>
                    <div className="score-display">
                        <div className="score-circle">
                            <span className="score-percentage">{results.percentage}%</span>
                        </div>
                        <p className="score-text">You got {results.score} out of {results.total} questions correct</p>
                    </div>
                </div>

                <div className="results-breakdown">
                    <h3>Question Review</h3>
                    {results.detailed_results.map((result, idx) => (
                        <div key={idx} className={`result-item ${result.is_correct ? 'correct' : 'incorrect'}`}>
                            <div className="result-header-row">
                                <span className="result-number">Question {result.question_number}</span>
                                <span className={`result-status ${result.is_correct ? 'correct' : 'incorrect'}`}>
                                    {result.is_correct ? 'Correct' : 'Incorrect'}
                                </span>
                            </div>

                            <div className="result-details">
                                <div className="answer-comparison">
                                    <div>
                                        <strong>Your Answer:</strong>
                                        <span className="answer-text">{result.user_answer || 'No answer'}</span>
                                    </div>
                                    {!result.is_correct && (
                                        <div>
                                            <strong>Correct Answer:</strong>
                                            <span className="answer-text correct">{result.correct_answer}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="explanation">
                                    <strong>Explanation:</strong>
                                    <p>{result.explanation}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="new-quiz-btn" onClick={resetQuiz}>
                    Create New Quiz
                </button>
            </div>
        );
    }

    return null;
}

export default QuizMaker;
