import { useCallback, useEffect, useState } from 'react';

/**
 * Abstraction temps réel — brancher Supabase Realtime ici.
 * @example supabase.channel('alerts:global').on('postgres_changes', handler).subscribe()
 */
export const useRealtimeChannel = (
    channel: string,
    onEvent: (payload: unknown) => void,
    enabled = true
) => {
    useEffect(() => {
        if (!enabled) return;

        // TODO: Supabase Realtime
        // const sub = supabase.channel(channel).on('broadcast', { event: 'update' }, ({ payload }) => onEvent(payload)).subscribe()
        // return () => { supabase.removeChannel(sub) }

        const interval = setInterval(() => {
            onEvent({ channel, ts: Date.now() });
        }, 5000);

        return () => clearInterval(interval);
    }, [channel, enabled, onEvent]);
};

export const useNotificationsRealtime = (userId?: string) => {
    const [tick, setTick] = useState(0);
    const refresh = useCallback(() => setTick((v) => v + 1), []);

    useRealtimeChannel(`notifications:user:${userId || 'anon'}`, refresh, Boolean(userId));

    return { tick, refresh };
};
