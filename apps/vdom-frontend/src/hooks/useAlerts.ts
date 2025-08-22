import { useState, useEffect } from "preact/hooks";
import AlertService, { Alert } from "../services/alertService";

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await AlertService.fetchAlerts();
      setAlerts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await AlertService.resolveAlert(alertId);
      // Remove the resolved alert from local state
      setAlerts(prevAlerts => 
        prevAlerts.filter(alert => alert._id !== alertId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
      throw err; // Re-throw so the component can handle the error
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return {
    alerts,
    setAlerts,
    loading,
    error,
    refetch: fetchAlerts,
    resolveAlert
  };
};