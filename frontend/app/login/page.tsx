'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Shield, Users, ArrowRight, Swords } from 'lucide-react';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { arenaApi } from '@/lib/arena-api';
import type { UserRole } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = searchParams?.get('step') ?? null;
  const error = searchParams?.get('error') ?? null;

  const { user, fetchUser, setUser, clearLogoutFlag } = useArenaAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    clearLogoutFlag();
    fetchUser();
  }, [fetchUser, clearLogoutFlag]);

  useEffect(() => {
    if (user && step !== 'role') {
      router.push('/arena');
    }
  }, [user, step, router]);

  const handleDerivLogin = () => {
    clearLogoutFlag();
    window.location.href = '/api/auth/deriv';
  };

  const handleRoleSelect = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    try {
      const { user: updated } = await arenaApi.auth.setRole(selectedRole);
      setUser(updated);
      router.push('/arena');
    } catch (err) {
      console.error('Failed to set role:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roles = [
    {
      id: 'player' as UserRole,
      label: 'Player',
      description: 'Compete in trading games, climb leaderboards, and sharpen your skills.',
      icon: Swords,
      color: 'from-blue-500 to-cyan-400',
    },
    {
      id: 'partner' as UserRole,
      label: 'Partner',
      description: 'Create game templates, share competitions, and track conversions.',
      icon: Users,
      color: 'from-amber-500 to-orange-400',
    },
  ];

  if (step === 'role') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl mb-2">
              <GradientText
                colors={['#E8B45E', '#F5C978', '#E8B45E']}
                animationSpeed={4}
                className="font-display font-bold"
              >
                Choose Your Role
              </GradientText>
            </h2>
            <p className="text-text-secondary text-sm">
              You can change this later from your profile settings.
            </p>
          </div>

          <div className="space-y-4">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <motion.button
                  key={role.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRole(role.id)}
                  className={`
                    w-full text-left p-5 rounded-card border transition-all duration-250
                    ${isSelected
                      ? 'border-accent-primary bg-accent-primary/10 shadow-glow-gold'
                      : 'border-border bg-card hover:border-border-strong'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center
                      bg-gradient-to-br ${role.color}
                    `}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-display font-semibold text-lg uppercase tracking-wide">
                        {role.label}
                      </div>
                      <p className="text-text-secondary text-sm mt-1">
                        {role.description}
                      </p>
                    </div>
                    <div className={`
                      w-5 h-5 rounded-full border-2 mt-1 transition-all
                      ${isSelected
                        ? 'border-accent-primary bg-accent-primary'
                        : 'border-border'
                      }
                    `}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-full h-full rounded-full bg-accent-primary flex items-center justify-center"
                        >
                          <div className="w-2 h-2 rounded-full bg-black" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRoleSelect}
            disabled={!selectedRole || isSubmitting}
            className="btn-primary w-full mt-6 py-4 text-lg"
          >
            {isSubmitting ? 'Setting up...' : 'Enter the Arena'}
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl overflow-hidden">
            <Image src="/icon.png" alt="DerivArena" width={80} height={80} priority />
          </div>
          <h1 className="text-3xl font-display font-bold mb-3">
            <GradientText
              colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
              animationSpeed={4}
              className="font-display font-bold"
            >
              DerivArena
            </GradientText>
          </h1>
          <p className="text-text-secondary">
            Gamified trading competitions powered by Deriv API.
            <br />
            Compete, learn, and prove your edge.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
            {error === 'missing_params' && 'Authentication failed. Please try again.'}
            {error === 'create_failed' && 'Could not create your account. Please try again.'}
            {error === 'session_expired' &&
              'Your sign-in link expired. Please click "Continue with Deriv" below to start over.'}
            {error === 'state_mismatch' &&
              'Sign-in was interrupted. For your security we cancelled it. Please try again.'}
            {error === 'token_exchange_failed' &&
              'We could not verify your Deriv account. Please try again.'}
            {error === 'oauth_denied' &&
              'Sign-in was cancelled on Deriv. Please try again when you are ready.'}
            {error === 'no_app_id' &&
              'Deriv app id is not configured. Please contact support.'}
            {error === 'no_token' &&
              'Deriv did not return a token. Please try again.'}
            {![
              'missing_params',
              'create_failed',
              'session_expired',
              'state_mismatch',
              'token_exchange_failed',
              'oauth_denied',
              'no_app_id',
              'no_token',
            ].includes(error) && 'Sign-in failed. Please try again.'}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDerivLogin}
          className="btn-primary w-full py-4 text-lg gap-3"
        >
          <Shield className="w-5 h-5" />
          Sign in with Deriv
        </motion.button>

        <p className="text-text-muted text-xs mt-4">
          Uses Deriv OAuth — your credentials are never shared with us.
        </p>

        {/* Demo login for development/judging */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-text-muted text-xs mb-3 uppercase tracking-wider">Demo Access (for judges)</p>
          {demoError && (
            <div className="mb-3 p-2 rounded-lg bg-error/10 border border-error/20 text-error text-xs">
              {demoError}
            </div>
          )}
          <div className="flex gap-2 justify-center">
            {(['player', 'partner', 'admin'] as const).map((role) => (
              <button
                key={role}
                onClick={async () => {
                  setDemoError(null);
                  try {
                    clearLogoutFlag();
                    const res = await fetch('/api/auth/demo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ role }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setUser(data.user);
                      router.push('/arena');
                    } else {
                      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
                      setDemoError(data.error || `Login failed (${res.status})`);
                    }
                  } catch (err) {
                    setDemoError('Network error. Is the server running?');
                  }
                }}
                className="px-3 py-1.5 text-xs font-mono border border-border rounded-pill text-text-secondary hover:text-text-primary hover:border-border-strong transition-all capitalize"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
