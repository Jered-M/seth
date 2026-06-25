import { useCallback, useEffect, useRef, useState } from 'react';

import { Bell, Check, Loader2, X } from 'lucide-react';

import { AppNotification, notificationService } from '../services/notificationService';

import { useNotificationsRealtime } from '../hooks/useRealtime';



const TYPE_LABELS: Record<string, string> = {

    USER_LOGIN: 'Connexion',

    REQUEST_CREATED: 'Demande',

    REQUEST_PENDING_DEPT: 'Validation dept',

    REQUEST_PENDING_SECURITY: 'Poste sécurité',

    REQUEST_COMPLETED: 'Sortie OK',

    REQUEST_DENIED_SECURITY: 'Refus sécurité',

    EXIT_AUTHORIZED: 'Passage autorisé',

    SECURITY_ALERT: 'Alerte',

    SUPER_ADMIN_PERIMETER_BREACH: 'Hors périmètre',

    USER_REPORT: 'Signalement',

    REQUEST_ESCALATED: 'Demande validée',

    REQUEST_REJECTED: 'Demande rejetée',

};



const POLL_MS = 5000;



function formatTime(iso: string | null): string {

    if (!iso) return '';

    try {

        return new Date(iso).toLocaleString('fr-FR', {

            day: '2-digit',

            month: '2-digit',

            hour: '2-digit',

            minute: '2-digit',

        });

    } catch {

        return '';

    }

}



function zoneLabel(status?: string): string | null {

    if (status === 'IN_ZONE') return 'Dans la zone';

    if (status === 'OUT_OF_ZONE') return 'Hors zone';

    if (status === 'UNKNOWN') return 'GPS indisponible';

    return null;

}



interface ToastItem {

    id: string;

    title: string;

    message: string;

}



interface NotificationBellProps {

    userId?: string;

}



export const NotificationBell = ({ userId }: NotificationBellProps) => {

    const [open, setOpen] = useState(false);

    const [loading, setLoading] = useState(false);

    const [unreadCount, setUnreadCount] = useState(0);

    const [items, setItems] = useState<AppNotification[]>([]);

    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const panelRef = useRef<HTMLDivElement>(null);

    const knownIdsRef = useRef<Set<string>>(new Set());

    const initializedRef = useRef(false);

    const { tick } = useNotificationsRealtime(userId);



    const pushToast = useCallback((n: AppNotification) => {

        const toast: ToastItem = {

            id: n.id,

            title: n.title,

            message: n.message || n.title,

        };

        setToasts((prev) => [toast, ...prev].slice(0, 4));



        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {

            try {

                new Notification(n.title, {

                    body: n.message || n.title,

                    tag: n.id,

                });

            } catch {

                /* navigateur sans support */

            }

        }



        setTimeout(() => {

            setToasts((prev) => prev.filter((t) => t.id !== toast.id));

        }, 8000);

    }, []);



    const load = useCallback(async () => {

        try {

            setLoading(true);

            const data = await notificationService.list();

            const list = data.notifications;



            if (initializedRef.current) {

                const fresh = list.filter((n) => !n.is_read && !knownIdsRef.current.has(n.id));

                fresh.forEach(pushToast);

            } else {

                initializedRef.current = true;

            }



            knownIdsRef.current = new Set(list.map((n) => n.id));

            setItems(list);

            setUnreadCount(data.unread_count);

        } catch {

            if (!initializedRef.current) {

                setItems([]);

                setUnreadCount(0);

            }

        } finally {

            setLoading(false);

        }

    }, [pushToast]);



    useEffect(() => {

        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {

            Notification.requestPermission().catch(() => undefined);

        }

    }, []);



    useEffect(() => {

        if (!userId) return;

        initializedRef.current = false;

        knownIdsRef.current = new Set();

        load();

        const interval = setInterval(load, POLL_MS);

        return () => clearInterval(interval);

    }, [load, tick, userId]);



    useEffect(() => {

        if (!open) return;

        const onClickOutside = (e: MouseEvent) => {

            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {

                setOpen(false);

            }

        };

        document.addEventListener('mousedown', onClickOutside);

        return () => document.removeEventListener('mousedown', onClickOutside);

    }, [open]);



    const handleMarkRead = async (id: string) => {

        await notificationService.markRead(id);

        await load();

    };



    const handleMarkAllRead = async () => {

        await notificationService.markAllRead();

        await load();

    };



    const dismissToast = (id: string) => {

        setToasts((prev) => prev.filter((t) => t.id !== id));

    };



    return (

        <>

            {toasts.length > 0 ? (

                <div className="fixed top-20 right-4 z-[3000] flex flex-col gap-2 w-[min(100vw-2rem,360px)] pointer-events-none">

                    {toasts.map((t) => (

                        <div

                            key={t.id}

                            className="pointer-events-auto pro-card border border-blue-500/30 bg-[#0d1224]/95 shadow-2xl p-4 animate-in slide-in-from-right duration-300"

                        >

                            <div className="flex items-start justify-between gap-2">

                                <div className="min-w-0">

                                    <p className="text-xs font-black uppercase tracking-wider text-blue-400">Nouvelle notification</p>

                                    <p className="text-sm font-bold text-white mt-1 truncate">{t.title}</p>

                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{t.message}</p>

                                </div>

                                <button

                                    type="button"

                                    onClick={() => dismissToast(t.id)}

                                    className="text-slate-500 hover:text-white shrink-0"

                                >

                                    <X className="w-4 h-4" />

                                </button>

                            </div>

                        </div>

                    ))}

                </div>

            ) : null}



            <div className="relative" ref={panelRef}>

                <button

                    type="button"

                    title="Notifications"

                    onClick={() => setOpen((v) => !v)}

                    className="relative p-2 text-slate-400 hover:text-white transition-colors"

                >

                    <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-blue-400' : ''}`} />

                    {unreadCount > 0 ? (

                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border border-[#0a0f1d] text-[9px] font-black text-white flex items-center justify-center animate-pulse">

                            {unreadCount > 9 ? '9+' : unreadCount}

                        </span>

                    ) : null}

                </button>



                {open ? (

                    <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,380px)] z-[2000] pro-card border border-white/10 shadow-2xl overflow-hidden">

                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d1224]">

                            <p className="text-xs font-black uppercase tracking-widest text-white">

                                Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}

                            </p>

                            <div className="flex items-center gap-2">

                                {unreadCount > 0 ? (

                                    <button

                                        type="button"

                                        onClick={handleMarkAllRead}

                                        className="text-[9px] font-bold uppercase text-blue-400 hover:text-blue-300 flex items-center gap-1"

                                    >

                                        <Check className="w-3 h-3" />

                                        Tout lire

                                    </button>

                                ) : null}

                                <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">

                                    <X className="w-4 h-4" />

                                </button>

                            </div>

                        </div>



                        <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">

                            {loading && items.length === 0 ? (

                                <div className="flex justify-center py-8">

                                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />

                                </div>

                            ) : items.length === 0 ? (

                                <p className="p-6 text-center text-xs text-slate-500">Aucune notification</p>

                            ) : (

                                items.map((n) => {

                                    const zl = zoneLabel(String(n.payload?.zone_status || ''));

                                    return (

                                        <button

                                            key={n.id}

                                            type="button"

                                            onClick={() => !n.is_read && handleMarkRead(n.id)}

                                            className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors ${

                                                n.is_read ? 'opacity-60' : 'bg-blue-500/[0.04]'

                                            }`}

                                        >

                                            <div className="flex items-start justify-between gap-2">

                                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">

                                                    {TYPE_LABELS[n.type] || n.type}

                                                </span>

                                                <span className="text-[9px] text-slate-600 shrink-0">{formatTime(n.created_at)}</span>

                                            </div>

                                            <p className="text-sm font-semibold text-white mt-1">{n.title}</p>

                                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>

                                            {zl ? (

                                                <p

                                                    className={`text-[10px] mt-1 font-bold uppercase ${

                                                        n.payload?.zone_status === 'IN_ZONE'

                                                            ? 'text-emerald-400'

                                                            : n.payload?.zone_status === 'OUT_OF_ZONE'

                                                              ? 'text-red-400'

                                                              : 'text-amber-400'

                                                    }`}

                                                >

                                                    {zl}

                                                </p>

                                            ) : null}

                                            {n.payload?.department ? (

                                                <p className="text-[10px] text-slate-500 mt-0.5">Dept: {String(n.payload.department)}</p>

                                            ) : null}

                                        </button>

                                    );

                                })

                            )}

                        </div>

                    </div>

                ) : null}

            </div>

        </>

    );

};


