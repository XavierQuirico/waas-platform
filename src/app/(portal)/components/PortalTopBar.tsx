'use client';

import * as React from 'react';
import Image from 'next/image';
// Misma familia de iconos (lucide-react) que FloatingActions / FloatingActionsClient
// del admin, para unificar la iconografía del shell móvil del portal.
import { Bell, Menu } from 'lucide-react';

// IDs estables que enlazan los controles del topbar con las superficies que
// abren (aria-controls), para lectores de pantalla.
export const PORTAL_MOBILE_MENU_ID = 'portal-mobile-menu';
export const PORTAL_MOBILE_NOTIF_ID = 'portal-mobile-notif-panel';

interface PortalTopBarProps {
  onHamburgerOpen: () => void;
  unreadCount?: number;
  onBellClick?: () => void;
  isMenuOpen?: boolean;
  isBellOpen?: boolean;
}

export function PortalTopBar({
  onHamburgerOpen,
  unreadCount = 0,
  onBellClick,
  isMenuOpen = false,
  isBellOpen = false,
}: PortalTopBarProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        // Reserve the notch/status-bar inset above the 56px control row so the
        // hamburger, logo and bell never sit under the device safe area.
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 16,
        paddingRight: 16,
        background: '#1A1A18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Hamburger */}
      <button
        type="button"
        onClick={onHamburgerOpen}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-controls={PORTAL_MOBILE_MENU_ID}
        data-testid="hamburger-btn"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(249,249,249,0.55)',
          display: 'flex',
          alignItems: 'center',
          padding: 6,
          borderRadius: 6,
        }}
      >
        <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {/* Logo centrado */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ position: 'relative', width: 120, height: 24 }}>
          <Image
            src="/brand/logo/LOGO HORIZONTAL.svg"
            alt="Quirico Studios"
            fill
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.88 }}
            priority
          />
        </div>
      </div>

      {/* Bell */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onBellClick}
          aria-label="Notificaciones"
          aria-haspopup="true"
          aria-expanded={isBellOpen}
          aria-controls={PORTAL_MOBILE_NOTIF_ID}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(249,249,249,0.55)',
            display: 'flex',
            alignItems: 'center',
            padding: 6,
            borderRadius: 6,
            position: 'relative',
          }}
        >
          <Bell size={18} strokeWidth={1.5} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: '#FF8C00',
                color: '#121212',
                borderRadius: '50%',
                width: 14,
                height: 14,
                fontSize: 8,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Inter Tight', sans-serif",
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
