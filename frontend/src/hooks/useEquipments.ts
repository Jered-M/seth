import { useState, useEffect } from 'react';
import { equipmentService, Equipment } from '../services/equipmentService';

export const useEquipments = () => {
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEquipments = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await equipmentService.getAll();
            setEquipments(data);
            setLoading(false);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Erreur lors du chargement des équipements';
            setError(errorMessage);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEquipments();
    }, []);

    const addEquipment = async (data: any) => {
        setLoading(true);
        setError(null);
        try {
            await equipmentService.create(data);
            await fetchEquipments(); // Recharger la liste
            setLoading(false);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Erreur lors de l\'ajout de l\'équipement';
            setError(errorMessage);
            setLoading(false);
            throw new Error(errorMessage);
        }
    };

    const assignEquipment = async (equipmentId: string, userId: string) => {
        setLoading(true);
        setError(null);
        try {
            await equipmentService.assign(equipmentId, { userId });
            await fetchEquipments(); // Recharger la liste
            setLoading(false);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Erreur lors de l\'assignation';
            setError(errorMessage);
            setLoading(false);
            throw new Error(errorMessage);
        }
    };

    return {
        equipments,
        loading,
        error,
        fetchEquipments,
        addEquipment,
        assignEquipment
    };
};
