"use client";

import { ChartComponent } from "@/components/Charts/ChartComponent";
import { StockNewsCard } from "@/components/StockNewsCard";


export default function Home() {

    const data = [
        { time: "2018-12-22", value: 32.51 },
        { time: "2018-12-23", value: 31.11 },
        { time: "2018-12-24", value: 27.02 },
        { time: "2018-12-25", value: 27.32 },
        { time: "2018-12-26", value: 25.17 },
        { time: "2018-12-27", value: 28.89 },
        { time: "2018-12-28", value: 25.46 },
        { time: "2018-12-29", value: 23.92 },
        { time: "2018-12-30", value: 22.68 },
        { time: "2018-12-31", value: 22.67 },
    ];


    return (
        <div className="flex justify-center items-center min-h-screen bg-neutral-950">
            <div className="grid grid-cols-[2fr_1fr] gap-8 w-[80%] max-w-7xl p-8 bg-neutral-950">
                {/* --- Left Column --- */}
                <div className="flex flex-col gap-6">
                    {/* Chart Card */}
                    <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg">
                        <h2 className="text-gray-100 text-lg font-medium mb-2">
                            The markets are neutral
                        </h2>
                        <ChartComponent data={data} />
                    </div>

                    {/* Sectors Card */}
                    <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-gray-100 text-lg font-medium mb-2">Sectors</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-gray-300">
                                <span>Healthcare</span>
                                <span className="text-green-400">+0.88%</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>Financial</span>
                                <span className="text-green-400">+0.65%</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>Technology</span>
                                <span className="text-red-400">−1.02%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Right Column --- */}
                <div className="flex flex-col gap-6">
                    {[1,2,3,4].map(i => (
                        <StockNewsCard
                            logoUrl="/logos/nvidia.png"
                            ticker="NVDA"
                            change={-2.60}
                            timeAgo="1h ago"
                            news="Chinese firms boost Nvidia's H20 chip orders, driven by rising demand for DeepSeek's AI models, according to sources."
                        />
                    ))}

                </div>

                {/*
                    <div className="flex flex-col gap-6">
                        <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg">
                            <h3 className="text-gray-100 font-medium mb-4">Upcoming Earnings</h3>
                            <ul className="space-y-2 text-gray-300">
                                <li className="flex justify-between">
                                    <span>NVIDIA</span>
                                    <span>Feb 27, 5:00 AM</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Salesforce</span>
                                    <span>Feb 27, 5:00 AM</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg text-gray-300">
                            Spain’s Argentina unit sold for $1.245B.
                        </div>

                        <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg text-gray-300">
                            Regeneron’s experimental gene therapy improved hearing in children.
                        </div>
                    </div>
                */}
            </div>
        </div>
    );
}
