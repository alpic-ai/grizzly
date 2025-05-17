import { createContext, useContext, useEffect, useState, useMemo } from "react";

const LOCAL_STORAGE_API_KEY_KEY = "model_api_key";
const LOCAL_STORAGE_MODEL_KEY = "model_model";

export const MODELS = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-haiku-20241022",
] as const;

interface ModelContextType {
  isModelConfigured: boolean;
  model: (typeof MODELS)[number];
  setModel: (model: (typeof MODELS)[number]) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  clearKey: () => void;
}

export const ModelContext = createContext<ModelContextType | null>(null);

export const useModelContext = () => {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_API_KEY_KEY) ?? "",
  );
  const [model, setModel] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_MODEL_KEY) ?? MODELS[0],
  );

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_API_KEY_KEY, apiKey);
    localStorage.setItem(LOCAL_STORAGE_MODEL_KEY, model);
  }, [apiKey, model]);

  const isModelConfigured = useMemo(() => apiKey.length !== 0, [apiKey]);

  return {
    isModelConfigured,
    model,
    setModel,
    apiKey,
    setApiKey,
    clearKey: () => setApiKey(""),
  };
};

const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
};

export default useModel;
