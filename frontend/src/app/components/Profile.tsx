import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Trophy, TrendingUp, Clock, Award, ArrowRight, PencilLine, Save, UserRound, X, Brain, Swords, ChevronRight, Bolt, Zap, Users } from "lucide-react";
import { apiClient, type HistoryGame, type ProfileStatMode, type UserProfileResponse } from "../../lib/api";
import { DEFAULT_STOCKFISH_LEVEL, getStockfishLevelMeta } from "../stockfishLevels";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

const profileModes: Array<{
  id: ProfileStatMode;
  eyebrow: string;
  title: string;
  accentClassName: string;
  icon: typeof Zap;
}> = [
  {
    id: "bullet",
    eyebrow: "Matchmaking",
    title: "Bullet Stats",
    accentClassName: "border-[#E63946]/25 bg-[#E63946]/14 text-[#B42333] dark:text-[#ff98a4]",
    icon: Zap,
  },
  {
    id: "blitz",
    eyebrow: "Matchmaking",
    title: "Blitz Stats",
    accentClassName: "border-[#F4A261]/25 bg-[#F4A261]/14 text-[#A55B13] dark:text-[#ffd09d]",
    icon: Bolt,
  },
  {
    id: "rapid",
    eyebrow: "Matchmaking",
    title: "Rapid Stats",
    accentClassName: "border-[#2A9D8F]/25 bg-[#2A9D8F]/14 text-[#1B6E64] dark:text-[#9fe6dc]",
    icon: Clock,
  },
  {
    id: "ai",
    eyebrow: "Training",
    title: "AI Stats",
    accentClassName: "border-[#4D7CFE]/25 bg-[#4D7CFE]/14 text-[#274DC7] dark:text-[#a9bdfd]",
    icon: Brain,
  },
];

export function Profile() {
  const navigate = useNavigate();
  const { playerNumber } = useParams();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [recentGames, setRecentGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ProfileStatMode>("rapid");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [form, setForm] = useState({
    username: "",
    bio: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = playerNumber
          ? await apiClient.getPublicProfile(playerNumber)
          : await apiClient.getProfile();

        setProfile(profileData);
        setSelectedMode(profileData.selectedMode);
        setForm({
          username: profileData.username,
          bio: profileData.bio || "",
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [playerNumber]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let isCancelled = false;

    const loadRecentGames = async () => {
      try {
        const historyData = playerNumber
          ? await apiClient.getPublicGameHistory(playerNumber, 5, selectedMode)
          : await apiClient.getGameHistory(5, selectedMode);

        if (!isCancelled) {
          setRecentGames(historyData.games || []);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load filtered history:', error);
          setRecentGames([]);
        }
      }
    };

    void loadRecentGames();

    return () => {
      isCancelled = true;
    };
  }, [playerNumber, profile, selectedMode]);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="text-black/60 dark:text-white/60">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="text-black/60 dark:text-white/60">Failed to load profile</div>
      </div>
    );
  }

  const currentProfile = profile;
  const selectedModeStats = currentProfile.modeStats[selectedMode];
  const selectedModeLabel = selectedMode === "ai"
    ? "AI"
    : selectedMode === "bullet"
    ? "bullet"
    : selectedMode === "blitz"
    ? "blitz"
    : "rapid";
  const recentGamesSubtitle = selectedMode === "ai"
    ? "Your latest 5 completed AI games appear here."
    : `Your latest 5 completed ${selectedModeLabel} games appear here.`;
  const recentGamesEmptyState = selectedMode === "ai"
    ? "Start an AI match and your latest AI results will show up here."
    : `Play a ${selectedModeLabel} match and your latest results will show up here.`;

  const stats = selectedMode === "ai"
    ? [
        { label: "Wins", value: selectedModeStats.wins, icon: Award },
        { label: "Losses", value: selectedModeStats.losses, icon: X },
        { label: "Games Played", value: selectedModeStats.totalGames, icon: Clock },
        { label: "Win Rate", value: `${selectedModeStats.winRate}%`, icon: TrendingUp },
      ]
    : [
        { label: "Elo", value: selectedModeStats.rating, icon: Trophy },
        { label: "Wins", value: selectedModeStats.wins, icon: Award },
        { label: "Games Played", value: selectedModeStats.totalGames, icon: Clock },
        { label: "Win Rate", value: `${selectedModeStats.winRate}%`, icon: TrendingUp },
      ];

  const profileHighlights = [
    {
      label: "Player Number",
      value: currentProfile.playerNumber || "Unassigned",
      icon: Trophy,
    },
    {
      label: "Player Handle",
      value: `@${currentProfile.username}`,
      icon: UserRound,
    },
    {
      label: "Friends",
      value: `${currentProfile.friendCount}`,
      icon: Users,
    },
  ];


  async function handleSaveProfile() {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await apiClient.updateProfile(form);
      const nextProfile: UserProfileResponse = {
        ...currentProfile,
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim(),
      };
      setProfile(nextProfile);
      setIsEditing(false);
      setSaveSuccess("Profile updated");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setForm({
      username: currentProfile.username,
      bio: currentProfile.bio || "",
    });
    setSaveError(null);
    setIsEditing(false);
  }

  function resetPasswordForm() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError(null);
  }

  function handlePasswordDialogChange(open: boolean) {
    setIsPasswordDialogOpen(open);

    if (!open) {
      resetPasswordForm();
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Fill in all password fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword.length > 72) {
      setPasswordError("New password must be between 6 and 72 characters");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError("New password must be different from the current password");
      return;
    }

    setIsPasswordSaving(true);

    try {
      await apiClient.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess("Password updated");
      handlePasswordDialogChange(false);
      setSaveSuccess("Password updated");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsPasswordSaving(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiClient.logout();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function formatDuration(durationInSeconds: number) {
    if (durationInSeconds < 60) {
      return `${durationInSeconds}s`;
    }

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  function getOutcomeLabel(outcome: HistoryGame['outcome']) {
    if (outcome === 'win') return 'Victory';
    if (outcome === 'loss') return 'Loss';
    return 'Draw';
  }

  function getOutcomeStyles(outcome: HistoryGame['outcome']) {
    if (outcome === 'win') {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/20';
    }

    if (outcome === 'loss') {
      return 'text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/20';
    }

    return 'text-slate-600 dark:text-slate-400 bg-slate-500/15 border-slate-500/20';
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-black/5 dark:bg-white/5 rounded-full blur-[120px]" />

      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5 lg:px-8"
        >
          <div className="flex items-center gap-4">
            <BrandHomeLink />
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm tracking-wide">Back</span>
            </button>
          </div>

          <div className="w-9" />
        </motion.header>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center md:mb-12"
          >
            <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full border border-black/20 bg-black/10 backdrop-blur-xl dark:border-white/20 dark:bg-white/10 md:h-24 md:w-24">
              <span className="text-3xl md:text-4xl">{currentProfile.username.charAt(0).toUpperCase()}</span>
            </div>
            
            <h1 className="mb-2 text-3xl tracking-tight font-light md:text-4xl">
              @{currentProfile.username}
            </h1>
            <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
              Member since {new Date(currentProfile.memberSince).toLocaleDateString()}
            </p>
            <p className="mt-2 text-sm text-black/45 dark:text-white/45">Player Number {currentProfile.playerNumber || "Unassigned"}</p>
            <p className="mt-2 text-sm text-black/45 dark:text-white/45">{currentProfile.bio || currentProfile.accountNote}</p>

            <div className="mt-6 flex justify-center">
              {!currentProfile.isOwnProfile ? null : !isEditing ? (
                <button
                  onClick={() => {
                    setSaveSuccess(null);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-4 py-2 text-sm text-black/70 transition-all hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                >
                  <PencilLine className="h-4 w-4" />
                  Edit profile
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-4 py-2 text-sm text-black/70 transition-all hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-10 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:mb-12 md:p-6"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-light tracking-tight">Player Card</h2>
                  <p className="mt-1 text-sm text-black/45 dark:text-white/45">Edit your public profile details here.</p>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveSuccess(null);
                      setPasswordSuccess(null);
                      setPasswordError(null);
                      setIsPasswordDialogOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-500/20 dark:text-blue-300"
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignOutDialogOpen(true)}
                    disabled={isLoggingOut}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-700 transition-all hover:bg-rose-500/20 disabled:opacity-60 dark:text-rose-300"
                  >
                    {isLoggingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>

              {saveError ? <p className="mb-4 text-sm text-red-500">{saveError}</p> : null}
              {saveSuccess ? <p className="mb-4 text-sm text-emerald-500">{saveSuccess}</p> : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value.toLowerCase().replace(/[^a-z]/g, "") }))}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none transition-all focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
                  />
                  <span className="mt-2 block text-xs text-black/35 dark:text-white/35">Only lowercase letters, 3-20 characters.</span>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Bio</span>
                  <textarea
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none transition-all focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
                  />
                  <span className="mt-2 block text-right text-xs text-black/35 dark:text-white/35">{form.bio.length}/240</span>
                </label>
              </div>

              <Dialog open={isPasswordDialogOpen} onOpenChange={handlePasswordDialogChange}>
                <DialogContent className="border-black/10 bg-white/96 sm:max-w-md dark:border-white/10 dark:bg-[#161616]/96">
                  <DialogHeader>
                    <DialogTitle className="text-black dark:text-white">Change password</DialogTitle>
                    <DialogDescription className="text-black/55 dark:text-white/55">
                      Enter your current password once and the new password twice for confirmation.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4">
                    {passwordError ? <p className="text-sm text-rose-500">{passwordError}</p> : null}
                    {passwordSuccess ? <p className="text-sm text-emerald-500">{passwordSuccess}</p> : null}

                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Current password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none transition-all focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">New password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none transition-all focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Repeat new password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none transition-all focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
                      />
                    </label>
                  </div>

                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => handlePasswordDialogChange(false)}
                      className="rounded-xl border border-black/10 bg-black/5 px-4 py-2 text-sm text-black/70 transition-all hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isPasswordSaving}
                      className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-500/20 disabled:opacity-60 dark:text-blue-300"
                    >
                      {isPasswordSaving ? "Updating..." : "Update password"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
                <AlertDialogContent className="border-black/10 bg-white/96 dark:border-white/10 dark:bg-[#161616]/96">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-black dark:text-white">Are you sure you want to sign out?</AlertDialogTitle>
                    <AlertDialogDescription className="text-black/55 dark:text-white/55">
                      You will be signed out of your current iChess account and returned to the login screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                    >
                      Yes, sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-8 grid gap-3 md:mb-10 md:grid-cols-3 md:gap-4"
              >
                {profileHighlights.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 + index * 0.1 }}
                    className="rounded-2xl border border-black/10 bg-black/5 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-5"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10">
                      <item.icon className="h-5 w-5 text-black/60 dark:text-white/60" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">{item.label}</p>
                    <p className="mt-2 text-base text-black/80 dark:text-white/80 break-all">{item.value}</p>
                    {item.label === 'Friends' ? (
                      <button
                        type="button"
                        onClick={() => navigate("/friends")}
                        disabled={!currentProfile.isOwnProfile}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-600 transition-all hover:bg-blue-500/20 dark:text-blue-400"
                      >
                        <Users className="h-4 w-4" />
                        Friends list
                      </button>
                    ) : null}
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="mb-10 grid grid-cols-2 gap-3 md:mb-12 md:grid-cols-4 md:gap-4"
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                    className="rounded-2xl border border-black/10 bg-black/5 p-4 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6"
                  >
                    <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10 md:mb-4 md:h-10 md:w-10">
                      <stat.icon className="w-5 h-5 text-black/60 dark:text-white/60" />
                    </div>
                    <p className="mb-1 text-2xl font-light md:text-3xl">{stat.value}</p>
                    <p className="text-xs text-black/40 dark:text-white/40 tracking-wide">{stat.label}</p>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-10 md:mb-12"
              >


                <div className="flex flex-wrap items-stretch justify-center gap-3">
                  {profileModes.map((mode) => {
                    const isActive = selectedMode === mode.id;

                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSelectedMode(mode.id)}
                        className={`min-w-[150px] rounded-[1.35rem] border px-4 py-3 text-left transition-all ${mode.accentClassName} ${isActive ? "scale-[1.01] shadow-[0_18px_45px_rgba(15,23,42,0.10)]" : "opacity-75 hover:opacity-100"}`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[10px] uppercase tracking-[0.28em]">{mode.eyebrow}</p>
                          <mode.icon className="h-4 w-4" />
                        </div>
                        <p className="text-base font-medium">{mode.title}</p>
                        <p className="mt-2 text-xs opacity-75">
                          {mode.id === "ai"
                            ? `${currentProfile.modeStats[mode.id].totalGames} Games`
                            : `${currentProfile.modeStats[mode.id].rating} Elo`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="mb-10 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:mb-12 md:p-6"
              >
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-light tracking-tight">Recent Games</h2>
                    <p className="mt-1 text-sm text-black/45 dark:text-white/45">{recentGamesSubtitle}</p>
                  </div>

                  <button
                    onClick={() => navigate("/game-history")}
                    className="hidden items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-4 py-2 text-sm text-black/70 transition-all hover:bg-black/10 md:flex dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  >
                    Full history
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {recentGames.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 px-6 py-10 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-base text-black/65 dark:text-white/65">No completed games yet.</p>
                    <p className="mt-2 text-sm text-black/40 dark:text-white/40">{recentGamesEmptyState}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentGames.map((game, index) => (
                      <motion.button
                        key={game.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.4 + index * 0.06 }}
                        onClick={() => navigate('/game-history')}
                        className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white/55 px-4 py-3.5 text-left transition-all hover:border-black/20 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${getOutcomeStyles(game.outcome)}`}>
                            {game.mode === 'ai' ? <Brain className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-medium text-black/80 dark:text-white/80">{getOutcomeLabel(game.outcome)}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${getOutcomeStyles(game.outcome)}`}>
                                {game.outcome}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-black/55 dark:text-white/55">
                              vs {game.opponentLabel} · {game.mode === 'ai' ? `AI ${getStockfishLevelMeta(game.difficulty ?? DEFAULT_STOCKFISH_LEVEL).title} · ${getStockfishLevelMeta(game.difficulty ?? DEFAULT_STOCKFISH_LEVEL).elo} Elo` : `Playing ${game.playerColor}`}
                            </p>
                            {game.opponentPlayerNumber ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const numericPlayerNumber = game.opponentPlayerNumber?.replace(/[^0-9]/g, '');
                                  if (!numericPlayerNumber) {
                                    return;
                                  }

                                  navigate(`/profile/${numericPlayerNumber}`);
                                }}
                                className="mt-1 text-sm text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                @{game.opponentLabel}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm text-black/70 dark:text-white/70">{new Date(game.date).toLocaleDateString()}</p>
                          <p className="mt-1 text-xs text-black/40 dark:text-white/40">{formatDuration(game.duration)}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-center"
              >
                <button
                  onClick={() => navigate("/game-history")}
                  className="flex items-center gap-2 mx-auto px-6 py-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-500 dark:text-blue-400 hover:bg-blue-500/25 transition-all text-sm font-medium"
                >
                  View Full Game History
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}