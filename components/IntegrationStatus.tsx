"use client";

import { useEffect, useState } from "react";
import type { IntegrationHealth } from "@/types/integrations";

const fallbackLabels = ["Bright Data", "Nosana", "Qwen Cloud", "Daytona"];
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export function IntegrationStatus() {
  const [items, setItems] = useState<IntegrationHealth[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(DEMO_MODE ? "/api/health" : "/api/health?probe=true", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Health check failed"))))
      .then((payload) => setItems(payload.integrations ?? []))
      .catch(() => setItems([]));
    return () => controller.abort();
  }, []);

  const visible = items.length
    ? items
    : fallbackLabels.map((label, index) => ({
        name: String(index),
        label,
        state: "unavailable",
        detail: "Checking…",
        checkedAt: "",
      }));

  return (
    <div className="integration-status">
      <span className="integration-label">INTEGRATIONS</span>
      <div className="integration-list">
        {visible.map((item) => (
          <span className="integration-item" key={item.name} title={item.detail}>
            <i className={`status-dot status-${item.state}`} />
            {item.label}
            <small>{item.state === "demo" ? "Demo" : item.state === "missing" ? "Needs key" : item.state === "configured" ? "Ready" : item.state === "connected" ? "Live" : "Checking"}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
