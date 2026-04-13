import BrandLogo from "./components/BrandLogo.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import InstallAppButton from "./components/InstallAppButton.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar sb-surface">
        <div className="topbar-left">
          <BrandLogo className="h-10" />
          <div>
            <div className="brand-title">iPmart AI</div>
            <div className="brand-subtitle">AI workspace</div>
          </div>
        </div>

        <div className="topbar-right">
          <InstallAppButton />
          <ThemeToggle />
        </div>
      </header>

      <main className="main-content">
        <section className="sb-card hero-card">
          <h1>Welcome to iPmart AI</h1>
          <p>
            Theme, branding, dark mode, and PWA structure are now connected.
          </p>
        </section>
      </main>
    </div>
  );
}