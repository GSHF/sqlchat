import { useTranslation } from "react-i18next";
import { useSettingStore } from "@/store/setting";
import { QwenApiConfig } from "@/types";

const QwenApiConfigView = () => {
  const { t } = useTranslation();
  const settingStore = useSettingStore();
  const qwenApiConfig = settingStore.setting.qwenApiConfig;

  const handleQwenApiConfigChange = (key: keyof QwenApiConfig, value: string) => {
    const config = {
      ...qwenApiConfig,
      [key]: value,
    };
    settingStore.setQwenApiConfig(config);
  };

  return (
    <div className="w-full border border-gray-200 dark:border-zinc-700 p-4 rounded-lg space-y-4">
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.providers.qwen")}</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 text-sm font-medium">APP ID</div>
          <input
            type="text"
            className="w-full px-2 py-1 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            value={qwenApiConfig.appId}
            onChange={(e) => handleQwenApiConfigChange("appId", e.target.value)}
            placeholder="Enter your APP ID"
          />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Secret Key</div>
          <input
            type="password"
            className="w-full px-2 py-1 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            value={qwenApiConfig.secretKey}
            onChange={(e) => handleQwenApiConfigChange("secretKey", e.target.value)}
            placeholder="Enter your Secret Key"
          />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">{t("setting.endpoint")}</div>
          <input
            type="text"
            className="w-full px-2 py-1 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            value={qwenApiConfig.endpoint}
            onChange={(e) => handleQwenApiConfigChange("endpoint", e.target.value)}
            placeholder="Enter custom endpoint (optional)"
          />
        </div>
      </div>
      <p className="text-sm text-gray-500">
        {t("setting.qwen.description")}
      </p>
    </div>
  );
};

export default QwenApiConfigView;
