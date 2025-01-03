import { merge } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Setting, DashScopeApiConfig, QwenApiConfig } from "@/types";

const getDefaultSetting = (): Setting => {
  return {
    locale: "en",
    theme: "system",
    activeProvider: "qwen", // 默认使用内网通义千问
    openAIApiConfig: {
      key: "",
      endpoint: "",
      model: "gpt-3.5-turbo",
    },
    dashScopeApiConfig: {
      key: "",
      model: "qwen-turbo",
    },
    qwenApiConfig: {
      appId: "8fb1bd5df3b24265bcfff855652e3c9a",
      secretKey: "41514d28b825409468b0241dc4a672ab",
      endpoint: "http://25.41.34.249:8008/api/ai/qwen/72b/chat",
    },
  };
};

interface SettingState {
  setting: Setting;
  getState: () => SettingState;
  setLocale: (locale: Setting["locale"]) => void;
  setTheme: (theme: Setting["theme"]) => void;
  setActiveProvider: (provider: Setting["activeProvider"]) => void;
  setOpenAIApiConfig: (openAIApiConfig: Setting["openAIApiConfig"]) => void;
  setDashScopeApiConfig: (dashScopeApiConfig: Setting["dashScopeApiConfig"]) => void;
  setQwenApiConfig: (qwenApiConfig: Setting["qwenApiConfig"]) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set, get) => ({
      setting: getDefaultSetting(),
      getState: () => get(),
      setLocale: (locale: Setting["locale"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            locale,
          },
        }));
      },
      setTheme: (theme: Setting["theme"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            theme,
          },
        }));
      },
      setActiveProvider: (provider: Setting["activeProvider"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            activeProvider: provider,
          },
        }));
      },
      setOpenAIApiConfig: (openAIApiConfig: Setting["openAIApiConfig"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            openAIApiConfig,
          },
        }));
      },
      setDashScopeApiConfig: (dashScopeApiConfig: Setting["dashScopeApiConfig"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            dashScopeApiConfig,
          },
        }));
      },
      setQwenApiConfig: (qwenApiConfig: Setting["qwenApiConfig"]) => {
        set((state: SettingState) => ({
          setting: {
            ...state.setting,
            qwenApiConfig,
          },
        }));
      },
    }),
    {
      name: "setting-storage",
      merge: (persistedState: any, currentState: any) => {
        return merge(currentState, persistedState);
      },
    }
  )
);
