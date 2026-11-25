"use client";

import { useEffect, useRef } from "react";
import { init, use } from "echarts/core";
import { GridComponent, TooltipComponent } from "echarts/components";
import { LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import type { HistoryPoint } from "../lib/market-types";

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export default function TrendChart({ points }: { points: HistoryPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = init(ref.current);
    chart.setOption({
      animation: false,
      grid: { left: 47, right: 18, top: 16, bottom: 31 },
      tooltip: { trigger: "axis", renderMode: "richText" },
      xAxis: {
        type: "category",
        data: points.map((p) => p.period),
        axisLine: { lineStyle: { color: "#c4d1cb" } },
        axisLabel: { color: "#546672", hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%", color: "#546672" },
        splitLine: { lineStyle: { color: "#e4eae5" } },
      },
      series: [
        {
          name: "職缺占比（%）",
          type: "line",
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 3, color: "#386e6d" },
          itemStyle: { color: "#386e6d" },
          data: points.map((p) => (p.total ? Math.round((1000 * p.matching) / p.total) / 10 : null)),
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [points]);
  return <div className="atlas-trend-canvas" ref={ref} aria-hidden="true" />;
}
