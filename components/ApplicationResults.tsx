"use client";

import {
  Clipboard,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { ApplicationGenerationResult } from "@/types/application";
import type { Locale } from "@/types/locale";

type ApplicationResultsProps = {
  result: ApplicationGenerationResult;
  locale: Locale;
};

function CopyButton({ value, label, locale }: { value: string; label: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="copy-button is-compact"
      aria-label={locale === "ko" ? `${label} 신청 문구 복사` : `Copy ${label} application message`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_600);
      }}
    >
      {copied ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}
      {copied ? (locale === "ko" ? "복사됨" : "Copied") : (locale === "ko" ? "복사" : "Copy")}
    </button>
  );
}

export function ApplicationResults({ result, locale }: ApplicationResultsProps) {
  return (
    <div className="apply-results">
      <section className="apply-messages" aria-labelledby="application-messages-title">
        <div className="result-heading">
          <div>
            <span>02 / QWEN CLOUD</span>
            <h2 id="application-messages-title">{locale === "ko" ? "신청 한마디" : "Application message"}</h2>
          </div>
          <span className="evidence-badge is-purple">
            <Sparkles size={13} /> {result.source.mode === "real" ? (locale === "ko" ? "실시간 생성" : "Live generated") : (locale === "ko" ? "데모 생성" : "Demo generated")}
          </span>
        </div>

        <div className="apply-message-grid">
          {result.variants.slice(0, 1).map((variant) => (
            <article className="result-card application-card apply-message" key={variant.label}>
              <div className="apply-message-actions">
                <CopyButton value={variant.message} label={variant.label} locale={locale} />
              </div>
              <blockquote>{variant.message}</blockquote>
              <div className="generated-source">
                <Sparkles size={14} /> {locale === "ko" ? "공고 + 공개 검색 기반 · 방문 전 표현" : "Brief + public research · Pre-visit language"}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
