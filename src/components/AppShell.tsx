import type { ReactNode } from "react";
import { legalLinks } from "../data/publicBuilderContent";
import type { BackendStatus } from "../types";

function backendLabel(backend: BackendStatus): string {
  if (backend.state === "checking") return "Connecting";
  if (backend.state === "ready") return `Backend / ${backend.env}`;
  if (backend.state === "not_configured") return "Backend not configured";
  return "Backend unreachable";
}

function backendTone(backend: BackendStatus): string {
  if (backend.state === "ready") return "ok";
  if (backend.state === "checking") return "info";
  return "warn";
}

export function AppShell({
  backend,
  children,
}: {
  backend: BackendStatus;
  children: ReactNode;
}) {
  return (
    <main className="appShell">
      <header className="topbar">
        <a className="brandRow" href="/" aria-label="Matix Agent Builder home">
          <span className="mark" aria-hidden="true">
            M
          </span>
          <span className="brand">
            <span className="brandName">Matix Agent Builder</span>
            <span className="brandTag">Public preview</span>
          </span>
        </a>
        <div className="topbarStatus" aria-live="polite">
          <span className={`statusPill statusPill-${backendTone(backend)}`}>
            <span className="statusDot" aria-hidden="true" />
            {backendLabel(backend)}
          </span>
        </div>
      </header>

      {children}

      <footer className="footer">
        <span>Matix Agent Builder / Public preview</span>
        <nav className="footerLinks" aria-label="Public project links">
          {legalLinks.map((link) => (
            <a
              href={link.href}
              key={link.label}
              rel="noreferrer noopener"
              target="_blank"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
    </main>
  );
}
