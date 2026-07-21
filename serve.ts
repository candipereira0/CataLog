// Production server — serves the built SPA + API on port 3000.
// Run `bun run build` first, then `bun run start`.
import {
  handleAuthRegister, handleAuthLogin, handleAuthLogout, handleAuthMe, handleAuthGoogle, handleAuthApple,
  handleTrackUpload, handleTrackImport, handleTrackList, handleTrackGet, handleTrackUpdate, handleTrackDelete,
  handleGenres, handleKeys,
  handleGenreSearch, handleGenreTree, handleGenreFusionSuggest, handleGenreSubgenres,
  handleTrackAddGenres, handleTrackGetGenres, handleTrackRemoveGenre,
  handlePlaylistList, handlePlaylistCreate, handlePlaylistGet, handlePlaylistDelete,
  handlePlaylistAddTrack, handlePlaylistRemoveTrack,
  handleTagList, handleTagCreate, handleTrackAttachTag, handleTrackDetachTag,
  handleTrackAITag, handlePlaylistGenerate,
  handleShareCreate, handleShareGet, handleShareDelete,
  handlePlaylistExport, handleTrackExport,
  handleTrackSync, handleTrackDownload, handleSyncStatus,
  handleTrackSearch, handlePlaylistSuggest,
  handleDiscoverArtists,
  handlePaymentCreateCheckout, handlePaymentSuccess, handlePaymentWebhook,
  handleMockCheckout, handlePaymentHistory,
  handleQueueGenerate,
  handleShazamIdentify, handleShazamHistory,
  handleCheckHandle, handleGetUserProfile, handleUserDiscover, handleUpdateProfile,
  handleFollowUser, handleUnfollowUser, handleGetFollowers, handleGetFollowing,
  handleAddCollaborator, handleRemoveCollaborator, handleGetCollaborators,
  // Post, feed, notifications
  handleCreatePost, handleGetPosts, handleGetFeed, handleLikePost, handleUnlikePost, handleDeletePost,
  handleGetNotifications, handleMarkNotificationRead, handleMarkAllNotificationsRead,
  handlePlaylistShareFollowers,
  // Light sync
  handleLightStatus, handleLightParams, handleHueConnect, handleHueSync,
  // Tips
  handleGetPublicTipLinks, handleGetMyTipLinks, handleUpdateMyTipLinks,
  handleRecordTip, handleGetTipsReceived, handleGetTipsGiven, handleTipLandingPage,
  // Artist
  handleArtistTrackUpload, handleArtistTrackList, handleArtistTracksByUser,
  handleArtistTrackGet, handleArtistTrackUpdate, handleArtistTrackDelete,
  handleArtistTrackStream, handleArtistTrackDownload, handleArtistTrackAddToLibrary,
  handleArtistTracksBrowse,
  handleArtistProfileUpdate, handleArtistProfileGet,
  // Device & sync handlers
  handleDeviceRegister, handleDeviceList, handleDeviceDelete,
  handleDeviceActions, handleDeviceActionComplete,
  handleSyncStream, handleSyncPoll, handlePushPlaylist,
  // Venue & gig handlers
  handleCreateVenue, handleListVenues, handleUserVenues, handleGetVenue,
  handleCreateGig, handleGetVenueGigs, handleUserGigs, handleUpdateGig, handlePushSetlist, handleDeleteGig,
  handleGetUserGenres, handleUpdateMyGenres, handleSearchUsersByGenres,
  handleInspoDaily, handleInspoRandom,
  handleGenreDiscover, handleTrackCrossReference,
  json,
} from "./server/handlers";
import { handleGetUserMatches } from "./server/matches";
import { getOscWebSocketConfig } from "./server/osc";
import {
  handleAppleMusicToken,
  handleApplePlaylistsList,
  handleApplePlaylistImport,
  handleApplePlaylistExport,
  handleAppleTrackSearch,
} from "./server/music-apple";
import {
  handleSpotifyAuthUrl,
  handleSpotifyCallback,
  handleSpotifyStatus,
  handleSpotifyDisconnect,
  handleSpotifyPlaylistsList,
  handleSpotifyPlaylistImport,
  handleSpotifyPlaylistExport,
  handleSpotifyTrackSearch,
} from "./server/music-spotify";
import {
  handleYouTubeAuthUrl,
  handleYouTubeCallback,
  handleYouTubeStatus,
  handleYouTubeDisconnect,
  handleYouTubePlaylistsList,
  handleYouTubePlaylistExport,
  handleYouTubeLikedTracks,
  handleYouTubeLikedImport,
} from "./server/music-youtube";

const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist`;

const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

async function handleApiCall(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (!path.startsWith("/api/")) return null;

  try {
    // ─── Auth Routes ───
    if (path === "/api/auth/register" && method === "POST") return handleAuthRegister(req);
    if (path === "/api/auth/login" && method === "POST") return handleAuthLogin(req);
    if (path === "/api/auth/logout" && method === "POST") return handleAuthLogout(req);
    if (path === "/api/auth/me" && method === "GET") return handleAuthMe(req);
    if (path === "/api/auth/google" && method === "POST") return handleAuthGoogle(req);
    if (path === "/api/auth/apple" && method === "POST") return handleAuthApple(req);

    // ─── Track Routes ───
    if (path === "/api/tracks/upload" && method === "POST") return handleTrackUpload(req);
    if (path === "/api/tracks/import" && method === "POST") return handleTrackImport(req);
    if (path === "/api/tracks" && method === "GET") return handleTrackList(req);
    if (path === "/api/tracks/genres" && method === "GET") return handleGenres(req);
    if (path === "/api/tracks/keys" && method === "GET") return handleKeys(req);

    // ─── Genre Routes ───
    if (path === "/api/genres" && method === "GET") return handleGenreTree(req);
    if (path === "/api/genres/search" && method === "GET") return handleGenreSearch(req);
    if (path === "/api/genres/fusions" && method === "GET") return handleGenreFusionSuggest(req);

    const genreSubMatch = path.match(/^\/api\/genres\/([^/]+)\/subgenres$/);
    if (genreSubMatch && method === "GET") return handleGenreSubgenres(req, decodeURIComponent(genreSubMatch[1]));

    // ─── Track Multi-Genre Routes ───
    const trackGenresMatch = path.match(/^\/api\/tracks\/(\d+)\/genres$/);
    if (trackGenresMatch) {
      if (method === "POST") return handleTrackAddGenres(req, trackGenresMatch[1]);
      if (method === "GET") return handleTrackGetGenres(req, trackGenresMatch[1]);
    }

    const trackGenreDelMatch = path.match(/^\/api\/tracks\/(\d+)\/genres\/(.+)$/);
    if (trackGenreDelMatch && method === "DELETE") return handleTrackRemoveGenre(req, trackGenreDelMatch[1], trackGenreDelMatch[2]);

    const trackMatch = path.match(/^\/api\/tracks\/(\d+)$/);
    if (trackMatch) {
      const id = trackMatch[1];
      if (method === "GET") return handleTrackGet(req, id);
      if (method === "PATCH") return handleTrackUpdate(req, id);
      if (method === "DELETE") return handleTrackDelete(req, id);
    }

    const trackTagMatch = path.match(/^\/api\/tracks\/(\d+)\/tags$/);
    if (trackTagMatch && method === "POST") return handleTrackAttachTag(req, trackTagMatch[1]);

    const trackTagDelMatch = path.match(/^\/api\/tracks\/(\d+)\/tags\/(\d+)$/);
    if (trackTagDelMatch && method === "DELETE") return handleTrackDetachTag(req, trackTagDelMatch[1], trackTagDelMatch[2]);

    const trackAITagMatch = path.match(/^\/api\/tracks\/(\d+)\/ai-tag$/);
    if (trackAITagMatch && method === "POST") return handleTrackAITag(req, trackAITagMatch[1]);

    if (path === "/api/tracks/search" && method === "POST") return handleTrackSearch(req);

    // ─── Playlist Routes ───
    if (path === "/api/playlists" && method === "GET") return handlePlaylistList(req);
    if (path === "/api/playlists" && method === "POST") return handlePlaylistCreate(req);
    if (path === "/api/playlists/generate" && method === "POST") return handlePlaylistGenerate(req);

    const plMatch = path.match(/^\/api\/playlists\/(\d+)$/);
    if (plMatch) {
      const id = plMatch[1];
      if (method === "GET") return handlePlaylistGet(req, id);
      if (method === "DELETE") return handlePlaylistDelete(req, id);
    }

    const plTrackMatch = path.match(/^\/api\/playlists\/(\d+)\/tracks$/);
    if (plTrackMatch && method === "POST") return handlePlaylistAddTrack(req, plTrackMatch[1]);

    const plTrackDelMatch = path.match(/^\/api\/playlists\/(\d+)\/tracks\/(\d+)$/);
    if (plTrackDelMatch && method === "DELETE") return handlePlaylistRemoveTrack(req, plTrackDelMatch[1], plTrackDelMatch[2]);

    const plSuggestMatch = path.match(/^\/api\/playlists\/(\d+)\/suggest$/);
    if (plSuggestMatch && method === "POST") return handlePlaylistSuggest(req, plSuggestMatch[1]);

    // ─── Tag Routes ───
    if (path === "/api/tags" && method === "GET") return handleTagList(req);
    if (path === "/api/tags" && method === "POST") return handleTagCreate(req);

    // ─── Share Routes ───
    const sharePublicMatch = path.match(/^\/api\/share\/([a-f0-9-]+)$/);
    if (sharePublicMatch && method === "GET") return handleShareGet(req, sharePublicMatch[1]);

    const plShareMatch = path.match(/^\/api\/playlists\/(\d+)\/share$/);
    if (plShareMatch) {
      if (method === "POST") return handleShareCreate(req, plShareMatch[1]);
      if (method === "DELETE") return handleShareDelete(req, plShareMatch[1]);
    }

    // ─── Export Routes ───
    const plExportMatch = path.match(/^\/api\/playlists\/(\d+)\/export$/);
    if (plExportMatch && method === "GET") return handlePlaylistExport(req, plExportMatch[1]);

    const trackExportMatch = path.match(/^\/api\/tracks\/(\d+)\/export$/);
    if (trackExportMatch && method === "GET") return handleTrackExport(req, trackExportMatch[1]);

    // ─── Sync Routes ───
    if (path === "/api/sync/status" && method === "GET") return handleSyncStatus(req);
    if (path === "/api/sync/stream" && method === "GET") return handleSyncStream(req);
    if (path === "/api/sync/poll" && method === "GET") return handleSyncPoll(req);

    const trackSyncMatch = path.match(/^\/api\/tracks\/(\d+)\/sync$/);
    if (trackSyncMatch && method === "POST") return handleTrackSync(req, trackSyncMatch[1]);

    const trackDownloadMatch = path.match(/^\/api\/tracks\/(\d+)\/download$/);
    if (trackDownloadMatch && method === "POST") return handleTrackDownload(req, trackDownloadMatch[1]);

    // ─── Device Routes ───
    if (path === "/api/devices" && method === "GET") return handleDeviceList(req);
    if (path === "/api/devices/register" && method === "POST") return handleDeviceRegister(req);

    const deviceMatch = path.match(/^\/api\/devices\/(\d+)$/);
    if (deviceMatch) {
      if (method === "DELETE") return handleDeviceDelete(req, deviceMatch[1]);
    }

    const devicePushMatch = path.match(/^\/api\/devices\/(\d+)\/push-playlist$/);
    if (devicePushMatch && method === "POST") return handlePushPlaylist(req, devicePushMatch[1]);

    const deviceActionsMatch = path.match(/^\/api\/devices\/(\d+)\/actions$/);
    if (deviceActionsMatch && method === "GET") return handleDeviceActions(req, deviceActionsMatch[1]);

    const deviceActionCompleteMatch = path.match(/^\/api\/device-actions\/(\d+)\/complete$/);
    if (deviceActionCompleteMatch && method === "POST") return handleDeviceActionComplete(req, deviceActionCompleteMatch[1]);

    // ─── Discover Routes ───
    if (path === "/api/discover/artists" && method === "POST") return handleDiscoverArtists(req);

    // ─── Genre Discovery & Cross-Reference ───
    if (path === "/api/genres/discover" && method === "GET") return handleGenreDiscover(req);
    if (path === "/api/tracks/cross-reference" && method === "POST") return handleTrackCrossReference(req);

    // ─── Queue Routes ───
    if (path === "/api/queue/generate" && method === "POST") return handleQueueGenerate(req);

    // ─── Payment Routes ───
    if (path === "/api/payments/create-checkout" && method === "POST") return handlePaymentCreateCheckout(req);
    if (path === "/api/payments/success" && method === "GET") return handlePaymentSuccess(req);
    if (path === "/api/payments/webhook" && method === "POST") return handlePaymentWebhook(req);
    if (path === "/api/payments/history" && method === "GET") return handlePaymentHistory(req);
    if (path.startsWith("/api/payments/mock-checkout") && method === "GET") return handleMockCheckout(req);

    // ─── Profile / User Routes ───
    if (path === "/api/users/check-handle" && method === "GET") return handleCheckHandle(req);
    if (path === "/api/users/discover" && method === "GET") return handleUserDiscover(req);
    if (path === "/api/users/me" && method === "PATCH") return handleUpdateProfile(req);

    // ─── User Genre Routes (before profile match) ───
    const userGenresMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_-]+)\/genres$/);
    if (userGenresMatch && method === "GET") return handleGetUserGenres(req, userGenresMatch[1]);

    if (path === "/api/users/me/genres" && method === "PUT") return handleUpdateMyGenres(req);

    if (path === "/api/users/search" && method === "GET") return handleSearchUsersByGenres(req);

    const userProfileMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_-]+)$/);
    if (userProfileMatch && method === "GET") return handleGetUserProfile(req, userProfileMatch[1]);

    const followMatch = path.match(/^\/api\/users\/(\d+)\/follow$/);
    if (followMatch) {
      if (method === "POST") return handleFollowUser(req, followMatch[1]);
      if (method === "DELETE") return handleUnfollowUser(req, followMatch[1]);
    }

    const followersMatch = path.match(/^\/api\/users\/(\d+)\/followers$/);
    if (followersMatch && method === "GET") return handleGetFollowers(req, followersMatch[1]);

    const followingMatch = path.match(/^\/api\/users\/(\d+)\/following$/);
    if (followingMatch && method === "GET") return handleGetFollowing(req, followingMatch[1]);

    // ─── Collaborator Routes ───
    const collabMatch = path.match(/^\/api\/playlists\/(\d+)\/collaborators$/);
    if (collabMatch) {
      if (method === "POST") return handleAddCollaborator(req, collabMatch[1]);
      if (method === "GET") return handleGetCollaborators(req, collabMatch[1]);
    }

    const collabDelMatch = path.match(/^\/api\/playlists\/(\d+)\/collaborators\/(\d+)$/);
    if (collabDelMatch && method === "DELETE") return handleRemoveCollaborator(req, collabDelMatch[1], collabDelMatch[2]);

    // ─── Shazam / Identify Routes ───
    if (path === "/api/shazam/identify" && method === "POST") return handleShazamIdentify(req);
    if (path === "/api/shazam/history" && method === "GET") return handleShazamHistory(req);

    // ─── Post Routes ───
    if (path === "/api/posts" && method === "POST") return handleCreatePost(req);
    if (path === "/api/posts" && method === "GET") return handleGetPosts(req);
    if (path === "/api/feed" && method === "GET") return handleGetFeed(req);

    const postLikeMatch = path.match(/^\/api\/posts\/(\d+)\/like$/);
    if (postLikeMatch) {
      if (method === "POST") return handleLikePost(req, postLikeMatch[1]);
      if (method === "DELETE") return handleUnlikePost(req, postLikeMatch[1]);
    }

    const postDelMatch = path.match(/^\/api\/posts\/(\d+)$/);
    if (postDelMatch && method === "DELETE") return handleDeletePost(req, postDelMatch[1]);

    // ─── Notification Routes ───
    if (path === "/api/notifications" && method === "GET") return handleGetNotifications(req);
    if (path === "/api/notifications/read-all" && method === "POST") return handleMarkAllNotificationsRead(req);

    const notifReadMatch = path.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notifReadMatch && method === "POST") return handleMarkNotificationRead(req, notifReadMatch[1]);

    // ─── Share with Followers ───
    const plShareFollowersMatch = path.match(/^\/api\/playlists\/(\d+)\/share-followers$/);
    if (plShareFollowersMatch && method === "POST") return handlePlaylistShareFollowers(req, plShareFollowersMatch[1]);

    // ─── Light Sync Routes ───
    if (path === "/api/lights/status" && method === "GET") return handleLightStatus(req);
    if (path === "/api/lights/params" && method === "GET") return handleLightParams(req);
    if (path === "/api/lights/hue/connect" && method === "POST") return handleHueConnect(req);
    if (path === "/api/lights/hue/sync" && method === "POST") return handleHueSync(req);

    // ─── Tip Link Routes ───
    if (path === "/api/tips/received" && method === "GET") return handleGetTipsReceived(req);
    if (path === "/api/tips/given" && method === "GET") return handleGetTipsGiven(req);
    if (path === "/api/tips" && method === "POST") return handleRecordTip(req);
    if (path === "/api/users/me/tip-links" && method === "GET") return handleGetMyTipLinks(req);
    if (path === "/api/users/me/tip-links" && method === "PUT") return handleUpdateMyTipLinks(req);

    const userTipLinksMatch = path.match(/^\/api\/users\/(\d+)\/tip-links$/);
    if (userTipLinksMatch && method === "GET") return handleGetPublicTipLinks(req, userTipLinksMatch[1]);

    const tipQrMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_-]+)\/tip-qr$/);
    if (tipQrMatch && method === "GET") return handleTipLandingPage(req, tipQrMatch[1]);

    // ─── Artist Track Routes ───
    if (path === "/api/artist/tracks" && method === "POST") return handleArtistTrackUpload(req);
    if (path === "/api/artist/tracks" && method === "GET") return handleArtistTrackList(req);
    if (path === "/api/artist/tracks/browse" && method === "GET") return handleArtistTracksBrowse(req);

    const artistTrackMatch = path.match(/^\/api\/artist\/tracks\/(\d+)$/);
    if (artistTrackMatch) {
      const id = artistTrackMatch[1];
      if (method === "GET") return handleArtistTrackGet(req, id);
      if (method === "PATCH") return handleArtistTrackUpdate(req, id);
      if (method === "DELETE") return handleArtistTrackDelete(req, id);
    }

    const artistTrackStreamMatch = path.match(/^\/api\/artist\/tracks\/(\d+)\/stream$/);
    if (artistTrackStreamMatch && method === "GET") return handleArtistTrackStream(req, artistTrackStreamMatch[1]);

    const artistTrackDownloadMatch = path.match(/^\/api\/artist\/tracks\/(\d+)\/download$/);
    if (artistTrackDownloadMatch && method === "POST") return handleArtistTrackDownload(req, artistTrackDownloadMatch[1]);

    const artistTrackAddMatch = path.match(/^\/api\/artist\/tracks\/(\d+)\/add-to-library$/);
    if (artistTrackAddMatch && method === "POST") return handleArtistTrackAddToLibrary(req, artistTrackAddMatch[1]);

    // ─── Artist Profile Routes ───
    if (path === "/api/artist/profile" && method === "GET") return handleArtistProfileGet(req);
    if (path === "/api/artist/profile" && method === "PUT") return handleArtistProfileUpdate(req);

    // ─── Public Artist Tracks by handle ───
    const artistUserTracksMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_-]+)\/tracks$/);
    if (artistUserTracksMatch && method === "GET") return handleArtistTracksByUser(req, artistUserTracksMatch[1]);

    // ─── Venue Routes ───
    if (path === "/api/venues" && method === "POST") return handleCreateVenue(req);
    if (path === "/api/venues" && method === "GET") return handleListVenues(req);
    if (path === "/api/venues/mine" && method === "GET") return handleUserVenues(req);

    const venueMatch = path.match(/^\/api\/venues\/(\d+)$/);
    if (venueMatch && method === "GET") return handleGetVenue(req, venueMatch[1]);

    const venueGigsMatch = path.match(/^\/api\/venues\/(\d+)\/gigs$/);
    if (venueGigsMatch) {
      if (method === "POST") return handleCreateGig(req, venueGigsMatch[1]);
      if (method === "GET") return handleGetVenueGigs(req, venueGigsMatch[1]);
    }

    // ─── Gig Routes ───
    if (path === "/api/gigs/mine" && method === "GET") return handleUserGigs(req);

    const gigMatch = path.match(/^\/api\/gigs\/(\d+)$/);
    if (gigMatch) {
      if (method === "PATCH") return handleUpdateGig(req, gigMatch[1]);
      if (method === "DELETE") return handleDeleteGig(req, gigMatch[1]);
    }

    const gigPushMatch = path.match(/^\/api\/gigs\/(\d+)\/push$/);
    if (gigPushMatch && method === "POST") return handlePushSetlist(req, gigPushMatch[1]);

    // ─── DJ Matches ───
    const userMatchesMatch = path.match(/^\/api\/users\/(\d+)\/matches$/);
    if (userMatchesMatch && method === "GET") return handleGetUserMatches(req, userMatchesMatch[1]);

    // ─── Inspo Routes ───
    if (path === "/api/inspo/daily" && method === "GET") return handleInspoDaily(req);
    if (path === "/api/inspo/random" && method === "GET") return handleInspoRandom(req);

    // ─── Apple Music Routes ───
    if (path === "/api/music/apple-token" && method === "POST") return handleAppleMusicToken(req);
    if (path === "/api/music/apple/playlists" && method === "GET") return handleApplePlaylistsList(req);
    if (path === "/api/music/apple/playlists/export" && method === "POST") return handleApplePlaylistExport(req);
    if (path === "/api/music/apple/search" && method === "GET") return handleAppleTrackSearch(req);
    const applePlaylistImportMatch = path.match(/^\/api\/music\/apple\/playlists\/([^/]+)\/import$/);
    if (applePlaylistImportMatch && method === "POST") return handleApplePlaylistImport(req);

    // ─── Spotify Routes ───
    if (path === "/api/music/spotify/auth-url" && method === "GET") return handleSpotifyAuthUrl(req);
    if (path === "/api/music/spotify/callback" && method === "GET") return handleSpotifyCallback(req);
    if (path === "/api/music/spotify/status" && method === "GET") return handleSpotifyStatus(req);
    if (path === "/api/music/spotify/disconnect" && method === "POST") return handleSpotifyDisconnect(req);
    if (path === "/api/music/spotify/playlists" && method === "GET") return handleSpotifyPlaylistsList(req);
    if (path === "/api/music/spotify/playlists/export" && method === "POST") return handleSpotifyPlaylistExport(req);
    if (path === "/api/music/spotify/search" && method === "GET") return handleSpotifyTrackSearch(req);
    const spotifyPlaylistImportMatch = path.match(/^\/api\/music\/spotify\/playlists\/([^/]+)\/import$/);
    if (spotifyPlaylistImportMatch && method === "POST") return handleSpotifyPlaylistImport(req);

    // ─── YouTube Routes ───
    if (path === "/api/music/youtube/auth-url" && method === "GET") return handleYouTubeAuthUrl(req);
    if (path === "/api/music/youtube/callback" && method === "GET") return handleYouTubeCallback(req);
    if (path === "/api/music/youtube/status" && method === "GET") return handleYouTubeStatus(req);
    if (path === "/api/music/youtube/disconnect" && method === "POST") return handleYouTubeDisconnect(req);
    if (path === "/api/music/youtube/playlists" && method === "GET") return handleYouTubePlaylistsList(req);
    if (path === "/api/music/youtube/playlists/export" && method === "POST") return handleYouTubePlaylistExport(req);
    if (path === "/api/music/youtube/liked" && method === "GET") return handleYouTubeLikedTracks(req);
    if (path === "/api/music/youtube/liked/import" && method === "POST") return handleYouTubeLikedImport(req);

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// Restart loop — handles port races
for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      websocket: {
        ...getOscWebSocketConfig(),
      },
      async fetch(req) {
        const apiResponse = await handleApiCall(req);
        if (apiResponse) return apiResponse;

        const url = new URL(req.url);
        const pathname = url.pathname;

        // Handle /tip/@handle pages as server-rendered HTML
        const tipPageMatch = pathname.match(/^\/tip\/@([a-zA-Z0-9_-]+)$/);
        if (tipPageMatch) {
          return handleTipLandingPage(req, tipPageMatch[1]);
        }

        const filePath = pathname === "/" ? "/index.html" : pathname;
        const file = Bun.file(CLIENT_DIR + filePath);

        if (await file.exists()) {
          return new Response(file);
        }

        const indexFile = Bun.file(CLIENT_DIR + "/index.html");
        if (await indexFile.exists()) {
          return new Response(indexFile);
        }

        return new Response("Not found", { status: 404 });
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`CataLog serving on http://${HOST}:${String(PORT)}`);
