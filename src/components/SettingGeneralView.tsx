import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingStore } from "@/store";
import { Setting } from "@/types";
import { hasFeature } from "../utils";
import AccountView from "./AccountView";
import WeChatQRCodeView from "./WeChatQRCodeView";
import ClearDataButton from "./ClearDataButton";
import LocaleSelector from "./LocaleSelector";
import ThemeSelector from "./ThemeSelector";
import OpenAIApiConfigView from "./OpenAIApiConfigView";
import DashScopeApiConfigView from "./DashScopeApiConfigView";
import QwenApiConfigView from "./QwenApiConfigView";

const SettingGeneralView = () => {
  const { t } = useTranslation();
  const settingStore = useSettingStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show the UI after client-side hydration
  if (!mounted) {
    return null;
  }

  return (
    <div className="w-full flex flex-col justify-start items-start space-y-2 sm:space-y-4 py-4 sm:py-8">
      <div className="w-full flex flex-row justify-start items-start flex-wrap gap-2">
        <WeChatQRCodeView />
      </div>

      {hasFeature("account") && (
        <div className="w-full border border-gray-200 dark:border-zinc-700 p-4 rounded-lg space-y-2">
          <AccountView />
        </div>
      )}

      <div className="w-full border border-gray-200 dark:border-zinc-700 p-4 rounded-lg">
        <div className="flex flex-row justify-between items-center">
          <span>{t("setting.ai-provider")}</span>
          <select
            value={settingStore.setting.activeProvider}
            onChange={(e) => settingStore.setActiveProvider(e.target.value as Setting["activeProvider"])}
            className="mt-2 block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option value="qwen">{t("setting.providers.qwen")}</option>
            <option value="openai">{t("setting.providers.openai")}</option>
            <option value="dashscope">{t("setting.providers.dashscope")}</option>
          </select>
        </div>
      </div>

      {settingStore.setting.activeProvider === "openai" && <OpenAIApiConfigView />}
      {settingStore.setting.activeProvider === "dashscope" && <DashScopeApiConfigView />}
      {settingStore.setting.activeProvider === "qwen" && <QwenApiConfigView />}

      <div className="w-full border border-gray-200 dark:border-zinc-700 p-4 rounded-lg space-y-2">
        <div className="w-full flex flex-row justify-between items-center gap-2">
          <span>{t("setting.basic.language")}</span>
          <LocaleSelector />
        </div>
        <div className="w-full flex flex-row justify-between items-center gap-2">
          <span>{t("setting.theme.self")}</span>
          <ThemeSelector />
        </div>
      </div>

      <div className="w-full border border-red-200 dark:border-zinc-700 p-4 rounded-lg">
        <div className="w-full flex flex-row justify-between items-center gap-2">
          <span>{t("setting.data.clear-all-data")}</span>
          <ClearDataButton />
        </div>
      </div>

      <div className="w-full flex flex-row justify-start items-center p-4 gap-2">
        <a className="text-blue-600 hover:underline" href={"privacy"} target="_blank">
          Privacy
        </a>
        <span>·</span>
        <a className="text-blue-600 hover:underline" href={"terms"} target="_blank">
          Terms
        </a>
      </div>
    </div>
  );
};

export default SettingGeneralView;
