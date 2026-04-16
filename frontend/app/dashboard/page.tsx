'use client';

const GOLD = '#E8B45E';
const BG   = '#07090F';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent } from '@/lib/api';
import { AgentConfigPanel, AgentDataFlow, EpochRewardWidget } from '@/components/dashboard';
import { ArenaPaperPortfolio, ArenaPaperSwarmColumn } from '@/components/arena';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), { ssr: false });

// ── Skeleton ─────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={`bg-white/[0.03] animate-pulse ${className}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <SkeletonBlock className="h-[420px]" />
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                <SkeletonBlock className="h-[400px]" />
                <SkeletonBlock className="h-[480px]" />
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────

export default function DashboardPage() {
    const { isAuthenticated, _hasHydrated, setAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);

    // Wait for store hydration, then refresh agent data if authed
    useEffect(() => {
        if (!_hasHydrated) return;

        if (isAuthenticated) {
            getMyAgent()
                .then((me) => {
                    setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [_hasHydrated, isAuthenticated, setAuth]);

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative" style={{ background: BG }}>
                <BackgroundLayer />
                <div className="relative z-10">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative" style={{ background: BG }}>
            <BackgroundLayer />

            <div className="relative z-10">
                {/* Page Header */}
                <div className="flex flex-wrap items-center gap-4 mb-6 justify-between">
                    <div>
                        <h1 className="text-lg font-black font-mono text-white tracking-tight">COMMAND CENTER</h1>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Your agent&apos;s data ingestion pipeline — each source feeds real-time signals into your strategy.</p>
                    </div>
                    <Link
                        href="/arena"
                        className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-amber-500/35 text-amber-200/90 hover:bg-amber-500/10 transition-colors"
                    >
                        Arena → Portfolio
                    </Link>
                </div>

                <div className="space-y-6 animate-arena-reveal">
                    <AgentDataFlow />
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(280px,340px)] gap-6 items-start">
                        <div className="space-y-6 min-w-0 xl:max-w-[400px]">
                            <AgentConfigPanel />
                            <EpochRewardWidget />
                        </div>
                        <div className="min-w-0 w-full">
                            <ArenaPaperSwarmColumn />
                        </div>
                        <div className="min-w-0">
                            <ArenaPaperPortfolio />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Background Layer ─────────────────────────────────────────────

function BackgroundLayer() {
    return (
        <>
            <div className="fixed inset-0 z-0">
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.60) 15%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)',
                    }}
                />
                <div className="absolute inset-0 opacity-40">
                    <RisingLines
                        color="#E8B45E"
                        horizonColor="#E8B45E"
                        haloColor="#F5D78E"
                        riseSpeed={0.05}
                        riseScale={8.0}
                        riseIntensity={1.0}
                        flowSpeed={0.1}
                        flowDensity={3.5}
                        flowIntensity={0.5}
                        horizonIntensity={0.7}
                        haloIntensity={5.0}
                        horizonHeight={-0.85}
                        circleScale={-0.5}
                        scale={6.5}
                        brightness={0.9}
                    />
                </div>
            </div>
        </>
    );
}
