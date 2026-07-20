import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Venue, type Gig } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function parseEquipment(venue: Venue): string[] {
  try {
    return JSON.parse(venue.equipment_json || "[]") as string[];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    scheduled: "bg-blue-600/20 text-blue-300",
    confirmed: "bg-emerald-600/20 text-emerald-300",
    completed: "bg-gray-600/20 text-gray-300",
    cancelled: "bg-red-600/20 text-red-300",
  };
  return colors[status] || colors.scheduled;
}

export default function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create gig modal
  const [showCreateGig, setShowCreateGig] = useState(false);
  const [gigTitle, setGigTitle] = useState("");
  const [gigTheme, setGigTheme] = useState("");
  const [gigDate, setGigDate] = useState("");
  const [gigStartTime, setGigStartTime] = useState("");
  const [gigEndTime, setGigEndTime] = useState("");
  const [creatingGig, setCreatingGig] = useState(false);
  const [gigError, setGigError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [venueData, gigsData] = await Promise.all([
        api.getVenue(parseInt(id)),
        api.getVenueGigs(parseInt(id)),
      ]);
      setVenue(venueData.venue);
      setGigs(gigsData.gigs);
    } catch (err) {
      setError("Failed to load venue details.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !gigTitle.trim() || !gigDate) return;
    setCreatingGig(true);
    setGigError(null);
    try {
      await api.createGig(parseInt(id), {
        title: gigTitle.trim(),
        theme: gigTheme.trim() || undefined,
        date: gigDate,
        start_time: gigStartTime || undefined,
        end_time: gigEndTime || undefined,
      });
      setShowCreateGig(false);
      setGigTitle("");
      setGigTheme("");
      setGigDate("");
      setGigStartTime("");
      setGigEndTime("");
      await fetchData();
    } catch (err) {
      setGigError(err instanceof Error ? err.message : "Failed to create gig");
    } finally {
      setCreatingGig(false);
    }
  };

  const isOwner = user && venue && user.id === venue.owner_user_id;

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <span className="ml-3 text-sm text-gray-400">Loading venue...</span>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="card border-red-800 bg-red-900/20">
        <p className="text-sm text-red-400">{error || "Venue not found."}</p>
        <Link to="/venues" className="mt-3 inline-block text-sm text-violet-400 hover:underline">
          ← Back to venues
        </Link>
      </div>
    );
  }

  const equipment = parseEquipment(venue);
  const upcomingGigs = gigs.filter((g) => g.status !== "cancelled");

  return (
    <div>
      {/* Back link */}
      <Link
        to="/venues"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to venues
      </Link>

      {/* Venue header */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{venue.name}</h1>
            {venue.city && <p className="mt-1 text-gray-400">{venue.city}</p>}
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <button onClick={() => setShowCreateGig(!showCreateGig)} className="btn-primary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Gig
              </button>
            )}
            {user && !isOwner && (
              <button
                onClick={() => setShowCreateGig(!showCreateGig)}
                className="btn-secondary"
                title="Request a gig at this venue"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Request Gig
              </button>
            )}
          </div>
        </div>

        {/* Venue details */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {venue.address && (
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-300">{venue.address}</span>
            </div>
          )}
          {venue.website && (
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <a
                href={venue.website.startsWith("http") ? venue.website : `https://${venue.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:underline"
              >
                {venue.website}
              </a>
            </div>
          )}
          {venue.light_system_type !== "none" && (
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm text-gray-300">
                Light system: {venue.light_system_type === "hue" ? "Philips Hue" : venue.light_system_type.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Equipment */}
        {equipment.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-400">Equipment</h3>
            <div className="flex flex-wrap gap-2">
              {equipment.map((item, i) => (
                <span
                  key={i}
                  className="inline-block rounded-lg bg-violet-600/20 px-3 py-1 text-sm font-medium text-violet-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create gig form */}
      {showCreateGig && user && (
        <div className="card mb-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {isOwner ? "Create a Gig" : "Request a Gig"}
          </h2>
          <form onSubmit={handleCreateGig} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-500">Gig Title *</label>
                <input
                  type="text"
                  value={gigTitle}
                  onChange={(e) => setGigTitle(e.target.value)}
                  placeholder="e.g. Friday Night House"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Date *</label>
                <input
                  type="date"
                  value={gigDate}
                  onChange={(e) => setGigDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Theme / Genre</label>
                <input
                  type="text"
                  value={gigTheme}
                  onChange={(e) => setGigTheme(e.target.value)}
                  placeholder="e.g. Deep Tech, Bollywood"
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Start Time</label>
                <input
                  type="time"
                  value={gigStartTime}
                  onChange={(e) => setGigStartTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">End Time</label>
                <input
                  type="time"
                  value={gigEndTime}
                  onChange={(e) => setGigEndTime(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            {gigError && <p className="text-sm text-red-400">{gigError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={creatingGig || !gigTitle.trim() || !gigDate} className="btn-primary">
                {creatingGig ? "Creating..." : isOwner ? "Create Gig" : "Submit Request"}
              </button>
              <button type="button" onClick={() => setShowCreateGig(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Gigs */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-white">
          Upcoming Gigs
          {upcomingGigs.length > 0 && (
            <span className="ml-2 text-base font-normal text-gray-500">({upcomingGigs.length})</span>
          )}
        </h2>

        {upcomingGigs.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
              <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">No upcoming gigs</h3>
            <p className="mt-1 text-sm text-gray-400">
              {user ? "Be the first to book a gig at this venue." : "Log in to book a gig."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingGigs.map((gig) => (
              <Link
                key={gig.id}
                to={`/gigs`}
                className="card block transition-colors hover:border-gray-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{gig.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                      <span>{formatDate(gig.date)}</span>
                      {gig.start_time && (
                        <span>
                          {formatTime(gig.start_time)}
                          {gig.end_time ? ` – ${formatTime(gig.end_time)}` : ""}
                        </span>
                      )}
                    </div>
                    {gig.theme && (
                      <p className="mt-1 text-sm text-gray-500">Theme: {gig.theme}</p>
                    )}
                  </div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(gig.status)}`}>
                    {gig.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
