import type { AddonInstance } from "@addons-poc/protocol";
import { href, Link, ROUTES } from "../router";

interface HeaderProps {
  addons: AddonInstance[];
  searchValue: string;
  searchDisabled?: boolean;
  searching?: boolean;
  onSearchValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  onSettingsNavigate?: () => void;
}

export function Header({
  addons,
  searchValue,
  searchDisabled = false,
  searching = false,
  onSearchValueChange,
  onSearch,
  onClearSearch,
  onSettingsNavigate,
}: HeaderProps) {
  const readyCount = addons.filter((addon) => addon.status === "ready").length;
  const errorCount = addons.filter((addon) => addon.status === "error").length;

  return (
    <header className="host-site-header">
      <div className="host-header-inner">
        <a className="host-brand" href={href(ROUTES.home)} aria-label="PeekMosaic home">
          <img src="/peekmosaic-logo-horizontal.svg" alt="PeekMosaic.com" width="180" height="65" />
        </a>

        <form
          className="host-header-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(searchValue);
          }}
        >
          <label htmlFor="global-addon-search" className="host-visually-hidden">
            Search add-ons
          </label>
          <div className="host-header-search-field">
            <input
              id="global-addon-search"
              name="global-addon-search"
              className="host-header-search-input"
              type="search"
              autoComplete="on"
              value={searchValue}
              onChange={(event) => {
                const value = event.target.value;
                onSearchValueChange(value);
                if (!value) onClearSearch();
              }}
              placeholder="Search add-ons…"
              aria-keyshortcuts="Enter Escape"
              disabled={searchDisabled}
            />
            <button
              type="submit"
              className="host-header-search-submit"
              aria-label="Search"
              title="Search"
              disabled={searchDisabled}
              data-searching={searching || undefined}
            >
              {searching ? "…" : "↵"}
            </button>
          </div>
          <span className="host-header-search-hint">
            Enter or click ↵ to search · Esc to return or clear
          </span>
        </form>

        <div className="host-header-actions">
          <div className="host-addon-status" aria-label={`${readyCount} active add-ons${errorCount ? `, ${errorCount} errors` : ""}`}>
            <span className="host-addon-status-active">● {readyCount} active</span>
            {errorCount > 0 && <span className="host-addon-status-error">● {errorCount} error(s)</span>}
          </div>

          <nav aria-label="Main navigation" className="host-header-nav">
            <Link to={ROUTES.home} className="host-header-link">Start</Link>
            <Link to={ROUTES.settings} onNavigate={onSettingsNavigate} className="host-header-link host-header-settings-link">
              <span aria-hidden="true">⚙</span> Settings
            </Link>
          </nav>
        </div>
      </div>
      <div id="host-reading-status" />
    </header>
  );
}
