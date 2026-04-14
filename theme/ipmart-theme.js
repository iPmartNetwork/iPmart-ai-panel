(() => {
  const THEME_KEY = "ipmart-theme";
  const LIGHT = "light";
  const DARK = "dark";

  const BRAND = {
    name: "iPmart AI",
    shortName: "iPmart",
    logoLight: "/branding/ipmart-logo.svg",
    logoDark: "/branding/ipmart-logo-dark.svg",
    mark: "/branding/ipmart-mark.svg",
    favicon: "/favicon.ico",
    appleTouchIcon: "/icons/apple-touch-icon.png",
    manifest: "/manifest.webmanifest",
    themeColorLight: "#19C37D",
    themeColorDark: "#031B22"
  };

  let observer = null;
  let patchScheduled = false;

  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function getPreferredTheme() {
    const saved = safeLocalStorageGet(THEME_KEY);
    if (saved === LIGHT || saved === DARK) return saved;

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
    } catch {
      return LIGHT;
    }
  }

  function currentTheme() {
    return document.documentElement.classList.contains(DARK) ? DARK : LIGHT;
  }

  function ensureMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    if (content != null) meta.setAttribute("content", content);
    return meta;
  }

  function ensureLink(rel, href) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", rel);
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
    return link;
  }

  function setThemeMeta(theme) {
    const color = theme === DARK ? BRAND.themeColorDark : BRAND.themeColorLight;
    ensureMeta("theme-color", color);
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-title", BRAND.name);
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove(LIGHT, DARK);
    root.classList.add(theme);
    root.setAttribute("data-theme", theme);
    safeLocalStorageSet(THEME_KEY, theme);
    setThemeMeta(theme);
    patchBranding();
    updateThemeToggle();
  }

  function toggleTheme() {
    applyTheme(currentTheme() === DARK ? LIGHT : DARK);
  }

  function patchDocumentHead() {
    document.title = BRAND.name;
    ensureLink("manifest", BRAND.manifest);
    ensureLink("icon", BRAND.favicon);
    ensureLink("apple-touch-icon", BRAND.appleTouchIcon);
    setThemeMeta(currentTheme());
  }

  function replaceImgLogo(img) {
    const theme = currentTheme();
    const nextSrc = theme === DARK ? BRAND.logoDark : BRAND.logoLight;

    if (img.dataset.ipmartFixed === "true" && img.getAttribute("src") === nextSrc) {
      return;
    }

    img.setAttribute("src", nextSrc);
    img.setAttribute("alt", BRAND.name);
    img.classList.add("brand-logo");
    img.dataset.ipmartFixed = "true";
  }

  function replaceSvgContainer(node) {
    if (node.dataset.ipmartBrandSvg === "true") return;

    const wrapper = document.createElement("span");
    wrapper.className = "ipmart-brand-inline";
    wrapper.dataset.ipmartBrandSvg = "true";

    const img = document.createElement("img");
    img.src = currentTheme() === DARK ? BRAND.logoDark : BRAND.logoLight;
    img.alt = BRAND.name;
    img.className = "brand-logo ipmart-brand-inline-logo";

    wrapper.appendChild(img);

    if (node.parentNode) {
      node.parentNode.replaceChild(wrapper, node);
    }
  }

  function looksLikeBrandText(text) {
    const normalized = (text || "").trim().toLowerCase();
    return (
      normalized === "open webui" ||
      normalized === "openwebui" ||
      normalized === "open webui." ||
      normalized === "open web ui" ||
      normalized === "open webui chat" ||
      normalized === "webui"
    );
  }

  function patchTextBranding(root = document) {
    const nodes = root.querySelectorAll("h1,h2,h3,h4,div,span,p,strong");
    nodes.forEach((node) => {
      if (!node || !node.textContent) return;
      if (node.children.length > 0) return;

      const text = node.textContent.trim();
      if (!looksLikeBrandText(text)) return;

      node.textContent = BRAND.name;
      node.dataset.ipmartBrandPatched = "true";
    });
  }

  function patchImageBranding(root = document) {
    const images = root.querySelectorAll("img");
    images.forEach((img) => {
      const alt = (img.getAttribute("alt") || "").toLowerCase();
      const src = (img.getAttribute("src") || "").toLowerCase();
      const cls = (img.getAttribute("class") || "").toLowerCase();

      const looksLikeLogo =
        alt.includes("logo") ||
        alt.includes("open webui") ||
        alt.includes("webui") ||
        src.includes("logo") ||
        src.includes("open-webui") ||
        src.includes("favicon") ||
        cls.includes("logo");

      if (looksLikeLogo) {
        replaceImgLogo(img);
      }
    });
  }

  function patchSvgBranding(root = document) {
    const svgs = root.querySelectorAll("svg");
    svgs.forEach((svg) => {
      const parentText = ((svg.parentElement && svg.parentElement.textContent) || "").trim();
      const aria = (svg.getAttribute("aria-label") || "").toLowerCase();
      const cls = (svg.getAttribute("class") || "").toLowerCase();

      if (
        looksLikeBrandText(parentText) ||
        aria.includes("logo") ||
        aria.includes("webui") ||
        cls.includes("logo")
      ) {
        replaceSvgContainer(svg);
      }
    });
  }

  function patchSidebarBrand(root = document) {
    const containers = root.querySelectorAll("aside, nav, header, [role='banner']");
    containers.forEach((container) => {
      const brandNodes = container.querySelectorAll("span,div,h1,h2,h3");
      brandNodes.forEach((node) => {
        if (!node.textContent) return;
        const text = node.textContent.trim();
        if (looksLikeBrandText(text)) {
          node.textContent = BRAND.name;
          node.dataset.ipmartSidebarBrand = "true";
        }
      });
    });
  }

  function patchBranding() {
    patchDocumentHead();
    patchTextBranding(document);
    patchImageBranding(document);
    patchSvgBranding(document);
    patchSidebarBrand(document);
  }

  function createThemeToggle() {
    if (document.querySelector("[data-ipmart-theme-toggle]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ipmart-theme-toggle";
    button.setAttribute("data-ipmart-theme-toggle", "true");
    button.setAttribute("aria-label", "Toggle theme");
    button.setAttribute("title", "Toggle theme");
    button.innerHTML = `
      <span class="ipmart-theme-toggle-icon" data-ipmart-theme-toggle-icon>🌓</span>
    `;

    button.addEventListener("click", toggleTheme);
    document.body.appendChild(button);
    updateThemeToggle();
  }

  function updateThemeToggle() {
    const button = document.querySelector("[data-ipmart-theme-toggle]");
    if (!button) return;

    const dark = currentTheme() === DARK;
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");

    const icon = button.querySelector("[data-ipmart-theme-toggle-icon]");
    if (icon) icon.textContent = dark ? "☀️" : "🌙";
  }

  function createInstallButton() {
    if (document.querySelector("[data-ipmart-install-button]")) return;

    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;

      if (!document.querySelector("[data-ipmart-install-button]")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ipmart-install-button";
        button.setAttribute("data-ipmart-install-button", "true");
        button.textContent = "Install App";

        button.addEventListener("click", async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          try {
            await deferredPrompt.userChoice;
          } catch {}
          deferredPrompt = null;
          button.remove();
        });

        document.body.appendChild(button);
      }
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    });
  }

  function schedulePatch() {
    if (patchScheduled) return;
    patchScheduled = true;
    requestAnimationFrame(() => {
      patchScheduled = false;
      patchBranding();
      updateThemeToggle();
    });
  }

  function observeDom() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      schedulePatch();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  function listenSystemThemeChanges() {
    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", () => {
        const stored = safeLocalStorageGet(THEME_KEY);
        if (!stored) {
          applyTheme(media.matches ? DARK : LIGHT);
        }
      });
    } catch {}
  }

  function boot() {
    applyTheme(getPreferredTheme());
    patchBranding();
    createThemeToggle();
    createInstallButton();
    registerServiceWorker();
    observeDom();
    listenSystemThemeChanges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();