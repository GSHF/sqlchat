import { merge } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Setting, DashScopeApiConfig, QwenApiConfig } from "@/types";

// 检测是否为内网环境（根据实际IP地址判断）
const isInternalNetwork = typeof window !== "undefined" && (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("25.41.") ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.")
);

const getDefaultSetting = (): Setting => {
  return {
    locale: isInternalNetwork ? "zh" : "en", // 内网默认中文，外网默认英文
    theme: "system",
    activeProvider: isInternalNetwork ? "qwen" : "openai", // 内网默认通义千问，外网默认OpenAI
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
      // 内网环境使用固定配置，外网环境使用空配置
      appId: isInternalNetwork ? "8fb1bd5df3b24265bcfff855652e3c9a" : "",
      secretKey: isInternalNetwork ? "41514d28b825409468b0241dc4a672ab" : "",
      endpoint: isInternalNetwork ? "http://25.41.34.249:8008/api/ai/qwen/72b/chat" : "",
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
