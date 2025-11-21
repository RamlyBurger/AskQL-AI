"use client";

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartConfig {
  type: "line" | "bar" | "pie" | "doughnut" | "scatter";
  title?: string;
  x_axis_label?: string;
  y_axis_label?: string;
  data: {
    labels?: string[];
    datasets: Array<{
      label: string;
      data: number[] | Array<{ x: number; y: number }>;
      backgroundColor?: string | string[];
      borderColor?: string;
    }>;
  };
}

interface ChartRendererProps {
  config: ChartConfig;
}

const COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export function ChartRenderer({ config }: ChartRendererProps) {
  // Safety check for null/undefined config
  if (!config || !config.type || !config.data) {
    return (
      <div className="text-sm text-red-500">Invalid chart configuration</div>
    );
  }

  // Transform data for Recharts format
  const transformData = () => {
    if (config.type === "pie" || config.type === "doughnut") {
      // For pie charts, combine labels with first dataset
      return (config.data.labels || []).map((label, index) => ({
        name: label,
        value: (config.data.datasets[0]?.data[index] as number) || 0,
      }));
    } else if (config.type === "scatter") {
      // Scatter charts already have x-y data in the datasets
      // Return the data as-is since each dataset has its own x-y pairs
      return config.data.datasets[0]?.data || [];
    } else {
      // For other charts, create objects with label as key
      return (config.data.labels || []).map((label, index) => {
        const dataPoint: any = { name: label };
        config.data.datasets.forEach((dataset) => {
          dataPoint[dataset.label] = (dataset.data[index] as number) || 0;
        });
        return dataPoint;
      });
    }
  };

  const chartData = transformData();

  const renderChart = () => {
    switch (config.type) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                label={
                  config.x_axis_label
                    ? {
                        value: config.x_axis_label,
                        position: "insideBottom",
                        offset: -5,
                      }
                    : undefined
                }
              />
              <YAxis
                label={
                  config.y_axis_label
                    ? {
                        value: config.y_axis_label,
                        angle: -90,
                        position: "insideLeft",
                      }
                    : undefined
                }
              />
              <Tooltip />
              <Legend />
              {config.data.datasets.map((dataset, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                label={
                  config.x_axis_label
                    ? {
                        value: config.x_axis_label,
                        position: "insideBottom",
                        offset: -5,
                      }
                    : undefined
                }
              />
              <YAxis
                label={
                  config.y_axis_label
                    ? {
                        value: config.y_axis_label,
                        angle: -90,
                        position: "insideLeft",
                      }
                    : undefined
                }
              />
              <Tooltip />
              <Legend />
              {config.data.datasets.map((dataset, index) => (
                <Bar
                  key={index}
                  dataKey={dataset.label}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "doughnut":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={config.type === "doughnut" ? 120 : 150}
                innerRadius={config.type === "doughnut" ? 60 : 0}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={config.x_axis_label || "X"}
                label={{
                  value: config.x_axis_label || "X",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={config.y_axis_label || "Value"}
                label={{
                  value: config.y_axis_label || "Value",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              {config.data.datasets.map((dataset, index) => (
                <Scatter
                  key={index}
                  name={dataset.label}
                  data={dataset.data as Array<{ x: number; y: number }>}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            Unsupported chart type: {config.type}
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {config.title && (
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
          {config.title}
        </h3>
      )}
      {renderChart()}
    </div>
  );
}
