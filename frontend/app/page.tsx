'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Shield,
  Eye,
  Users,
  Trophy,
  Zap,
  ArrowRight,
  ChevronDown,
  Swords,
  Rocket,
  LayoutDashboard,
  TrendingUp,
  Target,
  BarChart2,
  Cpu,
  PlusCircle,
  Award,
  Activity,
  Bot,
  Sparkles,
  Timer,
  DollarSign,
} from 'lucide-react';
import { QuestsLeaderboardsDemo } from '@/components/quests-leaderboards-demo';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { AnimatedSection } from '@/components/colosseum';
import BlurText from '@/components/reactbits/BlurText';
import GradientText from '@/components/reactbits/GradientText';
import DecryptedText from '@/components/reactbits/DecryptedText';
import GlitchText from '@/components/reactbits/GlitchText';
import { JourneyLoop } from '@/components/home/JourneyLoop';
import { HomeWalkthroughVideo } from '@/components/home/HomeWalkthroughVideo';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), { ssr: false });

// ─── Data ───

const CONVERSION_LOOP_STEPS = [
  {
    num: '01',
    title: 'Join Free',
    description: 'Enter a competition on a Deriv demo account. No deposit needed — trade risk-free.',
    icon: Swords,
    color: 'blue',
  },
  {
    num: '02',
    title: 'Trade Exotics',
    description: 'Compete using Accumulators, Multipliers, and Digit contracts via Deriv API V2.',
    icon: Zap,
    color: 'purple',
  },
  {
    num: '03',
    title: 'Rank by Sortino',
    description: 'Risk-adjusted leaderboard. Not who made the most — who traded the smartest.',
    icon: Trophy,
    color: 'indigo',
  },
  {
    num: '04',
    title: 'Go Real',
    description: 'Top performers get personalized nudges to open a real Deriv account and trade for real stakes.',
    icon: Rocket,
    color: 'emerald',
  },
];


const FEATURES = [
  { icon: Target, title: 'Sortino-Ranked Leaderboards', description: 'Ranked by risk-adjusted returns, not raw P&L. The smartest traders win, not the luckiest.' },
  { icon: Bot, title: 'AI Strategy Coach', description: 'Get real-time tips powered by Deriv LLMs.txt context. Personalized analysis of your competition performance.' },
  { icon: Shield, title: 'Policy-Governed Trading', description: 'Competition rules and guardrails reduce reckless bets and scripted abuse — governance as fraud prevention.' },
  { icon: Eye, title: 'Full Transparency', description: 'Every trade logged, every ranking verifiable. Open competition with no hidden advantages.' },
];

const EXOTIC_CONTRACTS = [
  { name: 'Accumulators', desc: 'Set a growth rate. Your payout grows tick-by-tick as long as price stays in range.', icon: TrendingUp, badge: 'ACCU' },
  { name: 'Multipliers', desc: 'Amplify gains up to 1000x on synthetic indices with built-in stop loss.', icon: Zap, badge: 'MULT' },
  { name: 'Digit Contracts', desc: 'Predict the last digit of price ticks — Even/Odd, Over/Under, Match/Differ.', icon: Target, badge: 'DIGIT' },
  { name: 'Rise/Fall', desc: 'Classic binary — will the price rise or fall within the duration?', icon: Activity, badge: 'CALL/PUT' },
];

const BUSINESS_PROBLEMS = [
  { metric: '4%', label: 'Signup-to-deposit conversion', target: '> 10%', description: 'Gamified competitions create emotional investment before the deposit ask.' },
  { metric: '0', label: 'WhatsApp deposits', target: 'Active funnel', description: 'Competition nudges at the right moment replace cold onboarding emails.' },
  { metric: '18.9K', label: 'Fake accounts / 64hrs', target: 'Policy-gated', description: 'Sortino ranking + policy engine penalizes bot-like reckless trading.' },
];

// ─── Page ───

function LazySection({ children, className, minHeight = '200px', rootMargin = '200px' }: {
  children: ReactNode;
  className?: string;
  minHeight?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMounted(true); io.disconnect(); } },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={mounted ? undefined : { minHeight }}>
      {mounted ? children : null}
    </div>
  );
}

export default function Home() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10">
        {/* ═══════════ HERO ═══════════ */}
        <section className="relative overflow-hidden">
          {!isMobile && (
            <div className="absolute inset-0 z-0 opacity-75">
              <RisingLines
                color="#E8B45E"
                horizonColor="#E8B45E"
                haloColor="#F5D78E"
                riseSpeed={0.08}
                riseScale={10.0}
                riseIntensity={1.3}
                flowSpeed={0.15}
                flowDensity={4.0}
                flowIntensity={0.7}
                horizonIntensity={0.9}
                haloIntensity={7.5}
                horizonHeight={-0.85}
                circleScale={-0.5}
                scale={6.5}
                brightness={1.1}
              />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-primary to-transparent z-[1]" />

          <div className="container-colosseum pt-10 pb-16 md:pt-16 md:pb-24 relative z-[2]">
            <div className="mx-0 sm:mx-[2%]">
              <div className="max-w-4xl mx-auto text-center">
                {/* Title */}
                <div className="mb-8">
                  <h1 className="font-bold tracking-tight font-display mb-4">
                    <div className="text-4xl sm:text-5xl md:text-7xl">
                      <GradientText
                        colors={['#E8B45E', '#c9973e', '#F0C97A', '#D4A04A', '#E8B45E']}
                        animationSpeed={6}
                        className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight font-display !mx-0"
                      >
                        <DecryptedText
                          text="DerivArena"
                          animateOn="view"
                          sequential
                          speed={60}
                          maxIterations={20}
                          revealDirection="start"
                          characters="$%&#@!*^~<>{}[]01"
                          className="text-inherit"
                          encryptedClassName="text-accent-primary/40"
                        />
                      </GradientText>
                    </div>
                    <div className="text-2xl sm:text-3xl md:text-4xl mt-2">
                      <motion.span
                        className="inline-block"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.8 }}
                      >
                        <GlitchText
                          speed={0.7}
                          enableShadows
                          settleAfter={1200}
                          className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight font-display"
                        >
                          A conversion engine disguised as a game
                        </GlitchText>
                      </motion.span>
                    </div>
                  </h1>

                  <motion.p
                    className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0, duration: 0.5 }}
                  >
                    Compete on Deriv exotic contracts, deploy AI agents that trade for you,
                    earn <span className="text-accent-primary">Deriv Miles</span> for every
                    smart move, spend them in the Marketplace, and graduate to real trading
                    on Deriv — all in one loop.
                  </motion.p>

                  <motion.div
                    className="mt-3 flex items-center justify-center gap-3 flex-wrap"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                  >
                    <a
                      href="https://developers.deriv.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all text-xs font-mono text-white/60 hover:text-white/80"
                    >
                      Built on Deriv API V2
                    </a>
                    <a
                      href="https://x.com/HarshSolan24317"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all text-xs font-mono text-white/60 hover:text-white/80"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    </a>
                  </motion.div>
                </div>

                {/* Hero Stats */}
                <motion.div
                  className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto mb-10"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.5 }}
                >
                  {[
                    { value: 'Free', label: 'Demo Trading' },
                    { value: 'Sortino', label: 'Ranked' },
                    { value: '24/7', label: 'Synth Markets' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] px-3 py-3 text-center">
                      <div className="text-lg font-bold text-accent-primary font-display leading-none">{stat.value}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1.5 leading-none">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                >
                  <Link href="/arena" className="group relative">
                    <div className="absolute -inset-px bg-gradient-to-r from-accent-primary via-accent-soft to-accent-primary opacity-70 group-hover:opacity-100 transition-opacity blur-[1px]" />
                    <div className="relative flex items-center gap-3 bg-accent-primary px-8 py-3.5 font-bold text-bg-primary text-base transition-all group-hover:shadow-[0_0_30px_rgba(232,180,94,0.4)]">
                      <Swords className="w-5 h-5" />
                      <span>Enter the Arena</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                  <Link
                    href="/create"
                    className="flex items-center gap-2 px-6 py-3 border border-white/[0.15] hover:border-white/[0.3] bg-white/[0.04] hover:bg-white/[0.08] text-text-primary text-sm font-semibold transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Competition</span>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ DIVIDER ═══════════ */}
        <div className="container-colosseum">
          <div className="glow-divider" />
        </div>

        {/* ═══════════ CONVERSION LOOP — How It Works ═══════════ */}
        <LazySection minHeight="500px">
          <section className="container-colosseum pt-14 sm:pt-20 pb-8 sm:pb-14">
            <AnimatedSection className="text-center mb-12">
              <BlurText
                text="The Conversion Loop"
                className="text-3xl md:text-5xl font-bold text-text-primary font-display tracking-tight !mb-3"
                delay={80}
                animateBy="words"
              />
              <p className="text-base text-text-muted max-w-xl mx-auto">
                From free demo competition to real Deriv deposit — a gamified bridge that attacks the 4% conversion rate.
              </p>
            </AnimatedSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {CONVERSION_LOOP_STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <AnimatedSection key={step.num} delay={0.1 + i * 0.12}>
                    <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-6 h-full hover:border-accent-primary/30 transition-colors group">
                      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-mono text-accent-primary/60">{step.num}</span>
                        <div className="w-10 h-10 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-accent-primary" />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-text-primary mb-2 font-display">{step.title}</h3>
                      <p className="text-sm text-text-muted leading-relaxed">{step.description}</p>
                      {i < CONVERSION_LOOP_STEPS.length - 1 && (
                        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                          <ArrowRight className="w-4 h-4 text-accent-primary/40" />
                        </div>
                      )}
                    </div>
                  </AnimatedSection>
                );
              })}
            </div>

            <div className="mt-10 sm:mt-14 mx-auto max-w-4xl">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </section>
        </LazySection>

        {/* ═══════════ THE FULL LOOP ═══════════ */}
        <LazySection minHeight="640px">
          <section className="container-colosseum pt-8 sm:pt-14 pb-8 sm:pb-14">
            <AnimatedSection className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent-primary/30 bg-accent-primary/5 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-accent-primary">
                  The DerivArena Loop
                </span>
              </div>
              <BlurText
                text="One product, one loop, seven forces."
                className="text-3xl md:text-5xl font-bold text-text-primary font-display tracking-tight !mb-3"
                delay={70}
                animateBy="words"
              />
              <p className="text-base text-text-muted max-w-2xl mx-auto">
                DerivArena isn&apos;t a single feature &mdash; it&apos;s a closed loop that takes a
                curious trader from first demo tick to real Deriv deposit and keeps them
                coming back. Every pulse you see below is a real signal running through
                the platform right now.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <JourneyLoop />
            </AnimatedSection>

            {/*
              Ninety-second walkthrough video. YOUTUBE_VIDEO_ID is intentionally
              a constant (not an env var) so the repo tells the full story on
              its own. Set it to `null` to hide the block entirely.
            */}
            <AnimatedSection delay={0.15}>
              <HomeWalkthroughVideo />
            </AnimatedSection>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-[11px] font-mono">
              {[
                { label: 'Rails', value: 'Deriv API V2 · WS OTP' },
                { label: 'Rewards', value: 'XP · Miles · Tiers' },
                { label: 'Agents', value: 'MCP · OpenClaw · Telegram' },
                { label: 'Conversion', value: 'Partner app_id tracked' },
              ].map((chip) => (
                <div
                  key={chip.label}
                  className="bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-center"
                >
                  <div className="text-[9px] text-text-muted uppercase tracking-widest">
                    {chip.label}
                  </div>
                  <div className="text-text-secondary mt-0.5 truncate">{chip.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 sm:mt-14 mx-auto max-w-4xl">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </section>
        </LazySection>

        {/* ═══════════ EXOTIC CONTRACTS ═══════════ */}
        <LazySection minHeight="500px">
          <section className="container-colosseum pt-8 sm:pt-14 pb-8 sm:pb-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl">
              <AnimatedSection className="flex flex-col justify-center">
                <BlurText
                  text="Trade Deriv Exotics"
                  className="text-3xl md:text-5xl font-bold text-text-primary font-display tracking-tight !mb-3"
                  delay={80}
                  animateBy="words"
                />
                <p className="text-base text-text-muted max-w-lg mb-8">
                  Competitions run on Deriv&apos;s unique synthetic indices — available 24/7, unaffected by real-world events, with exotic contract types you can&apos;t find anywhere else.
                </p>
                <div className="space-y-4">
                  {EXOTIC_CONTRACTS.map((contract, i) => {
                    const Icon = contract.icon;
                    return (
                      <AnimatedSection key={contract.name} delay={0.1 + i * 0.1}>
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="w-5 h-5 text-accent-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-text-primary">{contract.name}</h3>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary">{contract.badge}</span>
                            </div>
                            <p className="text-sm text-text-muted leading-relaxed">{contract.desc}</p>
                          </div>
                        </div>
                      </AnimatedSection>
                    );
                  })}
                </div>
              </AnimatedSection>

              <AnimatedSection delay={0.2}>
                <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 sm:p-6 h-[480px] lg:h-[540px] overflow-hidden">
                  <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
                  <QuestsLeaderboardsDemo className="h-full" />
                </div>
              </AnimatedSection>
            </div>

            <div className="mt-10 sm:mt-14 mx-auto max-w-4xl">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </section>
        </LazySection>

        {/* ═══════════ PLATFORM FEATURES ═══════════ */}
        <LazySection minHeight="400px">
          <section className="container-colosseum pt-8 sm:pt-14 pb-8 sm:pb-14">
            <AnimatedSection className="text-center mb-12">
              <BlurText
                text="Built for Smart Trading"
                className="text-3xl md:text-5xl font-bold text-text-primary font-display tracking-tight !mb-3"
                delay={80}
                animateBy="words"
              />
              <p className="text-base text-text-muted max-w-xl mx-auto">
                Not another trading bot. A platform where partners create competitions, traders prove their skill, and AI coaches help everyone improve.
              </p>
            </AnimatedSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {FEATURES.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <AnimatedSection key={feature.title} delay={0.1 + i * 0.1}>
                    <div className="flex items-start gap-4 p-5 bg-white/[0.03] border border-white/[0.06] hover:border-accent-primary/20 transition-colors">
                      <div className="w-10 h-10 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-accent-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-text-primary mb-1">{feature.title}</h3>
                        <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </AnimatedSection>
                );
              })}
            </div>

            <div className="mt-10 sm:mt-14 mx-auto max-w-4xl">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </section>
        </LazySection>

        {/* ═══════════ BUSINESS IMPACT / DERIV PROBLEMS ═══════════ */}
        <LazySection minHeight="400px">
          <section className="container-colosseum pt-8 sm:pt-14 pb-8 sm:pb-14">
            <AnimatedSection className="text-center mb-12">
              <BlurText
                text="Solving Real Deriv Problems"
                className="text-3xl md:text-5xl font-bold text-text-primary font-display tracking-tight !mb-3"
                delay={80}
                animateBy="words"
              />
              <p className="text-base text-text-muted max-w-xl mx-auto">
                Intelligence from Deriv&apos;s internal teams validates every feature. This isn&apos;t cool tech for its own sake — it moves real business metrics.
              </p>
            </AnimatedSection>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {BUSINESS_PROBLEMS.map((problem, i) => (
                <AnimatedSection key={problem.label} delay={0.1 + i * 0.12}>
                  <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-6 h-full group hover:border-accent-primary/30 transition-colors">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold text-accent-primary font-display">{problem.metric}</span>
                      <span className="text-xs text-text-muted">{problem.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs font-mono text-emerald-400">Target: {problem.target}</span>
                    </div>
                    <p className="text-sm text-text-muted leading-relaxed">{problem.description}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>

            <div className="mt-10 sm:mt-14 mx-auto max-w-4xl">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </section>
        </LazySection>

        {/* ═══════════ PARTNER CTA ═══════════ */}
        <LazySection minHeight="400px">
          <section className="container-colosseum pt-8 sm:pt-14 pb-8 sm:pb-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl items-center">
              {/* Left: Partner Value Prop */}
              <AnimatedSection className="flex flex-col">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent-primary/30 bg-accent-primary/5 self-start mb-6">
                  <Users className="w-3.5 h-3.5 text-accent-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-accent-primary">For Deriv Partners</span>
                </div>

                <BlurText
                  text="Give your referrals a reason to trade."
                  className="text-3xl md:text-4xl font-bold text-text-primary font-display tracking-tight !mb-4"
                  delay={60} animateBy="words"
                />
                <p className="text-base text-text-muted mb-8 leading-relaxed max-w-md">
                  Stop posting links. Start running competitions. Create a branded trading challenge, share with your referrals, and earn commission on every trade through your app_id. Stalled partners become community builders.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: Timer, title: 'Create in 30 Seconds', desc: 'Name, duration, contract types, starting balance — done. Share via link or QR code.' },
                    { icon: DollarSign, title: 'Earn on Every Trade', desc: 'Your app_id is embedded. Every trade through DerivArena generates commission for you.' },
                    { icon: Award, title: 'Activate Your Referrals', desc: 'Demo competition → emotional investment → deposit nudge → first-time deposit. Pipeline, not prayer.' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-start gap-3 p-3 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="w-8 h-8 flex items-center justify-center bg-accent-primary/10 border border-accent-primary/20 flex-shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-accent-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary mb-0.5">{item.title}</p>
                          <p className="text-xs text-text-muted leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AnimatedSection>

              {/* Right: Agent Archetypes */}
              <AnimatedSection delay={0.2}>
                <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-6 overflow-hidden">
                  <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
                  <h3 className="text-lg font-bold text-text-primary mb-1 font-display">AI Agent Competitors</h3>
                  <p className="text-xs text-text-muted mb-6">Compete alongside AI agents demonstrating different strategies on exotic contracts.</p>

                  <div className="space-y-4">
                    {[
                      { name: 'Volatility Scalper', strategy: 'CALL/PUT on Vol 100 — high-frequency, 5-tick trades', sortino: '1.84', winRate: '67%', color: 'text-blue-400' },
                      { name: 'Accumulator Hunter', strategy: 'ACCU with growth_rate — waits for low-vol windows', sortino: '2.31', winRate: '54%', color: 'text-emerald-400' },
                      { name: 'Digit Oracle', strategy: 'DIGITEVEN/ODD — statistical digit pattern analysis', sortino: '1.52', winRate: '72%', color: 'text-violet-400' },
                    ].map((agent) => (
                      <div key={agent.name} className="p-4 border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-accent-primary" />
                            <span className={`text-sm font-bold ${agent.color}`}>{agent.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-text-muted">Sortino <span className="text-accent-primary font-bold">{agent.sortino}</span></span>
                            <span className="text-[10px] text-text-muted">Win <span className="text-emerald-400 font-bold">{agent.winRate}</span></span>
                          </div>
                        </div>
                        <p className="text-xs text-text-muted">{agent.strategy}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-3 border border-accent-primary/20 bg-accent-primary/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                      <span className="text-xs font-bold text-accent-primary">AI Strategy Coach</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Powered by Deriv LLMs.txt — analyzes your trades, suggests strategy shifts, and explains exotic contract mechanics in context.
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </section>
        </LazySection>

        {/* ═══════════ CTA ═══════════ */}
        <LazySection minHeight="400px">
          <EpicCTA isMobile={isMobile} />
        </LazySection>
      </div>
    </div>
  );
}

// ─── CTA Section ───

function EpicCTA({ isMobile }: { isMobile: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden pb-12 sm:pb-32"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-accent-primary/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="container-colosseum relative z-10 max-w-4xl mx-auto">
        <div className="relative">
          <div className="absolute -inset-px bg-gradient-to-b from-accent-primary/30 via-accent-primary/10 to-accent-primary/30 pointer-events-none" />

          <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] py-6 sm:py-10 md:py-14 px-4 sm:px-8 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(232,180,94,0.15)_0%,transparent_70%)]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent" />

            <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-accent-primary/40" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t border-r border-accent-primary/40" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b border-l border-accent-primary/40" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-accent-primary/40" />

            {isInView && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-accent-primary/40"
                    style={{
                      left: `${15 + i * 14}%`,
                      top: `${20 + (i % 3) * 25}%`,
                    }}
                    animate={{
                      y: [0, -20, 0],
                      opacity: [0.2, 0.6, 0.2],
                      scale: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: 3 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </>
            )}

            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-text-primary mb-2 font-display leading-tight">
                  The arena is{' '}
                  <GradientText
                    colors={['#E8B45E', '#F0C97A', '#D4A04A', '#E8B45E']}
                    animationSpeed={4}
                    className="text-3xl sm:text-4xl md:text-6xl font-bold font-display"
                  >
                    open
                  </GradientText>
                  .
                </h2>
              </motion.div>

              <motion.p
                className="text-sm sm:text-base md:text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Compete on Deriv exotic contracts. Get ranked by Sortino ratio.
                <br className="hidden sm:block" />
                Turn your demo skills into real trading confidence.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10"
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Link href="/arena" className="group relative">
                  <div className="absolute -inset-px bg-gradient-to-r from-accent-primary via-accent-soft to-accent-primary opacity-70 group-hover:opacity-100 transition-opacity blur-[1px]" />
                  <div className="relative flex items-center gap-3 bg-accent-primary px-8 py-3.5 font-bold text-bg-primary text-base sm:text-lg transition-all group-hover:shadow-[0_0_30px_rgba(232,180,94,0.4)]">
                    <Swords className="w-5 h-5" />
                    <span>Enter the Arena</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link
                  href="/create"
                  className="flex items-center gap-2 px-6 py-3 border border-white/[0.15] hover:border-white/[0.3] bg-white/[0.04] hover:bg-white/[0.08] text-text-primary text-sm font-semibold transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create a Competition</span>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
