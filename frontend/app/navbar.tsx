'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Swords, Trophy, LayoutList, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GradientText from '@/components/reactbits/GradientText';
import UserAuthButton from '@/components/auth/UserAuthButton';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DerivLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect width="32" height="32" rx="6" fill="url(#deriv-grad)" />
      <path d="M10 8h6c4.4 0 8 3.6 8 8s-3.6 8-8 8h-2l-4-4V8z" fill="white" fillOpacity="0.9" />
      <path d="M14 12l4 4-4 4" stroke="#0D47A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="deriv-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#1976D2" />
          <stop offset="1" stopColor="#0D47A1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/arena', label: 'Arena', Icon: Swords },
    { href: '/competitions', label: 'Competitions', Icon: LayoutList },
    { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    if (pathname === href) return true;
    const ownedByChild = navLinks.some(
      l => l.href !== href && l.href.startsWith(href + '/') && pathname.startsWith(l.href),
    );
    if (ownedByChild) return false;
    return pathname.startsWith(href + '/');
  };

  return (
    <nav className="bg-bg-primary/95 backdrop-blur-lg sticky top-0 z-50 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-px after:w-full after:bg-[linear-gradient(90deg,transparent_0%,rgba(232,180,94,0.01)_10%,rgba(232,180,94,0.4)_50%,rgba(232,180,94,0.01)_90%,transparent_100%)]">
      <div className="container-colosseum">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <DerivLogo className="w-10 h-10 transition-transform group-hover:scale-105" />
            <div>
              <GradientText
                colors={['#E8B45E', '#D4A04A', '#F0C97A', '#E8B45E']}
                animationSpeed={5}
                className="text-xl font-bold font-display"
              >
                DerivArena
              </GradientText>
              <div className="text-xs text-text-muted -mt-0.5">Trading Competition Platform</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-0 items-center h-full overflow-x-auto scrollbar-none">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              const active = isActive(link.href);
              return (
                <li key={link.href} className="relative h-full flex items-center">
                  <Link
                    href={link.href}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 rounded-none font-medium transition-all duration-200 text-sm whitespace-nowrap
                      border-b-2
                      ${active
                        ? 'text-accent-primary border-accent-primary'
                        : 'text-text-secondary hover:text-text-primary border-transparent'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="relative h-full flex items-center">
              <a
                href="https://developers.deriv.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:text-text-primary whitespace-nowrap border-b-2 border-transparent"
              >
                <span>API Docs</span>
              </a>
            </li>
            <li className="relative h-full flex items-center">
              <a
                href="https://x.com/HarshSolan24317"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:text-text-primary whitespace-nowrap border-b-2 border-transparent"
                title="X / Twitter"
              >
                <XIcon className="w-4 h-4" />
              </a>
            </li>
            <li className="relative h-full flex items-center ml-2">
              <UserAuthButton />
            </li>
          </ul>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden border-t border-border relative z-50"
            >
              <ul className="space-y-1 py-4">
                {navLinks.map((link, i) => {
                  const Icon = link.Icon;
                  const active = isActive(link.href);
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200
                          ${active
                            ? 'text-accent-primary border-l-2 border-accent-primary bg-accent-primary/5'
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </Link>
                    </motion.li>
                  );
                })}
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: navLinks.length * 0.05 }}
                >
                  <a
                    href="https://x.com/HarshSolan24317"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-white/5"
                  >
                    <XIcon className="w-5 h-5" />
                    <span>Twitter</span>
                  </a>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: (navLinks.length + 1) * 0.05 }}
                  className="px-4 pt-2"
                >
                  <UserAuthButton />
                </motion.li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Backdrop overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm md:hidden"
            style={{ zIndex: 40 }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
