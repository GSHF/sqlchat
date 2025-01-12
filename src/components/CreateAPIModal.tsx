import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ResponseObject } from "@/types/api";
import { syncWithServerState } from '@/store/serverState';
import Modal from "./kit/Modal";
import TextField from "./kit/TextField";
import RequiredStar from "./RequiredStar";

interface Props {
  close: () => void;
}

const CreateAPIModal = ({ close }: Props) => {
  const { t } = useTranslation();
  const [isRequesting, setIsRequesting] = useState(false);
  const [apiName, setApiName] = useState("");
  const [apiUrl, setApiUrl] = useState("");

  const handleSubmit = async () => {
    if (!apiName || !apiUrl) {
      toast.error("请填写完整信息");
      return;
    }

    setIsRequesting(true);

    try {
      const response = await fetch("/api/api-management/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: apiName,
          url: apiUrl,
        }),
      });
      const result = await response.json() as ResponseObject<boolean>;
      if (result.message) {
        toast.error(result.message);
        return;
      }
      
      // Sync with server state to update the API list
      await syncWithServerState();
      toast.success("API创建成功");
      close();
    } catch (error) {
      console.error(error);
      toast.error("创建API失败");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Modal title="创建新API" onClose={close}>
      <div className="w-full flex flex-col justify-start items-start space-y-3 mt-2">
        <div className="w-full flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API名称
            <RequiredStar />
          </label>
          <TextField
            placeholder="API名称"
            value={apiName}
            onChange={setApiName}
          />
        </div>
        <div className="w-full flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API地址
            <RequiredStar />
          </label>
          <TextField
            placeholder="API地址"
            value={apiUrl}
            onChange={setApiUrl}
          />
        </div>
      </div>

      <div className="modal-action w-full flex flex-row justify-end items-center space-x-2">
        <button className="btn btn-outline" onClick={close}>
          {t("common.close")}
        </button>
        <button
          className="btn"
          disabled={isRequesting || !apiName || !apiUrl}
          onClick={handleSubmit}
        >
          {t("common.save")}
        </button>
      </div>
    </Modal>
  );
};

export default CreateAPIModal;
