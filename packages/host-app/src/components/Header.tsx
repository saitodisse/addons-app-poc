import type { AddonInstance } from "@addons-poc/protocol";
import { Link, ROUTES } from "../router";

interface HeaderProps {
  addons: AddonInstance[];
  searchValue: string;
  searchDisabled?: boolean;
  searching?: boolean;
  onSearchValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
}

export function Header({
  addons,
  searchValue,
  searchDisabled = false,
  searching = false,
  onSearchValueChange,
  onSearch,
  onClearSearch,
}: HeaderProps) {
  const readyCount = addons.filter((a) => a.status === "ready").length;
  const errorCount = addons.filter((a) => a.status === "error").length;

  return (
    <header
      className="host-site-header"
      style={{
        background: "rgba(15, 23, 42, 0.8)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🧩</span>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: 0,
                color: "#f1f5f9",
              }}
            >
              Add-ons POC
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Add-on system proof of concept
            </p>
          </div>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(searchValue);
          }}
          style={{
            flex: "1 1 320px",
            minWidth: 240,
            maxWidth: 520,
            display: "grid",
            gap: 4,
          }}
        >
          <label
            htmlFor="global-addon-search"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            Search add-ons
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="global-addon-search"
              name="global-addon-search"
              type="search"
              autoComplete="on"
              value={searchValue}
              onChange={(event) => {
                const value = event.target.value;
                onSearchValueChange(value);
                if (!value) onClearSearch();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClearSearch();
                }
              }}
              placeholder="Search add-ons…"
              aria-keyshortcuts="Enter Escape"
              disabled={searchDisabled}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 42px 10px 13px",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                background: "rgba(2,6,23,0.5)",
                color: "#f1f5f9",
                font: "inherit",
                fontSize: 13,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: searching ? "#fbbf24" : "#64748b",
                fontSize: 13,
              }}
            >
              {searching ? "…" : "↵"}
            </span>
          </div>
          <span style={{ color: "#64748b", fontSize: 10 }}>
            Enter to search · Esc to clear
          </span>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            <span style={{ color: "#22c55e" }}>● {readyCount} active</span>
            {errorCount > 0 && (
              <span style={{ color: "#ef4444" }}>● {errorCount} error(s)</span>
            )}
          </div>

          <nav
            aria-label="Main navigation"
            style={{ display: "flex", gap: 8 }}
          >
            <Link
              to={ROUTES.home}
              style={{
                padding: "8px 16px",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                color: "#e2e8f0",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Start
            </Link>
            <Link
              to={ROUTES.settings}
              style={{
                padding: "8px 16px",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                color: "#e2e8f0",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              ⚙️ Settings
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
