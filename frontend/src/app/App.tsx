import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { router } from "./routes";

interface MaintenanceConfig {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  eta?: string;
}

export default function App() {
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMaintenanceConfig() {
      try {
        const response = await fetch(`/maintenance.json?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load maintenance config");
        }

        const config = (await response.json()) as MaintenanceConfig;

        if (isMounted && config.enabled) {
          setMaintenanceConfig(config);
        }
      } catch {
        if (isMounted) {
          setMaintenanceConfig(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingMaintenance(false);
        }
      }
    }

    loadMaintenanceConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isCheckingMaintenance) {
    return <div className="min-h-screen bg-white dark:bg-[#0a0a0a]" />;
  }

  if (maintenanceConfig?.enabled) {
    return <MaintenanceNotice config={maintenanceConfig} />;
  }

  return <RouterProvider router={router} />;
}
