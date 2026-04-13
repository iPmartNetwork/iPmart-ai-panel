import { BRAND } from "../config/brand.js";

export default function BrandLogo({ className = "" }) {
  const isDark = document.documentElement.classList.contains("dark");
  const src = isDark ? BRAND.logoDark : BRAND.logoLight;

  return (
    <img
      src={src}
      alt={`${BRAND.name} logo`}
      className={`brand-logo ${className}`}
    />
  );
}