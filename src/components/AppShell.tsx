import type { ReactNode } from "react";
import { legalLinks, repoUrl } from "../data/publicBuilderContent";
import type { BackendStatus } from "../types";
import { PageDecoration } from "./PageDecoration";

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
    <>
      <PageDecoration />
      <main className="appShell">
        <header className="topbar">
        <a className="brandRow" href="/" aria-label="Matix Agent Builder home">
          <span className="mark" aria-hidden="true" role="img" />

          <span className="brand">
            <span className="brandName">Matix Agent Builder</span>
            <span className="brandTag">Public preview</span>
          </span>
        </a>
        <div className="topbarRight">
          <nav className="topbarNav" aria-label="Primary">
            <a href={`${repoUrl}#readme`} rel="noreferrer noopener" target="_blank">
              How it works
            </a>
            <a href={repoUrl} rel="noreferrer noopener" target="_blank">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                aria-hidden="true"
                fill="currentColor"
              >
                <path d="M8 .2A7.8 7.8 0 0 0 .2 8c0 3.45 2.24 6.38 5.34 7.41.39.07.53-.17.53-.38v-1.34c-2.17.47-2.63-1.05-2.63-1.05-.36-.9-.88-1.14-.88-1.14-.71-.49.06-.48.06-.48.79.06 1.2.81 1.2.81.7 1.2 1.84.85 2.29.65.07-.51.27-.85.5-1.05-1.74-.2-3.56-.87-3.56-3.87 0-.85.31-1.55.81-2.1-.08-.2-.35-1 .08-2.08 0 0 .67-.21 2.18.8a7.6 7.6 0 0 1 3.97 0c1.51-1.01 2.18-.8 2.18-.8.43 1.08.16 1.88.08 2.08.51.55.81 1.25.81 2.1 0 3.01-1.82 3.67-3.56 3.87.28.24.53.71.53 1.44v2.13c0 .21.14.46.54.38A7.8 7.8 0 0 0 15.8 8 7.8 7.8 0 0 0 8 .2z" />
              </svg>
              GitHub
            </a>
          </nav>
          <div className="topbarStatus" aria-live="polite">
            <span className={`statusPill statusPill-${backendTone(backend)}`}>
              <span className="statusDot" aria-hidden="true" />
              {backendLabel(backend)}
            </span>
          </div>
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
    </>
  );
}
