/**
 * Composant de vérification TOTP / Authentification Multifactorielle
 * Affiche l'interface de saisie du code OTP et codes de secours
 */

import React, { useState, useRef } from 'react';
import { Lock, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface TOTPVerificationProps {
  userId: string;
  email: string;
  onVerificationSuccess: (mfaToken: string) => void;
  onVerificationFail: (error: string) => void;
}

export const TOTPVerification: React.FC<TOTPVerificationProps> = ({
  userId,
  email,
  onVerificationSuccess,
  onVerificationFail
}) => {
  // États
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Formater le code TOTP en pseudo-temps réel
  const handleTotpChange = (value: string) => {
    // Accepter seulement 6 chiffres
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(cleaned);
    setError('');
  };

  // Formater le code de secours
  const handleBackupCodeChange = (value: string) => {
    const formatted = value.toUpperCase().slice(0, 14); // XXXX-XXXX-XXXX
    setBackupCode(formatted);
    setError('');
  };

  // Vérifier le code TOTP
  const verifyTotp = async () => {
    if (totpCode.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mfa/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          totp_code: totpCode
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onVerificationSuccess(totpCode);
        }, 1500);
      } else {
        setError(data.message || 'Code TOTP invalide');
      }
    } catch (err) {
      setError('Erreur de vérification du code');
      onVerificationFail('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Vérifier le code de secours
  const verifyBackupCode = async () => {
    if (!backupCode) {
      setError('Veuillez entrer un code de secours');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mfa/verify-backup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          backup_code: backupCode
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onVerificationSuccess(backupCode);
        }, 1500);
      } else {
        setError(data.message || 'Code de secours invalide');
      }
    } catch (err) {
      setError('Erreur de vérification du code');
      onVerificationFail('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Entrée spéciale pour TOTP avec mise à jour automatique
  const handleTotpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && totpCode.length === 6) {
      verifyTotp();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-blue-200"
    >
      {/* Header */}
      <div className="flex items-center justify-center mb-6">
        <div className="p-3 bg-blue-100 rounded-full">
          <Lock className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
        Authentification Multifactorielle
      </h2>
      <p className="text-center text-gray-600 text-sm mb-6">
        {email}
      </p>

      {/* Contenu principal */}
      {!success ? (
        <>
          {/* Onglets */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setUseBackupCode(false);
                setError('');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all ${
                !useBackupCode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Code Authenticator
            </button>
            <button
              onClick={() => {
                setUseBackupCode(true);
                setError('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all ${
                useBackupCode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Code de Secours
            </button>
          </div>

          {/* Panel TOTP */}
          {!useBackupCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code d'authentification à 6 chiffres
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Entrez le code de votre application Authenticator (Google Authenticator, Microsoft Authenticator, Authy, etc.)
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => handleTotpChange(e.target.value)}
                  onKeyDown={handleTotpKeyDown}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                />
                <div className="mt-2 text-xs text-gray-500">
                  Caractères saisis: {totpCode.length}/6
                </div>
              </div>
            </motion.div>
          )}

          {/* Panel Code de Secours */}
          {useBackupCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code de secours
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Entrez l'un de vos codes de secours au format XXXX-XXXX-XXXX
                </p>
                <input
                  type="text"
                  value={backupCode}
                  onChange={(e) => handleBackupCodeChange(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3 text-center font-mono uppercase border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </motion.div>
          )}

          {/* Affichage des erreurs */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </motion.div>
          )}

          {/* Bouton de vérification */}
          <button
            onClick={useBackupCode ? verifyBackupCode : verifyTotp}
            disabled={
              isLoading ||
              (useBackupCode ? !backupCode : totpCode.length !== 6)
            }
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              isLoading || (useBackupCode ? !backupCode : totpCode.length !== 6)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Vérifier le code
              </>
            )}
          </button>
        </>
      ) : (
        /* Success State */
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 p-4 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-green-600 mb-2">
            Vérification réussie!
          </h3>
          <p className="text-gray-600 text-sm">
            Vous êtes maintenant authentifié en toute sécurité.
          </p>
        </motion.div>
      )}

      {/* Info contexte */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <details className="cursor-pointer">
          <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
            ℹ️ Comment configurer l'authentification ?
          </summary>
          <div className="mt-3 text-xs text-gray-600 space-y-2">
            <p>
              <strong>1. Téléchargez une application Authenticator:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
            </ul>
            <p className="mt-2">
              <strong>2. Scannez le code QR</strong> fourni lors de la configuration.
            </p>
            <p>
              <strong>3. Gardez vos codes de secours</strong> dans un endroit sûr!
            </p>
          </div>
        </details>
      </div>
    </motion.div>
  );
};

export default TOTPVerification;
