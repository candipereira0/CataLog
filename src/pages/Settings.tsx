import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { THEME_PRESETS } from "../lib/themes";
import { timeAgo } from "../lib/timeago";
import { api, type TipLink, type ArtistLink, type DeviceInfo } from "../lib/api";
import AppleMusicSettings from "../components/AppleMusicSettings";
import SpotifyConnect from "../components/SpotifyConnect";
import YouTubeConnect from "../components/YouTubeConnect";

const STRIPE_PRO_ANNUAL = "https://buy.stripe.com/3cIeVcaDZcrSdVd31O5Vu00";
const STRIPE_LIFETIME = "https://buy.stripe.com/aFa7sKfYjcrS18r31O5Vu01";

export default function Settings() {
  const { user } = useAuth();
  const { mode, preset, setMode, setPreset, toggleMode, resetToDefault } = useTheme();
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [dropboxMsg, setDropboxMsg] = useState<string | null>(null);

  // Profile editing state
  const [profileHandle, setProfileHandle] = useState(user?.handle || "");
  const [profileName, setProfileName] = useState(user?.display_name || "");
  const [profileBio, setProfileBio] = useState((user as Record<string, unknown> | null)?.["bio"] as string || "");
  const [profileCity, setProfileCity] = useState((user as Record<string, unknown> | null)?.["city"] as string || "");
  const [profileShowInMatches, setProfileShowInMatches] = useState(!!((user as Record<string, unknown> | null)?.["show_in_matches"]));
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [handleCheckMsg, setHandleCheckMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tip links state
  const [tipLinks, setTipLinks] = useState<TipLink[]>([]);
  const [tipLinksLoaded, setTipLinksLoaded] = useState(false);
  const [tipLinksSaving, setTipLinksSaving] = useState(false);
  const [tipLinksMsg, setTipLinksMsg] = useState<string | null>(null);

  // Device management state
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<number | null>(null);
  const [pushingPlaylist, setPushingPlaylist] = useState<string | null>(null);

  const loadTipLinks = useCallback(async () => {
    try {
      const data = await api.getMyTipLinks();
      setTipLinks(data.tip_links);
    } catch { /* ignore */ }
    setTipLinksLoaded(true);
  }, []);

  useEffect(() => { loadTipLinks(); }, [loadTipLinks]);

  // Load devices
  const loadDevices = useCallback(async () => {
    try {
      const data = await api.listDevices();
      setDevices(data.devices);
    } catch { /* ignore */ }
    setDevicesLoaded(true);
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleDeleteDevice = useCallback(async (deviceId: number) => {
    if (!confirm("Log out this device? It will be signed out.")) return;
    setDeletingDevice(deviceId);
    setDeviceMsg(null);
    try {
      await api.deleteDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setDeviceMsg("Device removed.");
      setTimeout(() => setDeviceMsg(null), 3000);
    } catch (err) {
      setDeviceMsg(err instanceof Error ? err.message : "Failed to remove device");
    } finally {
      setDeletingDevice(null);
    }
  }, []);

  const handlePushTest = useCallback(async (deviceId: number) => {
    setPushingPlaylist(`device-${deviceId}`);
    setDeviceMsg(null);
    try {
      // Use the first playlist or create a test event
      const playlists = await api.listPlaylists();
      if (playlists.playlists.length === 0) {
        setDeviceMsg("No playlists available for push test. Create a playlist first.");
        setTimeout(() => setDeviceMsg(null), 4000);
        return;
      }
      await api.pushPlaylistToDevice(deviceId, playlists.playlists[0].id);
      setDeviceMsg(`Push test sent to device!`);
      setTimeout(() => setDeviceMsg(null), 3000);
    } catch (err) {
      setDeviceMsg(err instanceof Error ? err.message : "Push test failed");
    } finally {
      setPushingPlaylist(null);
    }
  }, []);

  const checkHandle = useCallback(async (handle: string) => {
    if (!handle || handle.length < 3) {
      setHandleCheckMsg(null);
      return;
    }
    if (handle === user?.handle) {
      setHandleCheckMsg(null);
      return;
    }
    try {
      const result = await api.checkHandle(handle);
      if (result.available) {
        setHandleCheckMsg("✓ Available!");
      } else {
        setHandleCheckMsg("✗ Taken");
      }
    } catch {
      setHandleCheckMsg(null);
    }
  }, [user?.handle]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setProfileError(null);
    setProfileMsg(null);
    try {
      const fields: { handle?: string; display_name?: string; bio?: string; city?: string; show_in_matches?: boolean } = {};
      if (profileHandle !== (user?.handle || "")) fields.handle = profileHandle;
      if (profileName !== user?.display_name) fields.display_name = profileName;
      if (profileBio !== ((user as Record<string, unknown> | null)?.["bio"] as string || "")) fields.bio = profileBio;
      if (profileCity !== ((user as Record<string, unknown> | null)?.["city"] as string || "")) fields.city = profileCity;
      const currentShowInMatches = !!((user as Record<string, unknown> | null)?.["show_in_matches"]);
      if (profileShowInMatches !== currentShowInMatches) fields.show_in_matches = profileShowInMatches;

      if (Object.keys(fields).length === 0) {
        setProfileMsg("No changes to save.");
        return;
      }

      await api.updateProfile(fields);

      // Refresh the page so the auth context gets the updated user
      window.location.reload();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [profileHandle, profileName, profileBio, profileCity, profileShowInMatches, user]);

  // Tip link helpers
  const getLink = (platform: string): TipLink | undefined =>
    tipLinks.find((l) => l.platform === platform);

  const updateLink = (platform: string, handle: string, isActive: boolean) => {
    setTipLinks((prev) => {
      const existing = prev.find((l) => l.platform === platform);
      if (existing) {
        return prev.map((l) => l.platform === platform ? { ...l, handle_or_url: handle, is_active: isActive ? 1 : 0 } : l);
      }
      return [...prev, {
        id: 0, user_id: 0, platform, handle_or_url: handle,
        is_active: isActive ? 1 : 0, created_at: "",
      }];
    });
  };

  const saveTipLinks = useCallback(async () => {
    setTipLinksSaving(true);
    setTipLinksMsg(null);
    try {
      const links = tipLinks.map((l) => ({
        platform: l.platform,
        handle: l.handle_or_url,
        is_active: !!l.is_active,
      }));
      await api.updateMyTipLinks(links);
      setTipLinksMsg("Tip links saved!");
      setTimeout(() => setTipLinksMsg(null), 3000);
    } catch (err) {
      setTipLinksMsg(err instanceof Error ? err.message : "Failed to save tip links");
    } finally {
      setTipLinksSaving(false);
    }
  }, [tipLinks]);

  const tierLabel = user?.tier === "lifetime" ? "Lifetime" : user?.tier === "pro" ? "Pro" : "Free";
  const tierColor =
    user?.tier === "lifetime"
      ? "bg-amber-900/50 text-amber-300 border-amber-700"
      : user?.tier === "pro"
      ? "bg-violet-900/50 text-violet-300 border-violet-700"
      : "bg-gray-800 text-gray-300 border-gray-700";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your account and integrations.</p>
      </div>

      {/* Account section */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Email</p>
              <p className="text-sm text-gray-500">{user?.email || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">@Handle</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={profileHandle}
                onChange={(e) => {
                  setProfileHandle(e.target.value);
                  setHandleCheckMsg(null);
                }}
                onBlur={() => checkHandle(profileHandle)}
                placeholder="your-handle"
                className="input-field w-full sm:max-w-xs"
                maxLength={30}
                pattern="[a-zA-Z0-9_-]{3,30}"
              />
            </div>
            {handleCheckMsg && (
              <p className={`mt-1 text-xs ${handleCheckMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                {handleCheckMsg}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-600">3-30 characters: letters, numbers, underscores, hyphens.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Display Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your display name"
              className="input-field w-full sm:max-w-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Bio</label>
            <textarea
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="input-field w-full sm:max-w-md min-h-[80px] resize-y"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-600">{profileBio.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">City</label>
            <input
              type="text"
              value={profileCity}
              onChange={(e) => setProfileCity(e.target.value)}
              placeholder="Your city (for DJ matching)"
              className="input-field w-full sm:max-w-xs"
              maxLength={100}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Show me in DJ matches</p>
              <p className="text-xs text-gray-500">Let DJs with similar genre tastes find you</p>
            </div>
            <button
              type="button"
              onClick={() => setProfileShowInMatches(!profileShowInMatches)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                profileShowInMatches ? "bg-violet-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  profileShowInMatches ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {profileMsg && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-3">
              <p className="text-sm text-emerald-400">{profileMsg}</p>
            </div>
          )}
          {profileError && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-3">
              <p className="text-sm text-red-400">{profileError}</p>
            </div>
          )}

          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary text-xs"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* Subscription section */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Subscription</h2>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">Current Plan</p>
            <span className={`mt-1 inline-block rounded-full border px-3 py-1 text-sm font-medium ${tierColor}`}>
              {tierLabel}
            </span>
          </div>
        </div>

        {user?.tier === "free" && (
          <>
            <p className="mb-4 text-sm text-gray-400">
              Upgrade to unlock unlimited tracks, AI playlist generation, cloud sync, and more.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Pro Annual */}
              <div className="rounded-lg border border-violet-700/50 bg-violet-950/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">Pro Annual</p>
                    <p className="text-sm text-gray-400">$99/year (save 31%)</p>
                  </div>
                  <a
                    href={STRIPE_PRO_ANNUAL}
                    className="btn-primary py-1.5 text-xs inline-block"
                  >
                    Upgrade
                  </a>
                </div>
              </div>
              {/* Lifetime */}
              <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-4 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-400">Lifetime License</p>
                    <p className="text-sm text-gray-400">$299 one-time — all features, forever</p>
                  </div>
                  <a
                    href={STRIPE_LIFETIME}
                    className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors inline-block"
                  >
                    Buy Lifetime
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {user?.tier === "pro" && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-300">
              You're on the <span className="text-violet-400 font-semibold">Pro</span> plan.
              Want lifetime access instead?
            </p>
            <a
              href={STRIPE_LIFETIME}
              className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
            >
              Upgrade to Lifetime ($299)
            </a>
          </div>
        )}

        {user?.tier === "lifetime" && (
          <div className="rounded-lg border border-amber-700/30 bg-amber-950/10 p-4">
            <p className="text-sm text-amber-300">
              🎉 You have a <span className="font-semibold">Lifetime</span> license — all features unlocked, forever.
            </p>
          </div>
        )}

      </div>

      {/* Cloud Storage Integrations */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Cloud Storage</h2>
        <p className="mb-4 text-sm text-gray-400">
          Connect your cloud storage to sync your music library across devices.
        </p>

        {/* Google Drive */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14.25l-5.03-3.24v6.48L12 20.73l5.03-3.24v-6.48L12 14.25z" />
                <path d="M12 9.75l5.03 3.24L22 10.23 12 4 2 10.23l4.97 2.76L12 9.75z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">Google Drive</p>
              <p className="text-xs text-gray-500">Sync your library with Google Drive</p>
            </div>
          </div>
          <button
            onClick={() => setDriveMsg("Google Drive integration is coming soon! Stay tuned.")}
            className="btn-secondary py-1.5 text-xs"
          >
            Connect Drive
          </button>
        </div>

        {/* Dropbox */}
        <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600/20">
              <svg className="h-5 w-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 2l9 5.5L6 13 0 9.5 6 2zm0 13l9 5.5L6 24l-6-3.5L6 15zm12-2.5L24 9.5 18 6l-6 3.5 6 3zm0 8.5l6-3.5L18 14l-6 3.5 6 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">Dropbox</p>
              <p className="text-xs text-gray-500">Sync your library with Dropbox</p>
            </div>
          </div>
          <button
            onClick={() => setDropboxMsg("Dropbox integration is coming soon! Stay tuned.")}
            className="btn-secondary py-1.5 text-xs"
          >
            Connect Dropbox
          </button>
        </div>

        {/* Messages */}
        {driveMsg && (
          <div className="mt-4 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
            <p className="text-sm text-blue-400">{driveMsg}</p>
            <button
              onClick={() => setDriveMsg(null)}
              className="mt-1 text-xs text-blue-500 hover:text-blue-400"
            >
              Dismiss
            </button>
          </div>
        )}
        {dropboxMsg && (
          <div className="mt-4 rounded-lg border border-sky-800 bg-sky-900/20 p-3">
            <p className="text-sm text-sky-400">{dropboxMsg}</p>
            <button
              onClick={() => setDropboxMsg(null)}
              className="mt-1 text-xs text-sky-500 hover:text-sky-400"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Apple Music */}
      <AppleMusicSettings />

      {/* Spotify */}
      <SpotifyConnect />

      {/* YouTube */}
      <YouTubeConnect />

      {/* Theme */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Theme</h2>
        <p className="mb-4 text-sm text-gray-400">
          Customize the look and feel of CataLog. Pick a preset and toggle dark or light mode.
        </p>

        {/* Mode toggle */}
        <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-300">Mode</p>
            <p className="text-xs text-gray-500">
              {mode === "dark" ? "Dark mode is active" : "Light mode is active"}
            </p>
          </div>
          <button
            onClick={toggleMode}
            role="switch"
            aria-checked={mode === "dark"}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-gray-950 ${
              mode === "dark" ? "bg-violet-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ${
                mode === "dark" ? "translate-x-6" : "translate-x-1"
              }`}
            >
              {mode === "dark" ? (
                <svg className="h-3 w-3 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </span>
          </button>
        </div>

        {/* Preset grid */}
        <div>
          <p className="mb-3 text-sm font-medium text-gray-300">Presets</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* "None" / default option */}
            <button
              onClick={() => setPreset(null)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] ${
                preset === null
                  ? "border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-500/10"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              }`}
            >
              <div className="flex gap-1.5">
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: "#7c3aed" }}
                />
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: "#030712" }}
                />
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: "#111827" }}
                />
              </div>
              <span className="text-xs font-medium text-gray-300">Default</span>
              {preset === null && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Active
                </span>
              )}
            </button>

            {THEME_PRESETS.filter((p) => p.name !== "catalog-dark" && p.name !== "catalog-light").map(
              (p) => {
                const isActive = preset === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setPreset(p.name)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] ${
                      isActive
                        ? "border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex gap-1.5">
                      {p.swatches.map((color, i) => (
                        <span
                          key={i}
                          className="inline-block h-4 w-4 rounded-full shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-300">{p.label}</span>
                    {isActive && (
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Active
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Reset button */}
        {(preset !== null || mode !== "dark") && (
          <div className="mt-5 border-t border-gray-800 pt-4">
            <button
              onClick={resetToDefault}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
            >
              Reset to default theme
            </button>
          </div>
        )}
      </div>

      {/* Devices */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Devices</h2>
        <p className="mb-4 text-sm text-gray-400">
          Manage devices logged into your account. Your playlists sync between all devices.
        </p>

        {deviceMsg && (
          <div className={`mb-4 rounded-lg border p-3 ${
            deviceMsg.includes("Failed") || deviceMsg.includes("No playlists")
              ? "border-red-800 bg-red-900/20 text-red-400"
              : "border-emerald-800 bg-emerald-900/20 text-emerald-400"
          }`}>
            <p className="text-sm">{deviceMsg}</p>
          </div>
        )}

        {!devicesLoaded ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : devices.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No devices found. Log in from another device to see it here.</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const typeIcon =
                device.device_type === "phone" ? "📱" :
                device.device_type === "tablet" ? "📋" : "💻";
              const isCurrent = device.is_current;
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    isCurrent
                      ? "border-violet-700/50 bg-violet-950/20"
                      : "border-gray-700 bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeIcon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-200">{device.device_name}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Last seen: {timeAgo(device.last_seen)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCurrent && (
                      <>
                        <button
                          onClick={() => handlePushTest(device.id)}
                          disabled={pushingPlaylist === `device-${device.id}`}
                          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-violet-400 transition-colors disabled:opacity-50"
                        >
                          {pushingPlaylist === `device-${device.id}` ? "Pushing..." : "Push Test"}
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(device.id)}
                          disabled={deletingDevice === device.id}
                          className="rounded-lg border border-red-800/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          {deletingDevice === device.id ? "Removing..." : "Log Out"}
                        </button>
                      </>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-gray-500">This device</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tip Links */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Tip Links</h2>
        <p className="mb-4 text-sm text-gray-400">
          Set up how fans can tip you during gigs and on shared playlists. Your tip page:{" "}
          <span className="text-violet-400">catalog.app/tip/@{user?.handle || "yourhandle"}</span>
        </p>
        <div className="space-y-4">
          {/* Venmo */}
          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#008CFF]/20">
                <span className="text-lg font-bold text-[#008CFF]">V</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Venmo</p>
                <input
                  type="text"
                  value={getLink("venmo")?.handle_or_url || ""}
                  onChange={(e) => updateLink("venmo", e.target.value, getLink("venmo")?.is_active !== 0)}
                  placeholder="@username"
                  className="input-field mt-1 max-w-[180px] text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const link = getLink("venmo");
                updateLink("venmo", link?.handle_or_url || "", link?.is_active === 0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                getLink("venmo")?.is_active !== 0
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
                  : "bg-gray-700 text-gray-500 border border-gray-600"
              }`}
            >
              {getLink("venmo")?.is_active !== 0 ? "Active" : "Inactive"}
            </button>
          </div>

          {/* Cash App */}
          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00D632]/20">
                <span className="text-lg font-bold text-[#00D632]">$</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Cash App</p>
                <input
                  type="text"
                  value={getLink("cashapp")?.handle_or_url || ""}
                  onChange={(e) => updateLink("cashapp", e.target.value, getLink("cashapp")?.is_active !== 0)}
                  placeholder="$cashtag"
                  className="input-field mt-1 max-w-[180px] text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const link = getLink("cashapp");
                updateLink("cashapp", link?.handle_or_url || "", link?.is_active === 0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                getLink("cashapp")?.is_active !== 0
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
                  : "bg-gray-700 text-gray-500 border border-gray-600"
              }`}
            >
              {getLink("cashapp")?.is_active !== 0 ? "Active" : "Inactive"}
            </button>
          </div>

          {/* Zelle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6D28D9]/20">
                <span className="text-lg font-bold text-[#6D28D9]">Z</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Zelle</p>
                <input
                  type="text"
                  value={getLink("zelle")?.handle_or_url || ""}
                  onChange={(e) => updateLink("zelle", e.target.value, getLink("zelle")?.is_active !== 0)}
                  placeholder="email@example.com or phone"
                  className="input-field mt-1 max-w-[220px] text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const link = getLink("zelle");
                updateLink("zelle", link?.handle_or_url || "", link?.is_active === 0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                getLink("zelle")?.is_active !== 0
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
                  : "bg-gray-700 text-gray-500 border border-gray-600"
              }`}
            >
              {getLink("zelle")?.is_active !== 0 ? "Active" : "Inactive"}
            </button>
          </div>

          {/* PayPal */}
          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#003087]/20">
                <span className="text-lg font-bold text-[#009cde]">P</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">PayPal</p>
                <input
                  type="text"
                  value={getLink("paypal")?.handle_or_url || ""}
                  onChange={(e) => updateLink("paypal", e.target.value, getLink("paypal")?.is_active !== 0)}
                  placeholder="paypal.me/username"
                  className="input-field mt-1 max-w-[200px] text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const link = getLink("paypal");
                updateLink("paypal", link?.handle_or_url || "", link?.is_active === 0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                getLink("paypal")?.is_active !== 0
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
                  : "bg-gray-700 text-gray-500 border border-gray-600"
              }`}
            >
              {getLink("paypal")?.is_active !== 0 ? "Active" : "Inactive"}
            </button>
          </div>
        </div>

        {tipLinksMsg && (
          <div className={`mt-4 rounded-lg border p-3 ${tipLinksMsg.includes("saved") ? "border-emerald-800 bg-emerald-900/20" : "border-red-800 bg-red-900/20"}`}>
            <p className={`text-sm ${tipLinksMsg.includes("saved") ? "text-emerald-400" : "text-red-400"}`}>{tipLinksMsg}</p>
          </div>
        )}

        <button
          onClick={saveTipLinks}
          disabled={tipLinksSaving}
          className="btn-primary mt-4 text-xs"
        >
          {tipLinksSaving ? "Saving..." : "Save Tip Links"}
        </button>
      </div>

      {/* Artist Profile */}
      <ArtistProfileSection />

      {/* Storage Info */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Storage</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Storage used</p>
            <p className="text-sm text-gray-300">
              {user && (user as Record<string, unknown>).storage_used_bytes != null
                ? formatBytes(Number((user as Record<string, unknown>).storage_used_bytes))
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ArtistProfileSection() {
  const { user } = useAuth();

  const [isArtist, setIsArtist] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [links, setLinks] = useState<ArtistLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getArtistProfile()
      .then((data) => {
        if (data.profile) {
          setIsArtist(!!data.profile.is_artist);
          setArtistName(data.profile.artist_name || "");
        }
        setLinks(data.links || []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const getLink = (platform: string): ArtistLink | undefined =>
    links.find((l) => l.platform === platform);

  const updateLink = (platform: string, url: string) => {
    setLinks((prev) => {
      const existing = prev.find((l) => l.platform === platform);
      if (existing) {
        return prev.map((l) => l.platform === platform ? { ...l, url } : l);
      }
      return [...prev, { id: 0, user_id: 0, platform, url, created_at: "" }];
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateArtistProfile({
        is_artist: isArtist,
        artist_name: artistName,
        links: links.map((l) => ({ platform: l.platform, url: l.url })),
      });
      setMsg("Artist profile saved! Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="card mb-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-200">Artist Profile</h2>
      <p className="mb-4 text-sm text-gray-400">
        Enable your artist profile to upload tracks and share your music with the CataLog community.
      </p>

      <div className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">Enable Artist Profile</p>
            <p className="text-xs text-gray-500">Upload original tracks to your profile</p>
          </div>
          <button
            type="button"
            onClick={() => setIsArtist(!isArtist)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              isArtist ? "bg-violet-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                isArtist ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {isArtist && (
          <>
            {/* Artist name */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">Artist Name</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder={user?.display_name || "Your artist name"}
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-gray-600">Can be different from your display name.</p>
            </div>

            {/* Links */}
            <div>
              <label className="mb-2 block text-xs text-gray-500">External Links</label>
              <div className="space-y-3">
                {/* SoundCloud */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500">SoundCloud</span>
                  <input
                    type="url"
                    value={getLink("soundcloud")?.url || ""}
                    onChange={(e) => updateLink("soundcloud", e.target.value)}
                    placeholder="https://soundcloud.com/..."
                    className="input-field flex-1 text-xs"
                  />
                </div>
                {/* Bandcamp */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500">Bandcamp</span>
                  <input
                    type="url"
                    value={getLink("bandcamp")?.url || ""}
                    onChange={(e) => updateLink("bandcamp", e.target.value)}
                    placeholder="https://...bandcamp.com"
                    className="input-field flex-1 text-xs"
                  />
                </div>
                {/* Instagram */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500">Instagram</span>
                  <input
                    type="url"
                    value={getLink("instagram")?.url || ""}
                    onChange={(e) => updateLink("instagram", e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="input-field flex-1 text-xs"
                  />
                </div>
                {/* Website */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500">Website</span>
                  <input
                    type="url"
                    value={getLink("website")?.url || ""}
                    onChange={(e) => updateLink("website", e.target.value)}
                    placeholder="https://..."
                    className="input-field flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {msg && (
          <div className={`rounded-lg border p-3 ${msg.includes("saved") ? "border-emerald-800 bg-emerald-900/20" : "border-red-800 bg-red-900/20"}`}>
            <p className={`text-sm ${msg.includes("saved") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="btn-primary text-xs"
        >
          {saving ? "Saving..." : "Save Artist Profile"}
        </button>
      </div>
    </div>
  );
}
