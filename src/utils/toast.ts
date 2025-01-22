import { toast as hotToast } from "react-hot-toast";

const toast = {
  success: (message: string) => {
    hotToast.success(message);
  },
  error: (message: string) => {
    hotToast.error(message);
  },
  info: (message: string) => {
    hotToast(message);
  },
};

export default toast;
