import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../services/firebase';
import { signInWithCustomToken } from 'firebase/auth';

const ExternalAuth = () => {
    const { isRTL } = useLanguage();
    const [status, setStatus] = useState('Processing authentication...');

    useEffect(() => {
        const handleAuth = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const returnUrl = urlParams.get('returnUrl') || '/';

            if (token) {
                try {
                    await signInWithCustomToken(auth, token);
                    window.location.href = returnUrl;
                } catch (error) {
                    console.error('External auth error:', error);
                    setStatus('Authentication failed. Please try again.');
                }
            } else {
                setStatus('Invalid authentication request.');
            }
        };

        handleAuth();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 px-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <i className="fas fa-shield-alt text-5xl text-[#FFC90E]"></i>
            </div>
            <h1 className="text-3xl font-black text-white mb-4">Authentication</h1>
            <p className="text-gray-400 font-medium mb-8">{status}</p>
            <button 
                onClick={() => window.location.href = '/'} 
                className="px-6 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors"
            >
                {isRTL ? 'العودة للرئيسية' : 'Return Home'}
            </button>
        </div>
    );
};

export default ExternalAuth;
