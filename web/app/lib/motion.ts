"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
gsap.defaults({ ease: "power3.out", duration: 0.6 });

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fade/slide children marked with [data-animate] into view, in order. */
export function revealChildren(root: Element | null, opts: { y?: number; stagger?: number; delay?: number } = {}) {
  if (!root) return;
  const items = root.querySelectorAll("[data-animate]");
  if (prefersReducedMotion()) {
    gsap.set(items, { autoAlpha: 1 });
    return;
  }
  return gsap.fromTo(
    items,
    { autoAlpha: 0, y: opts.y ?? 18 },
    { autoAlpha: 1, y: 0, duration: 0.7, stagger: opts.stagger ?? 0.08, delay: opts.delay ?? 0, clearProps: "transform" },
  );
}

/** Animate an element out, then run `done` (immediately when reduced motion is on). */
export function exitThen(el: Element | null, done: () => void, opts: { x?: number; y?: number } = {}) {
  if (!el || prefersReducedMotion()) return done();
  gsap.to(el, { autoAlpha: 0, x: opts.x ?? 0, y: opts.y ?? -10, duration: 0.25, ease: "power2.in", onComplete: done });
}

export { gsap, useGSAP };
