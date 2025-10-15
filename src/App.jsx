import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import Dashboard from './Dashboard';
import './App.css';

function HomePage() {
    const { isSignedIn } = useUser();

    useEffect(() => {
        const video = document.querySelector('.background-video');
        if (video) video.playbackRate = 0.5;

        const card = document.querySelector('.hero-card');
        if (card) {
            const sensitivity = 5;
            const depth = 15;

            const handleMouseMove = (e) => {
                const { left, top, width, height } = card.getBoundingClientRect();
                const x = e.clientX - left;
                const y = e.clientY - top;

                const normalizeX = (x / width) - 0.5;
                const normalizeY = (y / height) - 0.5;

                const rotateX = -normalizeY * sensitivity;
                const rotateY = normalizeX * sensitivity;
                const translateX = normalizeX * depth;
                const translateY = normalizeY * depth;

                card.style.transform = `
                    perspective(800px)
                    scale(1.05)
                    rotateX(${rotateX}deg)
                    rotateY(${rotateY}deg)
                    translateX(${translateX}px)
                    translateY(${translateY}px)
                `;
                card.style.transition = 'transform 0.1s ease-out';
            };

            const handleMouseLeave = () => {
                card.style.transform = `
                    perspective(800px)
                    scale(1)
                    rotateX(0deg)
                    rotateY(0deg)
                    translateX(0)
                    translateY(0)
                `;
                card.style.transition = 'transform 0.4s ease';
            };

            card.addEventListener('mousemove', handleMouseMove);
            card.addEventListener('mouseleave', handleMouseLeave);

            return () => {
                card.removeEventListener('mousemove', handleMouseMove);
                card.removeEventListener('mouseleave', handleMouseLeave);
            };
        }
    }, []);

    if (isSignedIn) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="app">
            <video
                autoPlay
                loop
                muted
                playsInline
                className="background-video"
            >
                <source src="/background.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            <div className="video-overlay"></div>

            <div className="main-content">
                <div className="hero-card">
                    <img src="/logo.png" alt="FocusMate Logo" className="logo-img" />

                    <p className="tagline">AI-Powered Study Assistant</p>

                    <p className="description">
                        Track your focus in real-time, get personalized quizzes from your notes,
                        and collaborate with study groups using intelligent analytics.
                    </p>

                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="cta-button">
                                Get Started
                            </button>
                        </SignInButton>
                    </SignedOut>
                </div>
            </div>
        </div>
    );
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
                path="/dashboard"
                element={
                    <SignedIn>
                        <Dashboard />
                    </SignedIn>
                }
            />
        </Routes>
    );
}

export default App;