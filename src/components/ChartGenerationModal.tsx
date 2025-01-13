import React, { useState, useEffect } from 'react';
import { VegaLite } from 'react-vega';
import Modal from './kit/Modal';

interface ChartGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  columns: string[];
}

const ChartGenerationModal: React.FC<ChartGenerationModalProps> = ({
  isOpen,
  onClose,
  data,
  columns,
}) => {
  const [selectedChart, setSelectedChart] = useState<string>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [spec, setSpec] = useState<any>(null);

  const chartTypes = [
    // 基础图表
    { value: 'bar', label: '柱状图', category: '基础图表' },
    { value: 'line', label: '折线图', category: '基础图表' },
    { value: 'area', label: '面积图', category: '基础图表' },
    { value: 'point', label: '散点图', category: '基础图表' },
    { value: 'pie', label: '饼图', category: '基础图表' },
    // 高级图表
    { value: 'boxplot', label: '箱线图', category: '高级图表' },
    { value: 'circle', label: '圆形热力图', category: '高级图表' },
    { value: 'rect', label: '矩形热力图', category: '高级图表' },
    { value: 'rule', label: '标尺图', category: '高级图表' },
    // 组合图表
    { value: 'bar+line', label: '柱状折线图', category: '组合图表' },
    { value: 'layer-bar', label: '层叠柱状图', category: '组合图表' },
    { value: 'layer-area', label: '层叠面积图', category: '组合图表' },
  ];

  // 当选择改变时更新图表配置
  useEffect(() => {
    if (!xAxis || !yAxis || !data || data.length === 0) return;

    let chartSpec;
    if (selectedChart === 'pie') {
      // 饼图特殊处理
      const pieData = data.reduce((acc: any[], row: any) => {
        const xValue = row[xAxis];
        const yValue = parseFloat(row[yAxis]) || 0;
        const existingSlice = acc.find(item => item.category === xValue);
        if (existingSlice) {
          existingSlice.value += yValue;
        } else {
          acc.push({ category: xValue, value: yValue });
        }
        return acc;
      }, []);

      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: pieData },
        width: 400,
        height: 400,
        mark: 'arc',
        encoding: {
          theta: { field: 'value', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' }
        }
      };
    } else if (selectedChart === 'boxplot') {
      // 箱线图配置
      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        width: 600,
        height: 400,
        mark: 'boxplot',
        encoding: {
          x: { field: xAxis, type: 'nominal' },
          y: { field: yAxis, type: 'quantitative' }
        }
      };
    } else if (selectedChart.includes('heat')) {
      // 热力图配置
      const mark = selectedChart === 'circle' ? 'circle' : 'rect';
      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        width: 600,
        height: 400,
        mark,
        encoding: {
          x: { field: xAxis, type: 'nominal' },
          y: { field: yAxis, type: 'nominal' },
          size: { aggregate: 'count' },
          color: { aggregate: 'count' }
        }
      };
    } else if (selectedChart === 'bar+line') {
      // 柱状折线组合图
      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        width: 600,
        height: 400,
        layer: [
          {
            mark: 'bar',
            encoding: {
              x: { field: xAxis, type: 'nominal' },
              y: { field: yAxis, type: 'quantitative' }
            }
          },
          {
            mark: { type: 'line', color: 'red' },
            encoding: {
              x: { field: xAxis, type: 'nominal' },
              y: { field: yAxis, type: 'quantitative' }
            }
          }
        ]
      };
    } else if (selectedChart.startsWith('layer-')) {
      // 层叠图表
      const mark = selectedChart.replace('layer-', '');
      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        width: 600,
        height: 400,
        mark,
        encoding: {
          x: { field: xAxis, type: 'nominal' },
          y: { field: yAxis, type: 'quantitative', stack: 'zero' },
          color: { field: xAxis, type: 'nominal' }
        }
      };
    } else {
      // 基础图表通用配置
      chartSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        width: 600,
        height: 400,
        mark: selectedChart,
        encoding: {
          x: { 
            field: xAxis, 
            type: isNaN(data[0][xAxis]) ? 'nominal' : 'quantitative',
            title: xAxis
          },
          y: { 
            field: yAxis, 
            type: isNaN(data[0][yAxis]) ? 'nominal' : 'quantitative',
            title: yAxis
          }
        }
      };
    }

    setSpec(chartSpec);
  }, [selectedChart, xAxis, yAxis, data]);

  // 按类别分组的图表类型
  const groupedChartTypes = chartTypes.reduce((acc: { [key: string]: typeof chartTypes }, chart) => {
    const category = chart.category || '其他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(chart);
    return acc;
  }, {});

  return (
    <Modal title="生成图表" onClose={onClose} isOpen={isOpen}>
      <div className="flex h-[600px]">
        {/* 左侧配置区 */}
        <div className="w-64 border-r border-gray-200 dark:border-zinc-700 p-4 space-y-4">
          {/* 图表类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              图表类型
            </label>
            <select
              className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600 dark:text-gray-300"
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
            >
              {Object.entries(groupedChartTypes).map(([category, charts]) => (
                <optgroup key={category} label={category}>
                  {charts.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* X轴选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              X轴字段
            </label>
            <select
              className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600 dark:text-gray-300"
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
            >
              <option value="">请选择</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          {/* Y轴选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Y轴字段
            </label>
            <select
              className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600 dark:text-gray-300"
              value={yAxis}
              onChange={(e) => setYAxis(e.target.value)}
            >
              <option value="">请选择</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 右侧图表预览区 */}
        <div className="flex-1 p-4">
          {spec ? (
            <div className="border rounded-lg p-4 bg-white dark:bg-zinc-800">
              <VegaLite spec={spec} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              请选择图表类型和数据字段
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ChartGenerationModal;
