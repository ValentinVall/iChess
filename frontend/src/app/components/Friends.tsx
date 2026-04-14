import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { apiClient, type FriendEntry, type FriendSearchResult, type FriendsOverviewResponse } from "../../lib/api";
import { BrandHomeLink } from "./BrandHomeLink";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function Friends() {
  const navigate = useNavigate();
  const [friendsOverview, setFriendsOverview] = useState<FriendsOverviewResponse | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendSearchValue, setFriendSearchValue] = useState("");
  const [friendSearchResult, setFriendSearchResult] = useState<FriendSearchResult | null>(null);
  const [friendSearchError, setFriendSearchError] = useState<string | null>(null);
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [activeFriendshipId, setActiveFriendshipId] = useState<string | null>(null);
  const [removeFriendTarget, setRemoveFriendTarget] = useState<{ friendshipId: string; username: string } | null>(null);

  useEffect(() => {
    void loadFriendsOverview();
  }, []);

  async function loadFriendsOverview() {
    setFriendsLoading(true);
    setFriendsError(null);

    try {
      const overview = await apiClient.getFriendsOverview();
      setFriendsOverview(overview);
    } catch (error) {
      setFriendsError(error instanceof Error ? error.message : "Failed to load friends");
    } finally {
      setFriendsLoading(false);
    }
  }

  async function handleFriendSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearchingFriend(true);
    setFriendSearchError(null);
    setFriendActionError(null);

    try {
      const result = await apiClient.searchFriendByPlayerNumber(friendSearchValue);
      setFriendSearchResult(result);
    } catch (error) {
      setFriendSearchResult(null);
      setFriendSearchError(error instanceof Error ? error.message : "Failed to search player");
    } finally {
      setIsSearchingFriend(false);
    }
  }

  async function handleSendFriendRequest() {
    if (!friendSearchResult) {
      return;
    }

    setActiveFriendshipId(friendSearchResult.friendshipId ?? `search-${friendSearchResult.user.userId}`);
    setFriendActionError(null);

    try {
      const response = await apiClient.sendFriendRequest(friendSearchResult.user.playerNumber || friendSearchValue);
      setFriendSearchResult((current) => current ? {
        ...current,
        friendshipId: response.friendshipId,
        relationshipStatus: response.relationshipStatus,
      } : current);
      await loadFriendsOverview();
    } catch (error) {
      setFriendActionError(error instanceof Error ? error.message : "Failed to add friend");
    } finally {
      setActiveFriendshipId(null);
    }
  }

  async function handleRespondToRequest(friendshipId: string, action: 'accept' | 'decline') {
    setActiveFriendshipId(friendshipId);
    setFriendActionError(null);

    try {
      await apiClient.respondToFriendRequest(friendshipId, action);
      if (friendSearchResult?.friendshipId === friendshipId) {
        setFriendSearchResult((current) => current ? {
          ...current,
          friendshipId: action === 'accept' ? friendshipId : null,
          relationshipStatus: action === 'accept' ? 'friend' : 'none',
        } : current);
      }
      await loadFriendsOverview();
    } catch (error) {
      setFriendActionError(error instanceof Error ? error.message : "Failed to update friend request");
    } finally {
      setActiveFriendshipId(null);
    }
  }

  async function handleRemoveFriendship(friendshipId: string) {
    setActiveFriendshipId(friendshipId);
    setFriendActionError(null);

    try {
      await apiClient.removeFriendship(friendshipId);
      if (friendSearchResult?.friendshipId === friendshipId) {
        setFriendSearchResult((current) => current ? {
          ...current,
          friendshipId: null,
          relationshipStatus: 'none',
        } : current);
      }
      await loadFriendsOverview();
    } catch (error) {
      setFriendActionError(error instanceof Error ? error.message : "Failed to remove friendship");
    } finally {
      setActiveFriendshipId(null);
    }
  }

  function requestFriendRemoval(friendshipId: string, username: string) {
    setRemoveFriendTarget({ friendshipId, username });
  }

  async function handleConfirmFriendRemoval() {
    if (!removeFriendTarget) {
      return;
    }

    const friendshipId = removeFriendTarget.friendshipId;
    setRemoveFriendTarget(null);
    await handleRemoveFriendship(friendshipId);
  }

  function renderFriendItem(item: FriendEntry, actions?: React.ReactNode) {
    return (
      <div key={item.friendshipId} className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/55 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => item.playerNumber ? navigate(`/profile/${item.playerNumber.replace(/[^0-9]/g, '')}`) : undefined}
            disabled={!item.playerNumber}
            className="text-sm font-medium text-black/80 transition-colors hover:text-blue-600 disabled:cursor-default disabled:hover:text-black/80 dark:text-white/80 dark:hover:text-blue-400 dark:disabled:hover:text-white/80"
          >
            @{item.username}
          </button>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">{item.playerNumber || 'Unassigned'}{item.bio ? ` · ${item.bio}` : ''}</p>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-black/5 blur-[120px] dark:bg-white/5" />

      <div className="relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5 lg:px-8"
        >
          <div className="flex items-center gap-4">
            <BrandHomeLink />
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm tracking-wide">Back</span>
            </button>
          </div>

          <div className="w-9" />
        </motion.header>

        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center md:mb-10"
          >
            <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/12 backdrop-blur-xl dark:border-blue-400/20 dark:bg-blue-400/10">
              <Users className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-light tracking-tight md:text-4xl">Friends</h1>
            <p className="mt-3 text-sm text-black/45 dark:text-white/45">Search by Player Number, add friends, and manage your full network in one place.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6"
          >
            <form onSubmit={handleFriendSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1">
                <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Find by Player Number</span>
                <div className="flex items-center rounded-2xl border border-black/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="mr-2 text-lg text-black/45 dark:text-white/45">#</span>
                  <input
                    value={friendSearchValue}
                    onChange={(event) => setFriendSearchValue(event.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="00"
                    className="w-full bg-transparent text-sm text-black outline-none dark:text-white"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isSearchingFriend || !friendSearchValue}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/15 px-4 py-3 text-sm font-medium text-blue-600 transition-all hover:bg-blue-500/20 disabled:opacity-60 dark:text-blue-400"
              >
                <Search className="h-4 w-4" />
                {isSearchingFriend ? 'Searching...' : 'Search'}
              </button>
            </form>

            {friendSearchError ? <p className="mt-3 text-sm text-rose-500">{friendSearchError}</p> : null}
            {friendActionError ? <p className="mt-3 text-sm text-rose-500">{friendActionError}</p> : null}

            {friendSearchResult ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => friendSearchResult.user.playerNumber ? navigate(`/profile/${friendSearchResult.user.playerNumber.replace(/[^0-9]/g, '')}`) : undefined}
                      disabled={!friendSearchResult.user.playerNumber}
                      className="text-base font-medium text-black/85 transition-colors hover:text-blue-600 disabled:cursor-default disabled:hover:text-black/85 dark:text-white/85 dark:hover:text-blue-400 dark:disabled:hover:text-white/85"
                    >
                      @{friendSearchResult.user.username}
                    </button>
                    <p className="mt-1 text-sm text-black/50 dark:text-white/50">{friendSearchResult.user.playerNumber || 'Unassigned'}{friendSearchResult.user.bio ? ` · ${friendSearchResult.user.bio}` : ''}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {friendSearchResult.relationshipStatus === 'none' ? (
                      <button
                        type="button"
                        onClick={handleSendFriendRequest}
                        disabled={activeFriendshipId === `search-${friendSearchResult.user.userId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
                      >
                        <UserPlus className="h-4 w-4" />
                        Add friend
                      </button>
                    ) : null}

                    {friendSearchResult.relationshipStatus === 'incoming_pending' && friendSearchResult.friendshipId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRespondToRequest(friendSearchResult.friendshipId!, 'accept')}
                          disabled={activeFriendshipId === friendSearchResult.friendshipId}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
                        >
                          <UserCheck className="h-4 w-4" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToRequest(friendSearchResult.friendshipId!, 'decline')}
                          disabled={activeFriendshipId === friendSearchResult.friendshipId}
                          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </button>
                      </>
                    ) : null}

                    {friendSearchResult.relationshipStatus === 'outgoing_pending' && friendSearchResult.friendshipId ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveFriendship(friendSearchResult.friendshipId!)}
                        disabled={activeFriendshipId === friendSearchResult.friendshipId}
                        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      >
                        <UserMinus className="h-4 w-4" />
                        Cancel request
                      </button>
                    ) : null}

                    {friendSearchResult.relationshipStatus === 'friend' && friendSearchResult.friendshipId ? (
                      <button
                        type="button"
                        onClick={() => requestFriendRemoval(friendSearchResult.friendshipId!, friendSearchResult.user.username)}
                        disabled={activeFriendshipId === friendSearchResult.friendshipId}
                        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      >
                        <UserMinus className="h-4 w-4" />
                        Remove friend
                      </button>
                    ) : null}

                    {friendSearchResult.relationshipStatus === 'self' ? (
                      <span className="inline-flex items-center rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                        This is your profile number
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>

          {friendsError ? <p className="mb-6 text-sm text-rose-500">{friendsError}</p> : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="space-y-3 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6"
            >
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">Friends</h3>
                <p className="mt-1 text-sm text-black/50 dark:text-white/50">{friendsOverview?.friendCount ?? 0} total friends</p>
              </div>
              <div className="space-y-3">
                {friendsLoading ? <p className="text-sm text-black/50 dark:text-white/50">Loading friends...</p> : null}
                {!friendsLoading && (!friendsOverview || friendsOverview.friends.length === 0) ? <p className="text-sm text-black/50 dark:text-white/50">No friends added yet.</p> : null}
                {friendsOverview?.friends.map((item) => renderFriendItem(item, (
                  <button
                    type="button"
                    onClick={() => requestFriendRemoval(item.friendshipId, item.username)}
                    disabled={activeFriendshipId === item.friendshipId}
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                )))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-3 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6"
            >
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">Incoming Requests</h3>
                <p className="mt-1 text-sm text-black/50 dark:text-white/50">Accept or decline players who want to add you.</p>
              </div>
              <div className="space-y-3">
                {!friendsLoading && (!friendsOverview || friendsOverview.incomingRequests.length === 0) ? <p className="text-sm text-black/50 dark:text-white/50">No incoming requests.</p> : null}
                {friendsOverview?.incomingRequests.map((item) => renderFriendItem(item, (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondToRequest(item.friendshipId, 'accept')}
                      disabled={activeFriendshipId === item.friendshipId}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
                    >
                      <UserCheck className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondToRequest(item.friendshipId, 'decline')}
                      disabled={activeFriendshipId === item.friendshipId}
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                )))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="space-y-3 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6"
            >
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">Outgoing Requests</h3>
                <p className="mt-1 text-sm text-black/50 dark:text-white/50">Pending requests you can still cancel.</p>
              </div>
              <div className="space-y-3">
                {!friendsLoading && (!friendsOverview || friendsOverview.outgoingRequests.length === 0) ? <p className="text-sm text-black/50 dark:text-white/50">No outgoing requests.</p> : null}
                {friendsOverview?.outgoingRequests.map((item) => renderFriendItem(item, (
                  <button
                    type="button"
                    onClick={() => handleRemoveFriendship(item.friendshipId)}
                    disabled={activeFriendshipId === item.friendshipId}
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 transition-all hover:bg-black/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                )))}
              </div>
            </motion.section>
          </div>

          <AlertDialog open={Boolean(removeFriendTarget)} onOpenChange={(open) => {
            if (!open) {
              setRemoveFriendTarget(null);
            }
          }}>
            <AlertDialogContent className="border-black/10 bg-[#fafaf7] text-black dark:border-white/10 dark:bg-[#101010] dark:text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove friend?</AlertDialogTitle>
                <AlertDialogDescription className="text-black/55 dark:text-white/55">
                  {removeFriendTarget ? `Do you really want to remove player @${removeFriendTarget.username} from your friends?` : "Do you really want to remove this player from your friends?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-black/10 bg-transparent text-black/70 hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmFriendRemoval}
                  className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
                >
                  Remove friend
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}