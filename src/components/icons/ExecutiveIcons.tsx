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
      <rect width="128" height="128" rx="20" fill="#000000" />
      <rect
        x="4"
        y="4"
        width="120"
        height="120"
        rx="16"
        fill="none"
        stroke="rgba(255, 255, 255, 0.18)"
        strokeWidth="2"
      />
      <defs>
        <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill="#FFFFFF" filter="url(#logoGlow)">
        {/* 'U' Channel */}
        <path d="M 28 36 L 40 36 L 40 64 C 40 68 43 71 47 71 C 51 71 54 68 54 64 L 54 36 L 66 36 L 66 65 C 66 76 58 83 47 83 C 36 83 28 76 28 65 Z" />
        {/* 'P' Pillar & Loop */}
        <path d="M 74 36 L 94 36 C 103 36 109 41 109 49 C 109 57 103 62 94 62 L 86 62 L 86 83 L 74 83 Z M 86 46 L 86 52 L 93 52 C 96 52 98 51 98 49 C 98 47 96 46 93 46 Z" />
        {/* Apex Arrow Beacon */}
        <polygon points="47,20 54,28 40,28" />
      </g>

      <circle cx="86" cy="49" r="2.5" fill="#000000" />

      {/* Signature Telemetry Lines */}
      <line
        x1="30"
        y1="102"
        x2="98"
        y2="102"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        opacity="0.8"
        strokeLinecap="round"
      />
      <line
        x1="42"
        y1="110"
        x2="86"
        y2="110"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        opacity="0.4"
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
