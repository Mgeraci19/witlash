"use client";

import { useState } from "react";

interface VipControlsPanelProps {
    children: React.ReactNode;
}

export function VipControlsPanel({ children }: VipControlsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mt-4 border-t border-gray-200 pt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 rounded-lg text-gray-600 font-medium"
            >
                <span>VIP Controls</span>
                <span className="text-lg">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                    {children}
                </div>
            )}
        </div>
    );
}
