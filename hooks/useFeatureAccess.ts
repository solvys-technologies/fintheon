import { useState, useEffect } from 'react';
import { useBackend } from '../lib/backend';
import { useAuth } from '../contexts/AuthContext';

export interface FeatureAccessResult {
  hasAccess: boolean;
  requiredTier: string;
  currentTier: string | null;
  isLoading: boolean;
}

/**
 * Hook to check if user has access to a feature
 */
export function useFeatureAccess(featureName: string): FeatureAccessResult {
  const backend = useBackend();
  const { tier } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [requiredTier, setRequiredTier] = useState<string>('pulse_pro');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!tier) {
        setHasAccess(false);
        setRequiredTier('free');
        setIsLoading(false);
        return;
      }

      try {
        const response = await backend.account.getFeatures();
        const feature = response.features?.find((f: any) => f.name === featureName);
        
        if (feature) {
          setHasAccess(feature.hasAccess);
          setRequiredTier(feature.requiredTier);
        } else {
          // Default to no access if feature not found
          setHasAccess(false);
          setRequiredTier('pulse_pro');
        }
      } catch (error) {
        console.error('Failed to check feature access:', error);
        setHasAccess(false);
        setRequiredTier('pulse_pro');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [featureName, tier, backend]);

  return {
    hasAccess,
    requiredTier,
    currentTier: tier || null,
    isLoading,
  };
}
