import { head } from "lodash-es";
import DataTable from "react-data-table-component";
import { useTranslation } from "react-i18next";
import { RawResult } from "@/types";
import Icon from "../Icon";
import { useState } from "react";
import ChartGenerationModal from "../ChartGenerationModal";

interface Props {
  rawResults: RawResult[];
}

const DataTableView = (props: Props) => {
  const { rawResults } = props;
  const { t } = useTranslation();
  const [showChartModal, setShowChartModal] = useState(false);
  const columns = Object.keys(head(rawResults) || {}).map((key) => {
    return {
      name: key,
      sortable: true,
      selector: (row: any) => {
        const value = row[key];
        // 如果值是对象，将其转换为字符串
        if (value && typeof value === "object") {
          return JSON.stringify(value);
        }
        return value;
      },
    };
  });

  return rawResults.length === 0 ? (
    <div className="w-full flex flex-col justify-center items-center py-6 pt-10">
      <Icon.BsBox2 className="w-7 h-auto opacity-70" />
      <span className="text-sm font-mono text-gray-500 mt-2">{t("execution.message.no-data")}</span>
    </div>
  ) : (
    <>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => {
            console.log('点击生成图表按钮');
            console.log('rawResults:', rawResults);
            console.log('columns:', columns);
            setShowChartModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          生成图表
        </button>
      </div>
      <DataTable
        className="w-full border !rounded-lg dark:border-zinc-700"
        columns={columns}
        data={rawResults}
        fixedHeader
        pagination
        responsive
      />
      <ChartGenerationModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        data={rawResults}
        columns={columns.map(col => col.name)}
      />
    </>
  );
};

export default DataTableView;
