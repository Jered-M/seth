/**
 * Hook personnalisé pour gérer l'authentification multifactorielle
 */

import { useState, useCallback } from 'react';

export interface MFASetupData {
  secret: string;
  qr_code: string;
  provisioning_uri: string;
  backup_codes: string[];
}

export interface RiskAssessment {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: Record<string, any>;
  recommendation: 'ALLOW' | 'REQUIRE_MFA' | 'BLOCK';
}

export interface EquipmentExit {
  is_unauthorized: boolean;
  geofence_exited: boolean;
  zone_left: string;
  distance_from_geofence: number;
  risk_level: 'LOW' | 'HIGH' | 'CRITICAL';
}

interface UseMFAState {
  // Setup
  isSettingUpMFA: boolean;
  setupData: MFASetupData | null;
  setupError: string | null;

  // Verification
  isVerifying: boolean;
  verificationError: string | null;

  // Security evaluation
  riskAssessment: RiskAssessment | null;
  isEvaluatingRisk: boolean;

  // Equipment exit
  equipmentExitData: EquipmentExit | null;
  isCheckingEquipmentExit: boolean;
}

export const useMFA = (userId: string) => {
  const [state, setState] = useState<UseMFAState>({
    isSettingUpMFA: false,
    setupData: null,
    setupError: null,
    isVerifying: false,
    verificationError: null,
    riskAssessment: null,
    isEvaluatingRisk: false,
    equipmentExitData: null,
    isCheckingEquipmentExit: false,
  });

  /**
   * Initialise TOTP pour l'utilisateur
   */
  const setupTOTP = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isSettingUpMFA: true, setupError: null }));

    try {
      const response = await fetch('/api/mfa/setup-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email })
      });

      if (!response.ok) throw new Error('Failed to setup TOTP');

      const data = await response.json();
      setState(prev => ({
        ...prev,
        setupData: data,
        isSettingUpMFA: false
      }));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Setup failed';
      setState(prev => ({
        ...prev,
        setupError: errorMessage,
        isSettingUpMFA: false
      }));
      throw error;
    }
  }, [userId]);

  /**
   * Confirme la configuration TOTP
   */
  const confirmTOTP = useCallback(async (
    totpCode: string,
    backupCodes: string[]
  ) => {
    setState(prev => ({ ...prev, isVerifying: true, verificationError: null }));

    try {
      const response = await fetch('/api/mfa/confirm-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          totp_code: totpCode,
          backup_codes: backupCodes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Confirmation failed');
      }

      setState(prev => ({
        ...prev,
        isVerifying: false,
        setupData: null
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Confirmation failed';
      setState(prev => ({
        ...prev,
        verificationError: errorMessage,
        isVerifying: false
      }));
      throw error;
    }
  }, [userId]);

  /**
   * Évalue le risque pour une tentative de connexion
   */
  const evaluateLoginRisk = useCallback(async (
    ipAddress: string,
    deviceId: string,
    deviceName: string,
    userAgent: string
  ) => {
    setState(prev => ({ ...prev, isEvaluatingRisk: true }));

    try {
      const response = await fetch('/api/mfa/evaluate-login-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ip_address: ipAddress,
          device_id: deviceId,
          device_name: deviceName,
          user_agent: userAgent
        })
      });

      if (!response.ok) throw new Error('Risk evaluation failed');

      const data = await response.json();
      setState(prev => ({
        ...prev,
        riskAssessment: data.risk_assessment,
        isEvaluatingRisk: false
      }));

      return data.risk_assessment;
    } catch (error) {
      console.error('Risk evaluation error:', error);
      setState(prev => ({ ...prev, isEvaluatingRisk: false }));
      throw error;
    }
  }, [userId]);

  /**
   * Vérifie si un équipement a quitté sa zone autorisée
   */
  const checkEquipmentExit = useCallback(async (
    equipmentId: string,
    latitude: number,
    longitude: number
  ) => {
    setState(prev => ({ ...prev, isCheckingEquipmentExit: true }));

    try {
      const response = await fetch('/api/mfa/check-equipment-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: equipmentId,
          latitude,
          longitude,
          user_id: userId
        })
      });

      if (!response.ok) throw new Error('Equipment exit check failed');

      const data = await response.json();
      setState(prev => ({
        ...prev,
        equipmentExitData: data.equipment_exit,
        isCheckingEquipmentExit: false
      }));

      return data.equipment_exit;
    } catch (error) {
      console.error('Equipment exit check error:', error);
      setState(prev => ({ ...prev, isCheckingEquipmentExit: false }));
      throw error;
    }
  }, [userId]);

  /**
   * Marque un appareil comme de confiance
   */
  const trustDevice = useCallback(async (
    deviceId: string,
    deviceName: string
  ) => {
    try {
      const response = await fetch('/api/mfa/trust-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          device_id: deviceId,
          device_name: deviceName
        })
      });

      if (!response.ok) throw new Error('Failed to trust device');

      return await response.json();
    } catch (error) {
      console.error('Trust device error:', error);
      throw error;
    }
  }, [userId]);

  /**
   * Liste les appareils approuvés
   */
  const listDevices = useCallback(async () => {
    try {
      const response = await fetch(`/api/mfa/list-devices?user_id=${userId}`);

      if (!response.ok) throw new Error('Failed to list devices');

      return await response.json();
    } catch (error) {
      console.error('List devices error:', error);
      throw error;
    }
  }, [userId]);

  /**
   * Révoque un appareil
   */
  const revokeDevice = useCallback(async (deviceId: string) => {
    try {
      const response = await fetch('/api/mfa/revoke-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          device_id: deviceId
        })
      });

      if (!response.ok) throw new Error('Failed to revoke device');

      return await response.json();
    } catch (error) {
      console.error('Revoke device error:', error);
      throw error;
    }
  }, [userId]);

  /**
   * Réinitialise les erreurs
   */
  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      setupError: null,
      verificationError: null
    }));
  }, []);

  return {
    // State
    ...state,

    // Setup methods
    setupTOTP,
    confirmTOTP,

    // Security evaluation
    evaluateLoginRisk,

    // Equipment security
    checkEquipmentExit,

    // Device management
    trustDevice,
    listDevices,
    revokeDevice,

    // Utilities
    clearErrors
  };
};
