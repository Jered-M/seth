import React, { useState, useEffect } from 'react';
import { Settings, Save, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

interface SettingsData {
    autoLogoutMinutes: number;
    enableMFA: boolean;
    sessionTimeoutEnabled: boolean;
    alertsEnabled: boolean;
    darkMode: boolean;
    logsRetention: number;
    maxLoginAttempts: number;
}

export const SettingsPage = () => {
    const [settings, setSettings] = useState<SettingsData>({
        autoLogoutMinutes: 30,
        enableMFA: true,
        sessionTimeoutEnabled: true,
        alertsEnabled: true,
        darkMode: true,
        logsRetention: 90,
        maxLoginAttempts: 5
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get('/settings');
                if (response.data) {
                    setSettings(response.data);
                }
            } catch (error) {
                console.error('Erreur:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/settings', settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof SettingsData, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div className="pb-4 border-b border-white/5">
                <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-400" />
                    Paramètres Système
                </h2>
                <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">Configuration Globale</p>
            </div>

            {/* Notifications */}
            {saved && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3"
                >
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                        <p className="text-sm font-bold text-emerald-400">Paramètres sauvegardés</p>
                        <p className="text-xs text-emerald-400/70">Les modifications ont été appliquées avec succès</p>
                    </div>
                </motion.div>
            )}

            {/* Settings Sections */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Security Settings */}
                    <div className="pro-card p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            Sécurité
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center gap-3 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={settings.enableMFA}
                                        onChange={(e) => handleChange('enableMFA', e.target.checked)}
                                        className="w-4 h-4 rounded border-white/20"
                                    />
                                    <span className="text-sm font-bold text-white">Activer l'authentification multi-facteurs</span>
                                </label>
                                <p className="text-xs text-slate-500 ml-7">Nécessite une vérification supplémentaire lors de la connexion</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-white mb-2">Nombre maximum de tentatives de connexion</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={settings.maxLoginAttempts}
                                    onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-600 text-sm"
                                />
                                <p className="text-xs text-slate-500 mt-1">Après {settings.maxLoginAttempts} tentatives, le compte sera bloqué temporairement</p>
                            </div>

                            <div>
                                <label className="flex items-center gap-3 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={settings.sessionTimeoutEnabled}
                                        onChange={(e) => handleChange('sessionTimeoutEnabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-white/20"
                                    />
                                    <span className="text-sm font-bold text-white">Activer le délai d'inactivité</span>
                                </label>
                                {settings.sessionTimeoutEnabled && (
                                    <div className="ml-7 mt-2">
                                        <label className="block text-xs text-slate-400 mb-1">Délai d'inactivité (minutes)</label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="120"
                                            value={settings.autoLogoutMinutes}
                                            onChange={(e) => handleChange('autoLogoutMinutes', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 bg-[#0a0f1d] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-600 text-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="pro-card p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6">Notifications</h3>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={settings.alertsEnabled}
                                    onChange={(e) => handleChange('alertsEnabled', e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20"
                                />
                                <span className="text-sm font-bold text-white">Activer les notifications d'alertes</span>
                            </label>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="pro-card p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6">Gestion des Données</h3>
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">Rétention des logs (jours)</label>
                            <input
                                type="number"
                                min="30"
                                max="365"
                                value={settings.logsRetention}
                                onChange={(e) => handleChange('logsRetention', parseInt(e.target.value))}
                                className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-600 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Les logs plus anciens seront automatiquement archivés</p>
                        </div>
                    </div>

                    {/* Appearance */}
                    <div className="pro-card p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6">Apparence</h3>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={settings.darkMode}
                                onChange={(e) => handleChange('darkMode', e.target.checked)}
                                className="w-4 h-4 rounded border-white/20"
                            />
                            <span className="text-sm font-bold text-white">Mode sombre (actif par défaut)</span>
                        </label>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-900/40"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                        </button>
                        <button
                            onClick={() => window.history.back()}
                            className="px-6 py-3 border border-white/10 text-slate-300 rounded-lg hover:bg-white/5 transition-all font-bold text-sm uppercase tracking-widest"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
