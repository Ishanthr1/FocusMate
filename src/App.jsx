import { useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import './App.css';

/**
 * FocusMate main application component with Clerk authentication.
 *
 * Displays a looping background video, a transparent overlay,
 * and a hero card with a 3D tilt effect on mouse movement.
 *
 * @component
 * @returns {JSX.Element} The rendered FocusMate app.
 */
function App() {
    const { user } = useUser();

    useEffect(() => {
        /**
         * Slow down the background video playback speed.
         */
        const video = document.querySelector('.background-video');
        if (video) video.playbackRate = 0.5;

        /**
         * Adds a 3D tilt and parallax effect to the hero card.
         */
        const card = document.querySelector('.hero-card');
        if (card) {
            const sensitivity = 5; // degrees of tilt
            const depth = 15; // pixel translation depth

            /**
             * Handles mouse movement across the hero card,
             * applying 3D rotation and translation effects.
             *
             * @param {MouseEvent} e - The mouse movement event.
             */
            const handleMouseMove = (e) => {
                const { left, top, width, height } = card.getBoundingClientRect();
                const x = e.clientX - left;
                const y = e.clientY - top;

                // Normalize values between -0.5 and 0.5
                const normalizeX = (x / width) - 0.5;
                const normalizeY = (y / height) - 0.5;

                // Calculate transformations
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

            /**
             * Resets the card transformation when the mouse leaves.
             */
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

            // Add event listeners for the 3D tilt effect
            card.addEventListener('mousemove', handleMouseMove);
            card.addEventListener('mouseleave', handleMouseLeave);

            // Cleanup when component unmounts
            return () => {
                card.removeEventListener('mousemove', handleMouseMove);
                card.removeEventListener('mouseleave', handleMouseLeave);
            };
        }
    }, []);

    return (
        <div className="app">
            {/* User Button in top-right corner when signed in */}
            <SignedIn>
                <div className="user-menu">
                    <UserButton afterSignOutUrl="/" />
                </div>
            </SignedIn>

            {/* Background Video */}
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

            {/* Transparent overlay */}
            <div className="video-overlay"></div>

            {/* Main Content */}
            <div className="main-content">
                <div className="hero-card">
                    <div className="icon-circle">
                        <img src="/logo.png" alt="FocusMate Logo" className="logo-img" />
                    </div>

                    <h1>FocusMate</h1>
                    <p className="tagline">AI-Powered Study Assistant</p>

                    <p className="description">
                        Track your focus in real-time, get personalized quizzes from your notes,
                        and collaborate with study groups using intelligent analytics.
                    </p>

                    {/* Show different content based on sign-in status */}
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="cta-button">
                                Get Started
                            </button>
                        </SignInButton>
                    </SignedOut>

                    <SignedIn>
                        <p className="welcome-text">Welcome back, {user?.firstName}! </p>
                        <button className="cta-button" onClick={() => alert('Dashboard coming soon!')}>
                            Go to Dashboard
                        </button>
                    </SignedIn>
                </div>
            </div>
        </div>
    );
}

export default App;