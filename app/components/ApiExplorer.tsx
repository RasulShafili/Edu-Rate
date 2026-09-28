"use client";

import { Braces, CheckCircle2, Copy, ExternalLink, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";

const endpointGroups = [
  {
    title: "Sistem",
    endpoints: [
      { method: "GET", path: "/api/health", description: "API xidmətinin işləkliyini yoxlayır." },
      { method: "POST", path: "/api/reviews/validate", description: "Müəllim üçün dörd rəqəmsal qiymətləndirmə meyarını yoxlayır." },
    ],
  },
  {
    title: "Autentifikasiya",
    endpoints: [
      { method: "POST", path: "/api/auth/signup", description: "Yeni tələbə hesabı yaradır." },
      { method: "POST", path: "/api/auth/login", description: "E-poçt və şifrə ilə sessiya açır." },
      { method: "GET", path: "/api/auth/session", description: "Cari sessiya məlumatını qaytarır." },
      { method: "PATCH", path: "/api/auth/profile", description: "Daxil olmuş istifadəçinin profilini yeniləyir." },
    ],
  },
  {
    title: "İdarəetmə",
    endpoints: [
      { method: "GET", path: "/api/admin/overview", description: "İdarəetmə panelinin xülasəsini qaytarır." },
      { method: "GET · POST", path: "/api/admin/users", description: "İstifadəçiləri siyahılayır və yaradır." },
      { method: "GET · POST", path: "/api/admin/clubs", description: "Klubları siyahılayır və yaradır." },
      { method: "GET · POST", path: "/api/admin/events", description: "Tədbirləri siyahılayır və yaradır." },
    ],
  },
] as const;

export function ApiExplorer() {
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [copied, setCopied] = useState(false);

  async function testHealth() {
    setStatus("loading");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body = await response.json();
      setResult(JSON.stringify(body, null, 2));
      setStatus(response.ok ? "success" : "error");
    } catch {
      setResult(JSON.stringify({ error: "API xidmətinə qoşulmaq mümkün olmadı." }, null, 2));
      setStatus("error");
    }
  }

  async function copySpecUrl() {
    await navigator.clipboard?.writeText(`${window.location.origin}/api/openapi.json`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <main id="main-content" className="api-explorer route-page" tabIndex={-1}>
      <section className="api-explorer-hero" aria-labelledby="api-explorer-title">
        <span><Braces size={16} aria-hidden="true" /> OpenAPI 3.1</span>
        <h1 id="api-explorer-title">EduRate API sənədləri</h1>
        <p>
          Sprint MVP üçün hazırlanan endpoint-lər, standart cavab forması və
          frontend inteqrasiyası burada açıq şəkildə göstərilir.
        </p>
        <div className="api-explorer-actions">
          {/* `<Link>` deyil: Next onu səhifə sayıb RSC prefetch edirdi, API marşrutu
              RSC qaytarmadığı üçün sorğu asılı qalır və səhifə yüklənməni bitirmirdi. */}
          <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="kuds-primary-button">
            JSON sənədini aç <ExternalLink size={16} aria-hidden="true" />
          </a>
          <button type="button" className="api-secondary-button" onClick={() => void copySpecUrl()}>
            <Copy size={16} aria-hidden="true" /> {copied ? "Kopyalandı" : "Sənəd URL-ni kopyala"}
          </button>
        </div>
      </section>

      <section className="api-test-panel" aria-labelledby="api-test-title">
        <div>
          <span><ShieldCheck size={15} aria-hidden="true" /> Canlı yoxlama</span>
          <h2 id="api-test-title">API sağlamlıq testi</h2>
          <p>Bu düymə lokal və ya deploy edilmiş API-nin cavab verdiyini dərhal yoxlayır.</p>
        </div>
        <button type="button" className="kuds-primary-button" disabled={status === "loading"} onClick={() => void testHealth()}>
          {status === "loading" ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {status === "loading" ? "Yoxlanılır…" : "GET /api/health"}
        </button>
        {result && (
          <pre className={`api-test-result is-${status}`} aria-live="polite">
            {status === "success" && <CheckCircle2 size={15} aria-hidden="true" />}
            <code>{result}</code>
          </pre>
        )}
      </section>

      <section className="api-endpoint-groups" aria-label="API endpoint-ləri">
        {endpointGroups.map((group) => (
          <article key={group.title} className="api-endpoint-group">
            <h2>{group.title}</h2>
            <div>
              {group.endpoints.map((endpoint) => (
                <div key={`${endpoint.method}-${endpoint.path}`} className="api-endpoint-row">
                  <span className={`api-method is-${endpoint.method.split(" ")[0].toLocaleLowerCase("en-US")}`}>{endpoint.method}</span>
                  <code>{endpoint.path}</code>
                  <p>{endpoint.description}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
