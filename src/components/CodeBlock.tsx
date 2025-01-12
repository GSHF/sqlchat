import { useState } from "react";
import { useTranslation } from "react-i18next";
import copy from "copy-to-clipboard";
import { toast } from "react-hot-toast";
import { useConnectionStore } from "@/store";
import { useQueryStore } from "@/store/query";
import { ApiPublishModal } from "./ApiPublishModal";
import Icon from "./Icon";
import Tooltip from "./kit/Tooltip";
import { Id } from "@/types";
import { parseAndGenerateAPI } from "@/utils/sqlToApi";
import { Vulcan } from "@/vulcan/core";

interface Props {
  language: string;
  value: string;
  messageId?: Id;
  wrapLongLines?: boolean;
}

export const CodeBlock = (props: Props) => {
  const { language, value, messageId, wrapLongLines } = props;
  const { t } = useTranslation();
  const connectionStore = useConnectionStore();
  const queryStore = useQueryStore();
  const currentConnectionCtx = connectionStore.currentConnectionCtx;
  const [showApiModal, setShowApiModal] = useState(false);
  const selectedDatabase = currentConnectionCtx?.selectedDatabase || currentConnectionCtx?.connection?.database;

  // Only show execute button in the following situations:
  // * SQL code;
  // * Connection setup;
  const showExecuteButton = currentConnectionCtx?.connection && currentConnectionCtx?.database && language.toUpperCase() === "SQL";

  const copyToClipboard = () => {
    copy(value);
    toast.success("Copied to clipboard");
  };

  const handleExecuteQuery = () => {
    if (!currentConnectionCtx) {
      toast.error("Please select a connection first");
      return;
    }

    queryStore.setContext({
      connection: currentConnectionCtx.connection,
      database: currentConnectionCtx.database,
      messageId: messageId,
      statement: value,
    });
    queryStore.toggleDrawer(true);
  };

  const handlePublishAPI = () => {
    if (!currentConnectionCtx) {
      toast.error("Please select a connection first");
      return;
    }
    setShowApiModal(true);
  };

  return (
    <>
      <div className="w-full max-w-full relative font-sans text-[16px]">
        <div className="flex items-center justify-between py-2 px-4">
          <span className="text-xs text-gray-400">{language}</span>
          <div className="flex items-center">
            {showExecuteButton && (
              <>
                <button
                  className="mr-2 px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm hover:opacity-80"
                  onClick={handleExecuteQuery}
                >
                  运行 SQL
                </button>
                <button
                  className="mr-2 px-3 py-1 rounded-lg bg-green-600 text-white text-sm hover:opacity-80"
                  onClick={handlePublishAPI}
                >
                  发布 API
                </button>
              </>
            )}
            <Tooltip title={t("common.copy")} side="top">
              <button onClick={copyToClipboard} className="hover:opacity-80">
                <Icon.IoCopy className="w-4 h-auto opacity-60" />
              </button>
            </Tooltip>
          </div>
        </div>
        <pre
          className={`whitespace-pre-wrap bg-gray-100 dark:bg-zinc-600 rounded-lg p-4 my-2 overflow-x-auto ${
            wrapLongLines ? "break-words" : ""
          }`}
        >
          <code>{value}</code>
        </pre>

        {/* API发布模态框 */}
        {showApiModal && currentConnectionCtx && (
          <ApiPublishModal
            isOpen={showApiModal}
            onClose={() => setShowApiModal(false)}
            connection={currentConnectionCtx.connection}
            tableName={value.toLowerCase().includes("from") ? value.toLowerCase().split("from")[1].trim().split(" ")[0] : "query"}
            sqlQuery={value}
            selectedDatabase={selectedDatabase}
          />
        )}
      </div>
    </>
  );
};
