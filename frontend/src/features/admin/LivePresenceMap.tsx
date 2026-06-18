import { TrackingMap } from '../../pages/TrackingMap';

/** Carte présence temps réel — réutilise le module Tracking existant. */
export const LivePresenceMap = () => (
    <div className="space-y-4">
        <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Carte présence live</h3>
            <p className="text-xs text-slate-400 mt-1">Utilisateurs connectés · Sur site / Hors site · Machine</p>
        </div>
        <TrackingMap />
    </div>
);
