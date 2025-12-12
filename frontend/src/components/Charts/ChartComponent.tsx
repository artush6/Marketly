"use client";

import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import React, { useEffect, useRef } from "react";

export const ChartComponent = ({
  data,
  colors = {
    backgroundColor: "#171717",
    lineColor: "#26a69a",
    textColor: "white",
    areaTopColor: "rgba(38, 166, 154, 0.5)",
    areaBottomColor: "rgba(38, 166, 154, 0.05)",
  },
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: "#222" },
        horzLines: { color: "#222" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 260,
    });

    // ✅ new syntax
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: colors.lineColor,
      topColor: colors.areaTopColor,
      bottomColor: colors.areaBottomColor,
    });

    areaSeries.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, colors]);

  return <div ref={chartContainerRef} className="w-full h-64 rounded-xl" />;
};
