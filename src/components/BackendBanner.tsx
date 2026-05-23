import type { BackendStatus } from "../types";

export function BackendBanner({ backend }: { backend: BackendStatus }) {
  if (backend.state === "not_configured") {
    return (
      <div className="banner banner-warn" role="status">
        <strong>Backend not configured.</strong> Set{" "}
        <code>MATIX_PUBLIC_API_BASE</code> to the public backend endpoint to
        enable previews and example JSON downloads.
      </div>
    );
  }

  if (backend.state === "unreachable") {
    return (
      <div className="banner banner-error" role="alert">
        <strong>Public server unreachable.</strong> {backend.detail}
      </div>
    );
  }

  return null;
}
