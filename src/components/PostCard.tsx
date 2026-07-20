import { Link } from "react-router-dom";
import { api, type Post } from "../lib/api";
import { timeAgo } from "../lib/timeago";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface PostCardProps {
  post: Post;
  onUpdate?: () => void;
}

export default function PostCard({ post, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me > 0);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [likeLoading, setLikeLoading] = useState(false);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await api.unlikePost(post.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await api.likePost(post.id);
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Like error:", err);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      await api.deletePost(post.id);
      onUpdate?.();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const typeBadge = () => {
    switch (post.type) {
      case "gig": return { icon: "🎤", label: "Gig", cls: "bg-rose-900/40 text-rose-300 border-rose-800" };
      case "playlist_share": return { icon: "🎵", label: "Shared Playlist", cls: "bg-violet-900/40 text-violet-300 border-violet-800" };
      case "track_share": return { icon: "🎧", label: "Track", cls: "bg-blue-900/40 text-blue-300 border-blue-800" };
      case "status": return { icon: "💬", label: "Status", cls: "bg-gray-700/40 text-gray-300 border-gray-700" };
      default: return { icon: "📝", label: "Post", cls: "bg-gray-700/40 text-gray-300 border-gray-700" };
    }
  };

  const badge = typeBadge();

  const googleCalendarUrl = post.type === "gig" && post.gig_date
    ? (() => {
        const d = new Date(post.gig_date);
        if (isNaN(d.getTime())) return "";
        const pad = (n: number) => n.toString().padStart(2, "0");
        const start = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        // End = 2 hours later
        const endD = new Date(d.getTime() + 2 * 60 * 60 * 1000);
        const end = `${endD.getFullYear()}${pad(endD.getMonth() + 1)}${pad(endD.getDate())}T${pad(endD.getHours())}${pad(endD.getMinutes())}${pad(endD.getSeconds())}`;
        const params = new URLSearchParams({
          action: "TEMPLATE",
          text: post.title,
          dates: `${start}/${end}`,
          details: post.body,
          location: [post.gig_venue, post.gig_location].filter(Boolean).join(", "),
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
      })()
    : "";

  return (
    <div className="card group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link
            to={post.author_handle ? `/@${post.author_handle}` : "#"}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white hover:ring-2 hover:ring-violet-400 transition-all"
          >
            {post.author_name.charAt(0).toUpperCase()}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                to={post.author_handle ? `/@${post.author_handle}` : "#"}
                className="font-semibold text-gray-200 hover:text-violet-400 transition-colors"
              >
                {post.author_name}
              </Link>
              {post.author_handle && (
                <span className="text-xs text-gray-500">@{post.author_handle}</span>
              )}
            </div>
            <span className="text-xs text-gray-600">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.icon} {badge.label}
        </span>
      </div>

      {/* Content */}
      {post.title && (
        <h3 className="text-base font-semibold text-white mb-1">{post.title}</h3>
      )}
      {post.body && (
        <p className="text-sm text-gray-300 mb-3 whitespace-pre-wrap break-words">{post.body}</p>
      )}

      {/* Gig details */}
      {post.type === "gig" && (
        <div className="mb-3 rounded-lg border border-gray-700/50 bg-gray-800/30 p-3 space-y-1.5">
          {post.gig_date && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{new Date(post.gig_date).toLocaleString()}</span>
            </div>
          )}
          {post.gig_venue && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{post.gig_venue}</span>
            </div>
          )}
          {post.gig_location && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{post.gig_location}</span>
            </div>
          )}
          {googleCalendarUrl && (
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-600/30 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add to Google Calendar
            </a>
          )}
        </div>
      )}

      {/* Playlist share details */}
      {post.type === "playlist_share" && post.playlist_name && (
        <div className="mb-3 rounded-lg border border-violet-700/30 bg-violet-900/10 p-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-sm font-medium text-violet-300">{post.playlist_name}</span>
            {post.playlist_track_count !== undefined && (
              <span className="text-xs text-violet-500">{post.playlist_track_count} track{post.playlist_track_count !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      )}

      {/* Track share details */}
      {post.type === "track_share" && post.track_title && (
        <div className="mb-3 rounded-lg border border-blue-700/30 bg-blue-900/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">♫</span>
            <div>
              <p className="text-sm font-medium text-blue-300">{post.track_title}</p>
              {post.track_artist && <p className="text-xs text-blue-500">{post.track_artist}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-gray-800 pt-3">
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            liked ? "text-red-400" : "text-gray-500 hover:text-red-400"
          }`}
        >
          <svg
            className={`h-4 w-4 ${liked ? "fill-current" : ""}`}
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        {user && user.id === post.user_id && (
          <button
            onClick={handleDelete}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors ml-auto"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
