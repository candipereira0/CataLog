import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type TipLink } from "../lib/api";

export default function TipLanding() {
  const { handle } = useParams<{ handle: string }>();
  const [djName, setDjName] = useState("");
  const [djHandle, setDjHandle] = useState("");
  const [links, setLinks] = useState<TipLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setError(null);
    api.getPublicTipLinks(handle)
      .then((data) => {
        setDjName(data.user.display_name);
        setDjHandle(data.user.handle || "");
        setLinks(data.tip_links);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "DJ not found");
      })
      .finally(() => setLoading(false));
  }, [handle]);

  const getPlatformInfo = (platform: string) => {
    switch (platform) {
      case "venmo":
        return { color: "bg-[#008CFF] hover:bg-[#0073e6]", label: "Tip on Venmo" };
      case "cashapp":
        return { color: "bg-[#00D632] hover:bg-[#00b82a]", label: "Tip on Cash App" };
      case "zelle":
        return { color: "bg-[#6D28D9] hover:bg-[#5b21b6]", label: "Send via Zelle" };
      case "paypal":
        return { color: "bg-[#003087] hover:bg-[#002266]", label: "Tip via PayPal" };
      default:
        return { color: "bg-violet-600 hover:bg-violet-500", label: `Tip via ${platform}` };
    }
  };

  const getDeepLink = (link: TipLink, name: string) => {
    switch (link.platform) {
      case "venmo":
        return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(link.handle_or_url)}&amount=0&note=${encodeURIComponent(`Tip for ${name}`)}`;
      case "cashapp":
        return `https://cash.app/${encodeURIComponent(link.handle_or_url.replace(/^\$/, ""))}`;
      case "paypal":
        return `https://paypal.me/${encodeURIComponent(link.handle_or_url.replace(/^https?:\/\/paypal\.me\//, ""))}`;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (error || links.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-950 px-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-2xl">
          💸
        </div>
        <h1 className="text-2xl font-bold text-white">
          {error ? "DJ Not Found" : "No Tip Links Set Up"}
        </h1>
        <p className="mt-2 text-gray-400">
          {error || "This DJ hasn't set up their tip links yet."}
        </p>
        <Link to="/" className="btn-primary mt-6">Back to CataLog</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        {/* Avatar */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-3xl font-bold text-white">
          {djName.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-white">Support {djName}</h1>
        <p className="mt-1 text-violet-400">@{djHandle}</p>

        <div className="mt-8 space-y-3">
          {links.map((link) => {
            const info = getPlatformInfo(link.platform);
            const deepLink = getDeepLink(link, djName);

            if (link.platform === "zelle") {
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    navigator.clipboard.writeText(link.handle_or_url).catch(() => {});
                    const btn = document.activeElement as HTMLElement;
                    if (btn) {
                      const orig = btn.innerText;
                      btn.innerText = "Copied!";
                      setTimeout(() => { btn.innerText = orig; }, 1500);
                    }
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] ${info.color}`}
                >
                  <span>{info.label}: </span>
                  <span className="font-mono text-xs opacity-80">{link.handle_or_url}</span>
                </button>
              );
            }

            return (
              <a
                key={link.id}
                href={deepLink || `https://${link.handle_or_url}`}
                target={deepLink ? "_self" : "_blank"}
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] ${info.color}`}
              >
                {info.label} →
              </a>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-gray-600">
          Powered by <Link to="/" className="text-violet-400 hover:text-violet-300">CataLog</Link>
        </p>
      </div>
    </div>
  );
}
