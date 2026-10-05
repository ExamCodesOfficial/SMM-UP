import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Monochrome architectural brand glyphs.
 * Each platform is rendered as authentic brand geometry in silver/white
 * line-art on a 24px grid — zero color fills, uniform 1.6 stroke discipline.
 */

// ── 1. TELEGRAM — classic paper plane with fold crease ───────
export function TelegramIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 21.2 3.3 L 3.1 11.1 L 8.6 13.7 L 8.35 18.9 L 11.9 15.6 L 16.9 19.6 L 21.2 3.3 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M 8.6 13.7 L 21.2 3.3" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <path d="M 8.35 18.9 L 9.4 14.6" stroke="currentColor" strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
    </svg>
  );
}

// ── 2. INSTAGRAM — rounded square, lens circle, viewfinder dot ─
export function InstagramIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        rx="4.8"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.1" cy="6.9" r="1.2" fill="currentColor" />
    </svg>
  );
}

// ── 3. YOUTUBE — broadcast rounded rect + play triangle ──────
export function YouTubeIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <rect
        x="2.4"
        y="5.6"
        width="19.2"
        height="12.8"
        rx="3.6"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M 10.1 9.1 L 15.4 12 L 10.1 14.9 Z" fill="currentColor" />
    </svg>
  );
}

// ── 4. FACEBOOK — authentic lowercase 'f' letterform ─────────
export function FacebookIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 15.8 4.3 H 13.2 C 10.9 4.3 9.6 5.8 9.6 8.1 V 10.2 H 7.4 V 13.6 H 9.6 V 21 H 13.2 V 13.6 H 15.5 L 16 10.2 H 13.2 V 8.5 C 13.2 7.9 13.6 7.8 14.1 7.8 H 15.8 Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── 5. TWITTER / X — official X letterform ───────────────────
export function TwitterXIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 17.9 3.4 H 21 L 14.2 11.2 L 22.2 20.6 H 15.6 L 10.9 14.5 L 5.6 20.6 H 2.5 L 9.6 12.4 L 1.9 3.4 H 8.7 L 13 9 L 17.9 3.4 Z M 16.8 18.9 H 18.7 L 7.2 5 H 5.2 L 16.8 18.9 Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── 6. TIKTOK — musical note, stem + resonant circle ──────────
export function TikTokIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <circle
        cx="11.6"
        cy="14.9"
        r="3.55"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M 15.2 14.9 V 4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 15.2 4.8 C 15.8 6.8 17.4 8.2 19.6 8.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 12.5 11.9 C 13.4 12.3 14.1 12.9 14.6 13.8"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── 7. SPOTIFY — circle with three acoustic arcs ──────────────
export function SpotifyIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M 6.8 9.9 C 9.4 8.7 13.4 8.7 17.2 9.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 7.3 12.9 C 9.7 11.9 13 11.9 16.4 12.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
      <path d="M 7.9 15.7 C 10.1 15 12.6 15 15.5 15.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// ── 8. DISCORD — Clyde-inspired gamepad body with optics ──────
export function DiscordIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 7.2 5.6 C 8.8 4.9 10.4 4.7 12 4.7 C 13.6 4.7 15.2 4.9 16.8 5.6 C 18.9 8.2 19.7 10.4 20 13.6 C 18.9 15.4 17.3 16.5 15.4 17 L 14.5 15.3 C 15.6 14.9 16.4 14.4 17.1 13.7"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M 7.2 5.6 C 5.1 8.2 4.3 10.4 4 13.6 C 5.1 15.4 6.7 16.5 8.6 17 L 9.5 15.3 C 8.4 14.9 7.6 14.4 6.9 13.7"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="9.3" cy="11.1" r="1.15" fill="currentColor" />
      <circle cx="14.7" cy="11.1" r="1.15" fill="currentColor" />
    </svg>
  );
}

// ── 9. LINKEDIN — tile with authentic "in" geometry ──────────
export function LinkedInIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M 7.6 10.2 V 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.6" cy="7.4" r="1.25" fill="currentColor" />
      <path
        d="M 11.2 17 V 10.2 M 11.2 13.6 C 11.7 12.2 13 11.3 14.4 11.3 C 16.2 11.3 16.9 12.5 16.9 14.2 V 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── 10. WHATSAPP — conversation bubble + handset ──────────────
export function WhatsAppIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 12 3.4 A 8.6 8.6 0 0 0 4.5 16.9 L 3.2 20.8 L 7.3 19.6 A 8.6 8.6 0 1 0 12 3.4 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M 9.2 8.3 C 8.5 8.3 8 8.9 8 9.7 C 8 12.3 11.7 16 14.3 16 C 15.1 16 15.7 15.5 15.7 14.8 C 15.7 14.4 15.5 14.1 15.2 13.9 L 13.9 13.2 C 13.6 13.1 13.3 13.1 13.1 13.3 L 12.8 13.6 C 12.1 13.2 11.3 12.4 10.8 11.6 L 11.1 11.3 C 11.3 11.1 11.3 10.8 11.2 10.5 L 10.5 9.2 C 10.3 8.9 9.9 8.3 9.2 8.3 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── 11. WEB TRAFFIC — meridian globe ──────────────────────────
export function GlobeTrafficIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <ellipse cx="12" cy="12" rx="3.6" ry="8.6" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
      <line x1="3.4" y1="12" x2="20.6" y2="12" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
      <path d="M 5.1 7.2 H 18.9" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
      <path d="M 5.1 16.8 H 18.9" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
    </svg>
  );
}

// ── 12. ALL PLATFORMS — four-point sparkle ────────────────────
export function SparklesAllIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
      <path
        d="M 12 2.8 L 13.9 10.1 L 21.2 12 L 13.9 13.9 L 12 21.2 L 10.1 13.9 L 2.8 12 L 10.1 10.1 Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

// ── Platform resolver: maps service category/name → glyph ────
export interface PlatformInfo {
  name: string;
  icon: React.FC<IconProps>;
}

export function getPlatformInfo(category: string, name: string): PlatformInfo {
  const combined = (category + " " + name).toLowerCase();

  if (/telegram|\btg\b/i.test(combined)) return { name: "Telegram", icon: TelegramIcon };
  if (/instagram|\big\b|reels/i.test(combined)) return { name: "Instagram", icon: InstagramIcon };
  if (/youtube|\byt\b/i.test(combined)) return { name: "YouTube", icon: YouTubeIcon };
  if (/facebook|\bfb\b/i.test(combined)) return { name: "Facebook", icon: FacebookIcon };
  if (/twitter|\bx\b|tweet/i.test(combined)) return { name: "Twitter / X", icon: TwitterXIcon };
  if (/tiktok/i.test(combined)) return { name: "TikTok", icon: TikTokIcon };
  if (/spotify/i.test(combined)) return { name: "Spotify", icon: SpotifyIcon };
  if (/discord/i.test(combined)) return { name: "Discord", icon: DiscordIcon };
  if (/linkedin/i.test(combined)) return { name: "LinkedIn", icon: LinkedInIcon };
  if (/whatsapp/i.test(combined)) return { name: "WhatsApp", icon: WhatsAppIcon };
  if (/traffic|website|visitor|seo/i.test(combined)) return { name: "Web Traffic", icon: GlobeTrafficIcon };

  return { name: "Other", icon: SparklesAllIcon };
}
