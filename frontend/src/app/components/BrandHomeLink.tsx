import { useNavigate } from "react-router";

export function BrandHomeLink() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
      aria-label="Go to dashboard"
      type="button"
    >
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
        <img
          src="/branding/ichesspng.png"
          alt="iChess logo"
          className="h-7 w-7 object-contain"
        />
      </div>
      <span className="text-lg font-light tracking-tight">iChess</span>
    </button>
  );
}