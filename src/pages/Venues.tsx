import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, type Venue } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function parseEquipment(venue: Venue): string[] {
  try {
    return JSON.parse(venue.equipment_json || "[]") as string[];
  } catch {
    return [];
  }
}

export default function Venues() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create venue modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newLightSystem, setNewLightSystem] = useState("none");
  const [creating, setCreating] = useState(false);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listVenues();
      setVenues(data.venues);
    } catch (err) {
      setError("Failed to load venues.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createVenue({
        name: newName.trim(),
        city: newCity.trim() || undefined,
        address: newAddress.trim() || undefined,
        website: newWebsite.trim() || undefined,
        equipment: newEquipment
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        light_system_type: newLightSystem,
      });
      setShowCreate(false);
      setNewName("");
      setNewCity("");
      setNewAddress("");
      setNewWebsite("");
      setNewEquipment("");
      setNewLightSystem("none");
      await fetchVenues();
    } catch (err) {
      console.error("Failed to create venue:", err);
    } finally {
      setCreating(false);
    }
  };

  const filtered = venues.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.city && v.city.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Venues</h1>
          <p className="mt-1 text-sm text-gray-400">
            {venues.length} venue{venues.length !== 1 ? "s" : ""}
          </p>
        </div>
        {user && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Register your venue
          </button>
        )}
      </div>

      {/* Create venue form */}
      {showCreate && (
        <div className="card mb-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Register a New Venue</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Venue Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Club Nova"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">City</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="e.g. Berlin"
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-500">Address</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Website</label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://clubnova.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Light System</label>
                <select
                  value={newLightSystem}
                  onChange={(e) => setNewLightSystem(e.target.value)}
                  className="input-field py-2.5"
                >
                  <option value="none">None</option>
                  <option value="hue">Philips Hue</option>
                  <option value="dmx">DMX</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-500">Equipment (comma-separated)</label>
                <input
                  type="text"
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  placeholder="e.g. CDJ-3000, DJM-900, RMX-1000"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
                {creating ? "Creating..." : "Register Venue"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venues by name or city..."
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading venues...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && venues.length === 0 && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No venues yet</h2>
          <p className="mt-1 text-sm text-gray-400">
            Be the first to register a venue and connect with DJs.
          </p>
          {user && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
              Register your venue
            </button>
          )}
          {!user && (
            <Link to="/login" className="btn-primary mt-4">
              Log in to register a venue
            </Link>
          )}
        </div>
      )}

      {/* Empty search results */}
      {!loading && !error && venues.length > 0 && filtered.length === 0 && (
        <div className="card flex flex-col items-center py-12 text-center">
          <p className="text-sm text-gray-400">No venues match "{search}".</p>
        </div>
      )}

      {/* Venue list */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((venue) => {
            const equipment = parseEquipment(venue);
            return (
              <Link
                key={venue.id}
                to={`/venues/${venue.id}`}
                className="card block transition-colors hover:border-gray-600"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{venue.name}</h3>
                    {venue.city && (
                      <p className="mt-0.5 text-sm text-gray-400">{venue.city}</p>
                    )}
                  </div>
                  {venue.website && (
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </div>
                {equipment.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {equipment.slice(0, 4).map((item, i) => (
                      <span
                        key={i}
                        className="inline-block rounded-md bg-violet-600/20 px-2 py-0.5 text-xs font-medium text-violet-300"
                      >
                        {item}
                      </span>
                    ))}
                    {equipment.length > 4 && (
                      <span className="inline-block rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                        +{equipment.length - 4} more
                      </span>
                    )}
                  </div>
                )}
                {venue.light_system_type !== "none" && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {venue.light_system_type === "hue" ? "Philips Hue" : venue.light_system_type.toUpperCase()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
