import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { apiClient } from "../../lib/api";

export function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPlayerNumber, setNextPlayerNumber] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const session = await apiClient.verifySession();
        if (isMounted && session.valid) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        apiClient.clearToken();
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (mode !== "register") {
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const preview = await apiClient.getRegistrationPreview();
        if (isMounted) {
          setNextPlayerNumber(preview.playerNumber);
        }
      } catch {
        if (isMounted) {
          setNextPlayerNumber(null);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (mode === "register") {
        await apiClient.register(username, password);
      } else {
        await apiClient.login(username, password);
      }

      navigate("/dashboard", { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Failed to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

  const isBusy = isLoading || isCheckingSession;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-black/5 dark:bg-white/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-10 text-center"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-black/10 to-black/5 dark:from-white/10 dark:to-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl mb-8">
            <img
              src="/branding/ichesspng.png"
              alt="iChess logo"
              className="w-14 h-14 object-contain"
            />
          </div>
          
          <h1 className="text-5xl tracking-tight mb-3 font-light text-black dark:text-white">
            iChess
          </h1>

          <p className="text-black/40 dark:text-white/40 tracking-wide text-sm font-light">
            Username and password access for your iChess account
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="rounded-[2rem] border border-black/10 bg-white/60 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 md:p-8"
        >
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-black/5 p-1 dark:bg-white/5">
            {([
              { id: "login" as const, label: "Log in" },
              { id: "register" as const, label: "Create account" },
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setMode(option.id);
                  setError(null);
                }}
                disabled={isBusy}
                className={`rounded-[1rem] px-4 py-3 text-sm tracking-wide transition-all ${
                  mode === option.id
                    ? "bg-black text-white shadow-lg dark:bg-white dark:text-black"
                    : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2 text-left">
              <label htmlFor="username" className="text-sm text-black/60 dark:text-white/60">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                disabled={isBusy}
                placeholder="yourname"
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-black/30 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-white/30"
              />
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="password" className="text-sm text-black/60 dark:text-white/60">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
                placeholder="At least 6 characters"
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-black/30 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-white/30"
              />
            </div>

            {mode === "register" ? (
              <div className="space-y-2 text-left">
                <label htmlFor="confirm-password" className="text-sm text-black/60 dark:text-white/60">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isBusy}
                  placeholder="Repeat your password"
                  className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-black/30 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-white/30"
                />
              </div>
            ) : null}

            {mode === "register" ? (
              <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
                {nextPlayerNumber ? `If you register now, your Player Number will be ${nextPlayerNumber}.` : "Loading your next Player Number..."}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isBusy || !username.trim() || !password}
              className="w-full rounded-2xl bg-black px-5 py-3 text-sm tracking-wide text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/85"
            >
              {isCheckingSession
                ? "Checking session..."
                : isLoading
                  ? mode === "register"
                    ? "Creating account..."
                    : "Logging in..."
                  : mode === "register"
                    ? "Create account"
                    : "Log in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-black/40 dark:text-white/40">
            Usernames use lowercase letters only.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-8 text-center text-black/30 dark:text-white/30 text-xs tracking-wide"
        >
          Secure local sign-in for web MVP access
        </motion.p>
      </motion.div>
    </div>
  );
}