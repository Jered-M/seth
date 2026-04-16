/**
 * Composant d'affichage des alertes de sécurité - SENTINEL PRO
 * Affiche les événements de sécurité avec une esthétique tactique haute-fidélité.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Shield,
  Zap,
  MapPin,
  Clock,
  X,
  Bell,
  Activity,
  ShieldAlert,
  Wifi,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityAlert {
  id: string;
  type: 'UNAUTHORIZED_EXIT' | 'MFA_FAILED' | 'NEW_DEVICE' | 'ANOMALY' | 'RISK_HIGH' | 'BLOCKED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  read: boolean;
}

interface SecurityAlertProps {
  alerts?: SecurityAlert[];
  onAlertDismiss?: (alertId: string) => void;
  autoHideDuration?: number;
}

const Lock = Shield; // Fallback

const alertConfig = {
  UNAUTHORIZED_EXIT: {
    icon: MapPin,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-400',
    badgeColor: 'status-danger'
  },
  MFA_FAILED: {
    icon: ShieldAlert,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400',
    badgeColor: 'status-warning'
  },
  NEW_DEVICE: {
    icon: Radio,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-400',
    badgeColor: 'status-info'
  },
  ANOMALY: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400',
    badgeColor: 'status-warning'
  },
  RISK_HIGH: {
    icon: Zap,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-400',
    badgeColor: 'status-danger'
  },
  BLOCKED: {
    icon: Lock,
    bgColor: 'bg-slate-900',
    borderColor: 'border-slate-800',
    textColor: 'text-slate-400',
    badgeColor: 'status-info'
  }
};

/**
 * SingleAlert - Composant tactique pour une seule alerte
 */
const SingleAlert: React.FC<{
  alert: SecurityAlert;
  onDismiss: (id: string) => void;
  autoHideDuration?: number;
}> = ({ alert, onDismiss, autoHideDuration }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (!autoHideDuration || alert.severity === 'CRITICAL') return;
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(alert.id), 300);
    }, autoHideDuration);
    
    return () => clearTimeout(timer);
  }, [alert.id, autoHideDuration, onDismiss, alert.severity]);

  if (!isVisible) return null;

  const config = alertConfig[alert.type as keyof typeof alertConfig] || alertConfig.ANOMALY;
  const Icon = config.icon;
  
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'INSTANT_T';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className={`relative overflow-hidden ${config.bgColor} backdrop-blur-md border ${config.borderColor} rounded p-4 mb-3 ${config.textColor} shadow-2xl`}
    >
        <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-50"></div>
        <div className="absolute inset-0 tactical-grid opacity-5 pointer-events-none"></div>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 bg-black/20 rounded border border-white/5">
          <Icon className="w-5 h-5 animate-pulse" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{alert.type}</span>
            <span className={`status-badge !text-[8px] !px-2 !py-0.5 ${config.badgeColor}`}>
              LVL_{alert.severity}
            </span>
          </div>
          
          <p className="text-[11px] font-bold tracking-tight mb-3 leading-relaxed">
            {alert.message.toUpperCase()}
          </p>
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-[9px] font-black opacity-50 uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              {formatTime(alert.timestamp)} // NODE_S4
            </div>
            
             <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onDismiss(alert.id), 300);
                }}
                className="text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
                >
                <X className="w-3 h-3" /> ACQUITTER
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * SecurityAlertContainer - Conteneur principal d'alertes PRO
 */
export const SecurityAlertContainer: React.FC<SecurityAlertProps> = ({
  alerts = [],
  onAlertDismiss = () => {},
  autoHideDuration = 10000
}) => {
  const [visibleAlerts, setVisibleAlerts] = useState<SecurityAlert[]>([]);

  useEffect(() => {
    // Only show new alerts
    setVisibleAlerts(alerts);
  }, [alerts]);

  const handleDismiss = (alertId: string) => {
    setVisibleAlerts(prev => prev.filter(a => a.id !== alertId));
    onAlertDismiss(alertId);
  };

  return (
    <div className="fixed top-24 right-6 z-[9999] w-[380px] pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence mode="popLayout">
            {visibleAlerts.map(alert => (
            <SingleAlert
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
                autoHideDuration={autoHideDuration}
            />
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * SecurityAlertSummary - Résumé tactique pour dashboard
 */
export const SecurityAlertSummary: React.FC<{
  alerts?: SecurityAlert[];
  criticalOnly?: boolean;
}> = ({ alerts = [], criticalOnly = false }) => {
  const filteredAlerts = criticalOnly
    ? alerts.filter(a => a.severity === 'CRITICAL')
    : alerts;

  if (filteredAlerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded text-emerald-400">
        <CheckCircle className="w-5 h-5" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">STATUS: OPÉRATIONNEL // AUCUNE MENACE DÉTECTÉE</span>
      </div>
    );
  }

  const criticalCount = filteredAlerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = filteredAlerts.filter(a => a.severity === 'HIGH').length;

  return (
    <div className="pro-card p-6 border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Radio className="w-16 h-16" />
        </div>
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-blue-500" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Flux d'Alertes Sécurité</h3>
      </div>

      <div className="space-y-3">
        {criticalCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500">
            <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Critiques Détectées</span>
            </div>
            <span className="text-sm font-bold">{criticalCount}</span>
          </div>
        )}
        
        {highCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500">
             <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Risques Élevés</span>
            </div>
            <span className="text-sm font-bold">{highCount}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
          <span>Signal_Global</span>
          <span>{filteredAlerts.length} UNITÉS</span>
        </div>
      </div>
    </div>
  );
};

export default SecurityAlertContainer;
