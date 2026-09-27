import { useState, useEffect } from "react";
import { Download, X, Smartphone, Monitor, Share } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────── */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop" | null;

/* ─── Detect platform ──────────────────────────────────────────────── */
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (typeof window !== "undefined" && window.innerWidth >= 768) return "desktop";
  return null;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true)
  );
}

/* ─── CSS ──────────────────────────────────────────────────────────── */
const CSS = `
@keyframes kpwa-slide-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.kpwa-banner {
  position: fixed;
  bottom: 80px; /* above bottom nav tab strip */
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
  padding: 18px 18px 18px 20px;
  z-index: 9999;
  animation: kpwa-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
  border: 1px solid rgba(6,95,70,0.10);
}

.kpwa-banner-top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.kpwa-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.kpwa-text {
  flex: 1;
  min-width: 0;
}

.kpwa-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.2px;
  line-height: 1.2;
}

.kpwa-sub {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  margin-top: 3px;
  line-height: 1.4;
}

.kpwa-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 2px;
  border-radius: 6px;
  flex-shrink: 0;
  margin-top: -2px;
}

.kpwa-close:hover { color: #374151; background: #f3f4f6; }

.kpwa-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.kpwa-btn-install {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 11px 0;
  background: #065f46;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: background 0.15s;
}

.kpwa-btn-install:hover { background: #047857; }

.kpwa-btn-later {
  padding: 11px 18px;
  background: #f3f4f6;
  color: #6b7280;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.kpwa-btn-later:hover { background: #e5e7eb; }

/* iOS share sheet instructions */
.kpwa-ios-steps {
  margin-top: 12px;
  padding: 12px 14px;
  background: #f8faf9;
  border-radius: 12px;
  border: 1px solid rgba(6,95,70,0.10);
}

.kpwa-ios-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #374151;
  font-weight: 500;
  line-height: 1.4;
}

.kpwa-ios-step + .kpwa-ios-step {
  margin-top: 8px;
}

.kpwa-ios-step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #065f46;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpwa-share-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #0a84ff;
  border-radius: 5px;
  vertical-align: middle;
}

/* Desktop — wider layout */
@media (min-width: 768px) {
  .kpwa-banner {
    bottom: 32px;
    left: auto;
    right: 32px;
    transform: none;
    max-width: 380px;
  }
}
`;

/* ─── Component ────────────────────────────────────────────────────── */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isInStandaloneMode()) return;
    if (dismissed) return;

    const p = detectPlatform();
    setPlatform(p);

    // Chrome/Edge/Android — catch the native prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so it doesn't pop immediately on page load
      setTimeout(() => setVisible(true), 4000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS — show manual instructions after a delay (no native prompt on iOS)
    if (p === "ios") {
      setTimeout(() => setVisible(true), 5000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } else if (platform === "ios") {
      setShowIOSSteps(true);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="kpwa-banner" role="dialog" aria-label="Install KEWT app">
        <div className="kpwa-banner-top">
          <img src="/kewt_icon_light.png" alt="KEWT icon" className="kpwa-icon" />
          <div className="kpwa-text">
            <div className="kpwa-title">
              Install <em style={{ fontStyle: "italic", color: "var(--color-primary)" }}>KEWT</em>
            </div>
            <div className="kpwa-sub">
              {platform === "desktop"
                ? "Add to your desktop for instant access — no browser needed."
                : "Add to your home screen for a native app experience."}
            </div>
          </div>
          <button className="kpwa-close" onClick={handleDismiss} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>

        {/* iOS manual steps */}
        {showIOSSteps && platform === "ios" && (
          <div className="kpwa-ios-steps">
            <div className="kpwa-ios-step">
              <span className="kpwa-ios-step-num">1</span>
              <span>
                Tap the{" "}
                <span className="kpwa-share-icon">
                  <Share size={13} color="#fff" />
                </span>{" "}
                Share button in Safari
              </span>
            </div>
            <div className="kpwa-ios-step">
              <span className="kpwa-ios-step-num">2</span>
              <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
            </div>
            <div className="kpwa-ios-step">
              <span className="kpwa-ios-step-num">3</span>
              <span>Tap <strong>Add</strong> to confirm</span>
            </div>
          </div>
        )}

        <div className="kpwa-actions">
          <button className="kpwa-btn-install" onClick={handleInstall}>
            {platform === "desktop"
              ? <><Monitor size={15} /> Install on Desktop</>
              : platform === "ios"
              ? <><Share size={15} /> {showIOSSteps ? "Got it" : "How to Install"}</>
              : <><Download size={15} /> Add to Home Screen</>
            }
          </button>
          <button className="kpwa-btn-later" onClick={handleDismiss}>
            Not now
          </button>
        </div>
      </div>
    </>
  );
}
