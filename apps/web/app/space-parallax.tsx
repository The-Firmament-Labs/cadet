"use client";

import React, { useEffect, useRef } from "react";

const sceneMarkers = [
  { label: "Local orbit", className: "sceneMarker sceneMarkerLocal" },
  { label: "Edge lane", className: "sceneMarker sceneMarkerEdge" },
  { label: "Rust runner", className: "sceneMarker sceneMarkerRust" }
];

export function SpaceParallax() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    const syncScroll = () => {
      const bounds = scene.getBoundingClientRect();
      const progress = (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height);
      const clamped = Math.max(-0.2, Math.min(1.15, progress));

      scene.style.setProperty("--scene-scroll", clamped.toFixed(4));
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = scene.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;

      scene.style.setProperty("--scene-x", x.toFixed(4));
      scene.style.setProperty("--scene-y", y.toFixed(4));
    };

    const handlePointerLeave = () => {
      scene.style.setProperty("--scene-x", "0");
      scene.style.setProperty("--scene-y", "0");
    };

    syncScroll();

    scene.addEventListener("pointermove", handlePointerMove);
    scene.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("scroll", syncScroll, { passive: true });
    window.addEventListener("resize", syncScroll);

    return () => {
      scene.removeEventListener("pointermove", handlePointerMove);
      scene.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", syncScroll);
      window.removeEventListener("resize", syncScroll);
    };
  }, []);

  return (
    <div className="spaceScene" ref={sceneRef}>
      <div className="spaceSceneNebula" aria-hidden="true" />
      <div className="spaceSceneCurtain" aria-hidden="true" />
      <div className="spaceSceneGlow spaceSceneGlowA" aria-hidden="true" />
      <div className="spaceSceneGlow spaceSceneGlowB" aria-hidden="true" />
      <div className="spaceSceneStars" aria-hidden="true" />
      <div className="spaceSceneRing spaceSceneRingPrimary" aria-hidden="true" />
      <div className="spaceSceneRing spaceSceneRingSecondary" aria-hidden="true" />

      {sceneMarkers.map((marker) => (
        <span className={marker.className} key={marker.label}>
          {marker.label}
        </span>
      ))}

      <img
        alt="NASA astronaut Ricky Arnold during a June 14, 2018 spacewalk."
        className="spaceSceneAstronaut"
        decoding="async"
        fetchPriority="high"
        height="1280"
        loading="eager"
        src="/visuals/astronaut-eva.jpg"
        width="1920"
      />

      <div className="spaceSceneReadout">
        <span>Cadet // orbital rendezvous</span>
        <strong>SpacetimeDB v2 + Vercel + Rust</strong>
      </div>
    </div>
  );
}
