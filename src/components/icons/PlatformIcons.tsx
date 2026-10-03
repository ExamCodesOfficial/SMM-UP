import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

// ── 1. TELEGRAM ────────────────────────────────────────────────
export function TelegramIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="12" cy="12" r="12" fill="#24A1DE" />
      <path
        d="M17.5 7.2L5.8 11.7C5 12 5 12.5 5.7 12.7L8.7 13.6L15.6 9.3C15.9 9.1 16.2 9.2 16 9.4L10.4 14.5L10.2 17.5C10.5 17.5 10.6 17.4 10.8 17.2L12.3 15.8L15.4 18.1C16 18.4 16.4 18.2 16.5 17.5L18.5 8C18.7 7.2 18.2 6.8 17.5 7.2Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 2. INSTAGRAM ───────────────────────────────────────────────
export function InstagramIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        <radialGradient id="igGrad" cx="30%" cy="107%" r="130%" fx="30%" fy="107%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#igGrad)" />
      <path
        d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7ZM12 15.2C10.23 15.2 8.8 13.77 8.8 12C8.8 10.23 10.23 8.8 12 8.8C13.77 8.8 15.2 10.23 15.2 12C15.2 13.77 13.77 15.2 12 15.2ZM17.4 7.8C17.4 8.46 16.86 9 16.2 9C15.54 9 15 8.46 15 7.8C15 7.14 15.54 6.6 16.2 6.6C16.86 6.6 17.4 7.14 17.4 7.8ZM21.8 7.2C21.7 5.2 20.3 3.8 18.3 3.7C16.8 3.6 7.2 3.6 5.7 3.7C3.7 3.8 2.3 5.2 2.2 7.2C2.1 8.7 2.1 18.3 2.2 19.8C2.3 21.8 3.7 23.2 5.7 23.3C7.2 23.4 16.8 23.4 18.3 23.3C20.3 23.2 21.7 21.8 21.8 19.8C21.9 18.3 21.9 8.7 21.8 7.2ZM19.5 19.6C19.1 20.7 18.2 21.5 17.1 21.6C15.9 21.7 8.1 21.7 6.9 21.6C5.8 21.5 4.9 20.7 4.5 19.6C4.4 18.4 4.4 10.6 4.5 9.4C4.9 8.3 5.8 7.5 6.9 7.4C8.1 7.3 15.9 7.3 17.1 7.4C18.2 7.5 19.1 8.3 19.5 9.4C19.6 10.6 19.6 18.4 19.5 19.6Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 3. YOUTUBE ─────────────────────────────────────────────────
export function YouTubeIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="#FFFFFF" />
    </svg>
  );
}

// ── 4. FACEBOOK ────────────────────────────────────────────────
export function FacebookIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M14.5 12H12.5V19H9.5V12H8V9.5H9.5V8C9.5 6.4 10.5 5 12.5 5H14.5V7.5H13C12.4 7.5 12.5 7.8 12.5 8.3V9.5H14.8L14.5 12Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 5. TWITTER / X ─────────────────────────────────────────────
export function TwitterXIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#111111" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <path
        d="M15.8 6.5H17.6L13.7 11L18.3 17.5H14.7L11.8 13.7L8.6 17.5H6.8L11 12.7L6.5 6.5H10.2L12.8 10L15.8 6.5ZM15.2 16.4H16.2L9.7 7.5H8.6L15.2 16.4Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 6. TIKTOK ──────────────────────────────────────────────────
export function TikTokIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#000000" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <path
        d="M16.5 7.8C15.6 7.7 14.8 7.2 14.3 6.4C14.1 6.1 14 5.7 14 5.3H11.5V15.2C11.4 16.3 10.4 17.1 9.3 17C8.2 16.9 7.3 16 7.3 14.9C7.3 13.8 8.2 12.8 9.3 12.8C9.6 12.8 9.8 12.9 10 13V10.4C7.3 10.6 5.2 12.9 5.3 15.6C5.4 18.3 7.7 20.4 10.4 20.3C13 20.2 15.1 18.1 15.1 15.5V10.1C16.3 11 17.8 11.4 19.3 11.3V8.8C18.2 8.8 17.2 8.4 16.5 7.8Z"
        fill="#25F4EE"
      />
      <path
        d="M17 8.3C16.1 8.2 15.3 7.7 14.8 6.9C14.6 6.6 14.5 6.2 14.5 5.8H12V15.7C11.9 16.8 10.9 17.6 9.8 17.5C8.7 17.4 7.8 16.5 7.8 15.4C7.8 14.3 8.7 13.3 9.8 13.3C10.1 13.3 10.3 13.4 10.5 13.5V10.9C7.8 11.1 5.7 13.4 5.8 16.1C5.9 18.8 8.2 20.9 10.9 20.8C13.5 20.7 15.6 18.6 15.6 16V10.6C16.8 11.5 18.3 11.9 19.8 11.8V9.3C18.7 9.3 17.7 8.9 17 8.3Z"
        fill="#FE2C55"
        style={{ mixBlendMode: "screen" }}
      />
    </svg>
  );
}

// ── 7. SPOTIFY ─────────────────────────────────────────────────
export function SpotifyIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path
        d="M17.3 15.8C17.1 16.1 16.7 16.2 16.4 16C13.6 14.3 10.1 13.9 6.8 14.7C6.4 14.8 6.1 14.5 6 14.1C5.9 13.7 6.2 13.4 6.6 13.3C10.3 12.4 14.2 12.9 17.3 14.8C17.6 15 17.7 15.4 17.3 15.8ZM18.5 13.1C18.2 13.5 17.7 13.6 17.3 13.4C14.2 11.5 9.4 10.9 6.2 11.9C5.7 12 5.2 11.7 5.1 11.3C5 10.8 5.3 10.3 5.7 10.2C9.5 9 14.8 9.7 18.3 11.9C18.7 12.1 18.8 12.6 18.5 13.1ZM18.6 10.3C14.8 8 8.6 7.8 5 8.9C4.4 9.1 3.8 8.7 3.6 8.1C3.4 7.5 3.8 6.9 4.4 6.7C8.6 5.4 15.4 5.7 19.8 8.3C20.3 8.6 20.5 9.2 20.2 9.7C19.9 10.2 19.2 10.4 18.6 10.3Z"
        fill="#000000"
      />
    </svg>
  );
}

// ── 8. DISCORD ─────────────────────────────────────────────────
export function DiscordIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#5865F2" />
      <path
        d="M17.8 7.5C16.6 6.9 15.3 6.5 13.9 6.3C13.7 6.6 13.5 7.1 13.3 7.5C11.9 7.3 10.5 7.3 9.1 7.5C8.9 7.1 8.7 6.6 8.5 6.3C7.1 6.5 5.8 6.9 4.6 7.5C2.3 11 1.7 14.4 2 17.8C3.5 18.9 5 19.6 6.5 20C6.9 19.5 7.2 18.9 7.5 18.3C7 18.1 6.5 17.9 6 17.6C6.1 17.5 6.2 17.4 6.4 17.3C9.3 18.6 13.1 18.6 16 17.3C16.2 17.4 16.3 17.5 16.4 17.6C15.9 17.9 15.4 18.1 14.9 18.3C15.2 18.9 15.5 19.5 15.9 20C17.4 19.6 18.9 18.9 20.4 17.8C20.8 13.8 19.7 10.5 17.8 7.5ZM8.5 15.7C7.6 15.7 6.8 14.9 6.8 13.9C6.8 12.9 7.6 12.1 8.5 12.1C9.4 12.1 10.2 12.9 10.2 13.9C10.2 14.9 9.4 15.7 8.5 15.7ZM13.9 15.7C13 15.7 12.2 14.9 12.2 13.9C12.2 12.9 13 12.1 13.9 12.1C14.8 12.1 15.6 12.9 15.6 13.9C15.6 14.9 14.8 15.7 13.9 15.7Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 9. LINKEDIN ────────────────────────────────────────────────
export function LinkedInIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#0A66C2" />
      <path
        d="M6.8 9.5H9.2V17H6.8V9.5ZM8 8.3C7.2 8.3 6.6 7.7 6.6 6.9C6.6 6.1 7.2 5.5 8 5.5C8.8 5.5 9.4 6.1 9.4 6.9C9.4 7.7 8.8 8.3 8 8.3ZM10.6 9.5H12.9V10.5C13.2 9.9 14.1 9.3 15.3 9.3C17.7 9.3 18.2 10.9 18.2 13V17H15.8V13.5C15.8 12.6 15.6 11.5 14.4 11.5C13.2 11.5 13 12.4 13 13.4V17H10.6V9.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 10. WHATSAPP ───────────────────────────────────────────────
export function WhatsAppIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M17.5 14.5C17.2 14.3 15.7 13.6 15.5 13.5C15.2 13.4 15 13.3 14.8 13.6C14.6 13.9 14 14.6 13.8 14.8C13.6 15 13.4 15 13.1 14.9C12.8 14.7 11.8 14.4 10.7 13.4C9.8 12.6 9.2 11.6 9 11.3C8.8 11 9 10.8 9.1 10.7C9.2 10.6 9.4 10.4 9.5 10.2C9.6 10.1 9.7 10 9.8 9.8C9.9 9.6 9.8 9.4 9.7 9.3C9.6 9.2 9.1 8 8.9 7.5C8.7 7 8.5 7.1 8.3 7.1H7.8C7.6 7.1 7.2 7.2 6.9 7.5C6.6 7.8 5.8 8.5 5.8 10C5.8 11.5 6.9 12.9 7 13.1C7.1 13.3 9.1 16.4 12.2 17.7C14.8 18.8 15.4 18.6 16 18.5C16.7 18.4 18.2 17.6 18.5 16.7C18.8 15.8 18.8 15 18.7 14.8C18.6 14.7 18.3 14.6 17.5 14.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── 11. WEBSITE TRAFFIC / WEB ──────────────────────────────────
export function GlobeTrafficIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#18181B" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <circle cx="12" cy="12" r="7.5" stroke="#FFFFFF" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="3.5" ry="7.5" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M4.5 12H19.5" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

// ── 12. ALL PLATFORMS / FEATURED ───────────────────────────────
export function SparklesAllIcon({ className = "w-5 h-5", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <rect width="24" height="24" rx="6" fill="#FFFFFF" />
      <path
        d="M12 4L13.8 9.2L19 11L13.8 12.8L12 18L10.2 12.8L5 11L10.2 9.2L12 4Z"
        fill="#000000"
      />
    </svg>
  );
}

// ── Helper to resolve platform icon dynamically ────────────────
export function getPlatformInfo(categoryName: string, serviceName: string = ""): {
  name: string;
  icon: React.ComponentType<IconProps>;
  color: string;
  bgColor: string;
} {
  const combined = (categoryName + " " + serviceName).toLowerCase();

  if (/telegram|\btg\b/i.test(combined)) {
    return { name: "Telegram", icon: TelegramIcon, color: "#24A1DE", bgColor: "rgba(36,161,222,0.15)" };
  }
  if (/instagram|\big\b|reels/i.test(combined)) {
    return { name: "Instagram", icon: InstagramIcon, color: "#E1306C", bgColor: "rgba(225,48,108,0.15)" };
  }
  if (/youtube|\byt\b/i.test(combined)) {
    return { name: "YouTube", icon: YouTubeIcon, color: "#FF0000", bgColor: "rgba(255,0,0,0.15)" };
  }
  if (/facebook|\bfb\b/i.test(combined)) {
    return { name: "Facebook", icon: FacebookIcon, color: "#1877F2", bgColor: "rgba(24,119,242,0.15)" };
  }
  if (/twitter|\bx\b|tweet/i.test(combined)) {
    return { name: "Twitter / X", icon: TwitterXIcon, color: "#FFFFFF", bgColor: "rgba(255,255,255,0.1)" };
  }
  if (/tiktok/i.test(combined)) {
    return { name: "TikTok", icon: TikTokIcon, color: "#25F4EE", bgColor: "rgba(37,244,238,0.15)" };
  }
  if (/spotify/i.test(combined)) {
    return { name: "Spotify", icon: SpotifyIcon, color: "#1DB954", bgColor: "rgba(29,185,84,0.15)" };
  }
  if (/discord/i.test(combined)) {
    return { name: "Discord", icon: DiscordIcon, color: "#5865F2", bgColor: "rgba(88,101,242,0.15)" };
  }
  if (/linkedin/i.test(combined)) {
    return { name: "LinkedIn", icon: LinkedInIcon, color: "#0A66C2", bgColor: "rgba(10,102,194,0.15)" };
  }
  if (/whatsapp/i.test(combined)) {
    return { name: "WhatsApp", icon: WhatsAppIcon, color: "#25D366", bgColor: "rgba(37,211,102,0.15)" };
  }
  if (/traffic|website|visitor|seo/i.test(combined)) {
    return { name: "Web Traffic", icon: GlobeTrafficIcon, color: "#38BDF8", bgColor: "rgba(56,189,248,0.15)" };
  }

  return { name: "Services", icon: SparklesAllIcon, color: "#FFFFFF", bgColor: "rgba(255,255,255,0.1)" };
}
