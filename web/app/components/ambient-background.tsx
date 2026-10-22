"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/motion";

/** Two soft, slowly drifting glows behind the content. */
export default function AmbientBackground() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(".glow", { autoAlpha: 0 }, { autoAlpha: (i: number) => [0.6, 0.5][i], duration: 2, stagger: 0.4, ease: "sine.out" });
      if (prefersReducedMotion()) return;
      gsap.to(".glow-a", { x: 80, y: 60, scale: 1.15, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".glow-b", { x: -70, y: -40, scale: 0.9, duration: 17, repeat: -1, yoyo: true, ease: "sine.inOut" });
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="glow glow-a reveal absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-[var(--glow-a)] blur-[120px]" />
      <div className="glow glow-b reveal absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-[var(--glow-b)] blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
    </div>
  );
}
