import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Monitor, Users, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TOTPVerification } from '../components/TOTPVerification'

const getBrowserLocation = async (): Promise<{ lat: number; lng: number; accuracy?: number } | null> => {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 120000 }
        );
    });
};

export const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mfaPending, setMfaPending] = useState<any>(null)
    const navigate = useNavigate()
    const { login, loading, error } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const response = await login({ email, password })
            console.log('Login response:', response)
            onLogin(response.user)
            navigate('/')
        } catch (err: any) {
            console.error('Login error:', err)
            if (err.message === 'MFA_REQUIRED') {
                // Récupérer les données MFA du localStorage
                const mfaData = localStorage.getItem('mfa_pending');
                console.log('MFA data from localStorage:', mfaData)
                if (mfaData) {
                    const parsed = JSON.parse(mfaData);
                    setMfaPending({ ...parsed, email });
                }
            } else {
                console.error('Erreur de connexion:', err)
            }
        }
    }

    const handleMfaSuccess = async (mfaToken: string) => {
        try {
            const location = await getBrowserLocation();
            // Appeler l'endpoint de vérification MFA
            const response = await fetch('/api/auth/mfa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: mfaPending.user_id,
                    token: mfaToken,
                    ...(location ? { location } : {})
                })
            });

            const data = await response.json();
            if (response.ok) {
                // Stocker les infos comme lors d'une connexion normale
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.removeItem('mfa_pending');

                onLogin(data.user);
                navigate('/');
            }
        } catch (err) {
            console.error('Erreur MFA:', err);
        }
    }

    // Afficher le formulaire MFA si nécessaire
    if (mfaPending) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
                <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-10 rounded-3xl shadow-2xl w-full max-w-md z-10 border border-white/50"
                >
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-3 bg-primary-600 rounded-2xl shadow-lg mb-4">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-heading font-extrabold text-gray-900 tracking-tight">Vérification</h1>
                        <p className="text-gray-500 mt-2">Authentification multi-facteurs requise</p>
                    </div>

                    <TOTPVerification
                        userId={mfaPending.user_id}
                        email={mfaPending.email}
                        onVerificationSuccess={handleMfaSuccess}
                        onVerificationFail={() => {
                            setMfaPending(null);
                            setEmail('');
                            setPassword('');
                        }}
                    />

                    <button
                        onClick={() => {
                            setMfaPending(null);
                            setEmail('');
                            setPassword('');
                        }}
                        className="w-full mt-6 text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                        Retour à la connexion
                    </button>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="bg-[#060b18] text-slate-200 font-sans min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 tactical-grid opacity-20"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#060b18_80%)]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-10 saturate-50 blur-xl">
                    <img 
                        className="w-full h-full object-cover" 
                        alt="Tactical Map" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA432KVvejSuT1bAnTZUGHtB_xwkVO5kZpiUqpqf_36Ye4V1aDSprGYpQw0dL4hii-Lg00CcEJEWzuC2AKqCW11LCf595qdxCb6PPRSDme6SbCCBXDs2ThqP9GTbLEUdl4ESqiyKOdnE3GNzpF54cM8zrZLZTBNxa1qyvy-F8-yRL73Z7ZKEQ2pVYBjMzOdWug9rnIjwkDPQqp470w8198Jedb4xrHZ6l7v5VAKDPdFjzhKb2wUf4ih1osJfI2JlOWtaz37bDEJygk" 
                    />
                </div>
            </div>

            {/* Top Navigation Anchor (Manual for Login) */}
            <header className="fixed top-0 w-full z-20 flex justify-between items-center px-8 py-4 bg-[#0a0f1d] border-b border-white/5">
                <div className="text-xl tracking-[0.15em] font-black text-white font-headline uppercase leading-none">
                    SENTINEL
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                    <span className="text-blue-400 font-bold tracking-tighter uppercase text-[10px]">SYSTEM STATUS: NOMINAL</span>
                </div>
            </header>

            {/* Main Content: Login Shell */}
            <main className="z-10 w-full max-w-md px-6">
                <div className="bg-[#0f172a] p-10 rounded-xl border border-white/5 relative overflow-hidden group shadow-2xl">
                    {/* Decorative corner accent */}
                    <div className="absolute top-0 right-0 w-12 h-12 border-t border-r border-blue-600/30 pointer-events-none"></div>
                    
                    <div className="mb-10 text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 mb-6 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                            <Monitor className="text-blue-500 w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter text-white uppercase mb-2">RESTRICTED ACCESS</h1>
                        <p className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">LEVEL 4 AUTHENTICATION REQUIRED</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold uppercase tracking-tight">
                                {error}
                            </div>
                        )}
                        
                        {/* Operator ID Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                                Operator ID
                                <span className="text-blue-500/40">ENTRY_01</span>
                            </label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 text-blue-500/40">
                                    <Users className="w-4 h-4" />
                                </div>
                                <input
                                    className="w-full pl-12 pr-4 py-4 bg-[#060b18] border-l-2 border-blue-600 focus:border-blue-400 focus:ring-0 text-white text-sm placeholder:text-slate-700 transition-all outline-none"
                                    placeholder="ENTER ID..."
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Access Key Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                                Access Key
                                <span className="text-blue-500/40">ENCRYPTED_RSA</span>
                            </label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 text-blue-500/40">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <input
                                    className="w-full pl-12 pr-4 py-4 bg-[#060b18] border-l-2 border-blue-600 focus:border-blue-400 focus:ring-0 text-white text-sm placeholder:text-slate-700 transition-all outline-none"
                                    placeholder="••••••••••••"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Secure Entry Button */}
                        <button
                            className="w-full py-4 bg-blue-600 text-white font-black tracking-[0.2em] uppercase text-xs hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                "SECURE ENTRY"
                            )}
                        </button>
                    </form>
                </div>

                {/* Terminal Status Output */}
                <div className="mt-6 bg-[#060b18] p-4 font-mono text-[9px] text-blue-500/40 space-y-1 border border-white/5 rounded-lg">
                    <p>&gt; INITIALIZING SECURITY PROTOCOL 0x882...</p>
                    <p>&gt; AWAITING OPERATOR INPUT_</p>
                    {loading && <p>&gt; PROCESSING AUTHENTICATION...</p>}
                </div>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 w-full flex justify-between items-center px-8 py-6 bg-[#060b18] border-t border-white/5 z-20">
                <div className="text-[9px] uppercase tracking-widest text-slate-600 font-black">
                    © 2026 SENTINEL // CLASSIFIED INFORMATION
                </div>
                <div className="flex gap-6">
                    <a className="text-[9px] uppercase tracking-widest text-slate-600 hover:text-blue-400 transition-colors" href="#">SECURITY</a>
                    <a className="text-[9px] uppercase tracking-widest text-slate-600 hover:text-blue-400 transition-colors" href="#">SUPPORT</a>
                </div>
            </footer>
        </div>
    )
}
