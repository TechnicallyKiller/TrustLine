"use client";

// Landing — Fianza.dc.html "THE MEMBRANE" split hero + a scroll-driven
// story (earn → get read → draw the line → build a name) + manifesto + loop.
// Scroll system: components/tl/Reveal (IntersectionObserver adds .tl-in,
// gating the .tl-*-g child animations defined in globals.css).
// Renders at both / and /waitlist (see app/waitlist/page.tsx).
// Section-by-section pieces live in components/landing/ — this file is
// just the composition.

import TLNav from "@/components/tl/TLNav";
import ScrollProgress from "@/components/tl/ScrollProgress";
import FianzaColdOpen from "@/components/tl/FianzaColdOpen";
import SplitHero from "@/components/landing/SplitHero";
import BrandBand from "@/components/landing/BrandBand";
import Ticker from "@/components/landing/Ticker";
import Manifesto from "@/components/landing/Manifesto";
import AgentStory from "@/components/landing/AgentStory";
import LifecycleLoop from "@/components/landing/LifecycleLoop";
import JoinWaitlist from "@/components/landing/JoinWaitlist";

export default function Home() {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      {/* Cold-open runs on the landing route only — this is the first-impression
          surface. The app pages (/borrower, /lender, /portfolio) are tools people
          return to, and should never gate them behind a 4.5s film. */}
      <FianzaColdOpen replay="always" />
      <ScrollProgress />
      <TLNav />

      <div className="tl-grain relative">
        <SplitHero />
        <BrandBand />
        <Ticker />
        <Manifesto />
        <AgentStory />
        <LifecycleLoop />
        <JoinWaitlist />

        <footer className="border-t border-bone/[0.08] py-8 text-center font-tl-mono text-xs text-[#4d564f]">
          © Fianza — Stellar testnet
        </footer>
      </div>
    </div>
  );
}
