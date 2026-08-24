"use client";

import { useEffect, useState } from "react";
import type { IntegrationHealth } from "@/types/integrations";
import type { Locale } from "@/types/locale";

const fallbackLabels = ["Bright Data", "Nosana", "Qwen Cloud", "Daytona"];
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function IntegrationStatus({ locale }: { locale: Locale }) {
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
      <span className="integration-label">{locale === "ko" ? "연동 상태" : "INTEGRATIONS"}</span>
      <div className="integration-list">
        {visible.map((item) => (
          <span className="integration-item" key={item.name} title={item.detail}>
            <i className={`status-dot status-${item.state}`} />
            {item.label}
            <small>{item.state === "demo" ? (locale === "ko" ? "데모" : "Demo") : item.state === "missing" ? (locale === "ko" ? "키 필요" : "Needs key") : item.state === "configured" ? (locale === "ko" ? "준비" : "Ready") : item.state === "connected" ? (locale === "ko" ? "연결됨" : "Live") : (locale === "ko" ? "확인 중" : "Checking")}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
