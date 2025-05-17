import { useEffect, useState } from "react";

const LOCAL_STORAGE_KEY = "model_api_key";

const useModel = () => {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEY) ?? undefined,
  );

  useEffect(() => {
    if (apiKey !== undefined) {
      localStorage.setItem(LOCAL_STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [apiKey]);

  return { isModelConfigured: apiKey !== undefined, apiKey, setApiKey };
};

export default useModel;
