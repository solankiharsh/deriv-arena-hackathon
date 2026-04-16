'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User, Shield, Gamepad2, Crown, Loader2 } from 'lucide-react';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthNudge } from '@/lib/stores/auth-nudge-store';

export default function ArenaAuthButton() {
  const router = useRouter();
  const { user, isLoading, fetchUser, logout } = useArenaAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const nudgeToken = useAuthNudge((s) => s.nudgeToken);
  const [isNudging, setIsNudging] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasMounted(true);
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Flash the Sign In button for ~1.8s (three 600ms blinks) whenever the
  // global auth-nudge token increments while the user is signed out.
  useEffect(() => {
    if (nudgeToken === 0 || user) return;
    setIsNudging(false);
    // Toggle on the next frame so the browser restarts the CSS animation
    // even if the class is already applied.
    const raf = requestAnimationFrame(() => setIsNudging(true));
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => setIsNudging(false), 1900);
    return () => {
      cancelAnimationFrame(raf);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, [nudgeToken, user]);

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await logout();
    router.push('/');
  };

  if (!hasMounted) return null;

  if (isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading
      </button>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={handleSignIn}
          data-auth-nudge="sign-in"
          className={`flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium ${
            isNudging ? 'animate-auth-nudge' : ''
          }`}
        >
          <Shield className="w-4 h-4" />
          Sign In
        </button>

        {isNudging && (
          <div
            role="status"
            aria-live="polite"
            data-auth-nudge-toast="sign-in"
            className="absolute right-0 top-full mt-2 whitespace-nowrap px-3 py-1.5 rounded-md border border-accent-primary/40 bg-bg-secondary/95 backdrop-blur text-[11px] text-text-primary shadow-lg animate-fade-in-down z-50 pointer-events-none"
          >
            <span className="text-accent-primary font-semibold">Sign in</span>{' '}
            <span className="text-text-secondary">to join the game.</span>
          </div>
        )}
      </div>
    );
  }

  const roleIcon = user.role === 'admin' ? Crown : user.role === 'partner' ? Gamepad2 : User;
  const RoleIcon = roleIcon;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-soft/30 to-accent-dark/30 border border-accent-primary/20 flex items-center justify-center text-xs font-bold text-accent-primary">
          {user.display_name.charAt(0)}
        </div>
        <span className="text-text-primary font-medium truncate max-w-[140px] text-sm">
          {user.display_name}
        </span>
        <span className="text-[10px] font-mono text-accent-primary uppercase">{user.role}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-bg-secondary border border-white/[0.08] shadow-xl z-50">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <RoleIcon className="w-3 h-3" />
              <span className="uppercase tracking-wider">{user.role}</span>
            </div>
            <div className="text-sm font-medium text-text-primary mt-0.5">{user.display_name}</div>
            <div className="text-xs text-text-muted font-mono">
              Rating: {Number(user.arena_rating).toFixed(1)} · {user.total_games} games
            </div>
          </div>

          {user.role === 'admin' && (
            <button
              onClick={() => { setDropdownOpen(false); router.push('/admin'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04] transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Dashboard
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
