"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "aura:design-v2";

type DesignVersionState = {
  v2: boolean;
  setV2: (v2: boolean) => void;
};

const DesignVersionContext = createContext<DesignVersionState>({
  v2: false,
  setV2: () => {},
});

/** Envuelve toda la app: guarda si el usuario está viendo el diseño clásico o el nuevo
 * (redisño en prueba). Se persiste solo en localStorage — es una preferencia de
 * visualización local, no un dato de negocio, así que no toca Supabase. */
export function DesignVersionProvider({ children }: { children: React.ReactNode }) {
  const [v2, setV2State] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setV2State(true);
  }, []);

  function setV2(next: boolean) {
    setV2State(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <DesignVersionContext.Provider value={{ v2, setV2 }}>
      {children}
    </DesignVersionContext.Provider>
  );
}

export function useDesignVersion(): DesignVersionState {
  return useContext(DesignVersionContext);
}
