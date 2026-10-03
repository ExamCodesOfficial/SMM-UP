import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * SMM UP Primary Emblem Logo
 * Inspired by valence-logo-concept-c and examcodes-logo from thatonearyan-sh
 */
export function SmmUpLogo({ size = 32, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="SMM UP Emblem"
    >
      <rect width="128" height="128" rx="28" fill="#090807" />
      <rect
        x="4"
        y="4"
        width="120"
        height="120"
        rx="24"
        fill="none"
        stroke="rgba(255, 245, 230, 0.12)"
        strokeWidth="1.5"
      />
      <defs>
        <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="logoChampagne" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F5E8D0" />
          <stop offset="100%" stopColor="#D4C4A8" />
        </linearGradient>
      </defs>

      <g fill="url(#logoChampagne)" filter="url(#logoGlow)">
        {/* 'U' Channel */}
        <path d="M 28 36 L 28 66 C 28 77 37 84 48 84 C 59 84 68 77 68 66 L 68 36 L 56 36 L 56 65 C 56 70 52 73 48 73 C 44 73 40 70 40 65 L 40 36 Z" />
        {/* 'P' Pillar & Loop */}
        <rect x="74" y="36" width="11" height="48" rx="2" />
        <path
          d="M 85 36 L 98 36 C 105 36 110 40 110 48 C 110 56 105 60 98 60 L 85 60 Z M 95 46 L 95 50 C 97 50 99 49 99 48 C 99 47 97 46 95 46 Z"
          fillRule="evenodd"
        />
        {/* Supersonic Apex Arrow */}
        <polygon points="79.5,24 85,32 74,32" />
      </g>

      <circle cx="85" cy="48" r="3" fill="#FFFFFF" />
      <circle cx="85" cy="48" r="1.5" fill="#090807" />

      {/* Signature Telemetry Lines */}
      <line
        x1="32"
        y1="102"
        x2="96"
        y2="102"
        stroke="#FAF7F2"
        strokeWidth="2"
        opacity="0.6"
        strokeLinecap="round"
      />
      <line
        x1="42"
        y1="108"
        x2="86"
        y2="108"
        stroke="#FAF7F2"
        strokeWidth="1.5"
        opacity="0.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Executive Order Icon
 * Architectural supersonic growth chevron with central guidance core & firing vectors.
 * Replaces generic ShoppingBag / Send icons.
 */
export function ExecutiveOrderIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Primary Supersonic Forward Chevron */}
      <path
        d="M 4 19 L 19 12 L 4 5 L 8 12 Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Precision Internal Core Vector */}
      <path
        d="M 8 12 L 19 12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Telemetry Guidance Node */}
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      {/* High-speed auxiliary thrust markers */}
      <line
        x1="2"
        y1="9"
        x2="5"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="2"
        y1="15"
        x2="5"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * Executive Catalog Icon
 * Architectural multi-tier database strata cube with isometric levels & telemetry matrix.
 * Replaces generic Layers / Sparkles.
 */
export function ExecutiveCatalogIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Top Layer Strata */}
      <path
        d="M 12 2.5 L 21 6.8 L 12 11.2 L 3 6.8 Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Mid Layer Tier */}
      <path
        d="M 3 11.5 L 12 15.8 L 21 11.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base Layer Foundation */}
      <path
        d="M 3 16.5 L 12 20.8 L 21 16.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.65"
      />
      {/* Central Matrix Node */}
      <circle cx="12" cy="6.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Executive Wallet Icon
 * Cryptographic vault card & secure ledger shield with micro-chip tracery and luminous node.
 * Replaces generic 2D wallet box.
 */
export function ExecutiveWalletIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Outer Vault Card Perimeter */}
      <rect
        x="2.5"
        y="4.5"
        width="19"
        height="15"
        rx="3"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Magnetic / Cryptographic Ledger Band */}
      <path
        d="M 2.5 8.5 L 21.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      {/* Smart Vault Lock Chamber */}
      <rect
        x="13.5"
        y="11"
        width="6"
        height="5.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Security Core Keyhole Node */}
      <circle cx="16.5" cy="13.75" r="1" fill="currentColor" />
      {/* Micro-Chip Circuit Lines */}
      <path
        d="M 5.5 12.5 H 8.5 V 15.5 H 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * Executive Order History / Telemetry Logs Icon
 */
export function ExecutiveHistoryIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Telemetry Chrono Ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="40 16"
        opacity="0.85"
      />
      {/* Precision Chrono Hands */}
      <path
        d="M 12 7 V 12 L 15.5 14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center Pivot Node */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Executive Mass Order Matrix Icon
 */
export function ExecutiveMassIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Matrix 4-Node Grid */}
      <rect
        x="3.5"
        y="3.5"
        width="6.5"
        height="6.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="3.5"
        width="6.5"
        height="6.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3.5"
        y="14"
        width="6.5"
        height="6.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="14"
        width="6.5"
        height="6.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Connection Synapse */}
      <line x1="10" y1="6.75" x2="14" y2="6.75" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      <line x1="6.75" y1="10" x2="6.75" y2="14" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}
