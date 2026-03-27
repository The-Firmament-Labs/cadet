"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import React, { useRef } from "react";
import { SpaceParallax } from "./space-parallax";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const flightDeck = [
  {
    title: "Flight CLI",
    body: "Operator-first launch flows for manifest inspection, prompt composition, and dispatch into local or edge orbit."
  },
  {
    title: "Local command deck",
    body: "A Bun control surface for laptop-side agents, heartbeat supervision, and deterministic local schedule wakes."
  },
  {
    title: "Cloud rendezvous",
    body: "Next.js on Vercel for edge dispatch, protected cron wakes, and cloud-side schedule reconciliation."
  },
  {
    title: "Shared event fabric",
    body: "Rust runners and SpacetimeDB v2 keep queues, memory notes, runner presence, and schedules in one event-driven graph."
  }
];

const commands = [
  "bun run dev:local-control",
  "bun run cli -- agents list --dir ./examples/agents",
  "bun run cli -- job submit --agent researcher --goal \"Audit the treasury policy\" --api http://localhost:3010 --dir ./examples/agents",
  "curl -X POST http://localhost:3010/schedules/reconcile",
  "curl -X POST http://localhost:3001/api/agents/edge/dispatch -H 'content-type: application/json' -d '{\"agentId\":\"operator\",\"goal\":\"Triage the deploy incident\"}'",
  "curl -H 'authorization: Bearer $CRON_SECRET' http://localhost:3001/api/cron/reconcile"
];

export type LandingEnv = {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  hasCronSecret: boolean;
};

export type LandingCloudAgent = {
  id: string;
  name: string;
  runtime: string;
  execution: string;
  scheduleCount: number;
};

type CadetLandingProps = {
  cloudAgents: LandingCloudAgent[];
  env: LandingEnv;
};

export function CadetLanding({ cloudAgents, env }: CadetLandingProps) {
  const scope = useRef<HTMLDivElement>(null);
  const retroAstroSrc = "/visuals/retro-astro.png";
  const sketchAstroSrc = "/visuals/sketch-astro.png";
  const satelliteSrc = "/visuals/satellite.png";
  const techRingSrc = "/visuals/tech-ring.png";
  const missionStats = [
    { label: "Control planes", value: "2" },
    { label: "Cloud agents", value: String(cloudAgents.length) },
    {
      label: "Active schedules",
      value: String(cloudAgents.reduce((total, agent) => total + agent.scheduleCount, 0))
    }
  ];

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const heroTimeline = gsap.timeline({
      defaults: { duration: 0.84, ease: "power3.out" }
    });

    heroTimeline
      .from(".posterCopy > *", {
        opacity: 0,
        y: 36,
        stagger: 0.08
      })
      .from(
        ".spaceScene",
        {
          opacity: 0,
          y: 42,
          scale: 0.94,
          duration: 1
        },
        0.14
      );

    gsap.to(".spaceSceneNebula", {
      yPercent: -10,
      xPercent: 4,
      scale: 1.22,
      ease: "none",
      scrollTrigger: {
        trigger: ".poster",
        start: "top top",
        end: "bottom top",
        scrub: 1.1
      }
    });

    gsap.to(".spaceSceneCurtain", {
      yPercent: 8,
      xPercent: -6,
      ease: "none",
      scrollTrigger: {
        trigger: ".poster",
        start: "top top",
        end: "bottom top",
        scrub: 1.15
      }
    });

    gsap.to(".globalFloatingAstroContainer", {
      y: "110vh",
      x: "80vw",
      rotation: 120,
      ease: "none",
      scrollTrigger: {
        trigger: ".cadetLanding",
        start: "top top",
        end: "bottom bottom",
        scrub: 2.2
      }
    });

    gsap.to(".spaceSceneRingPrimary", {
      rotate: 28,
      xPercent: 8,
      ease: "none",
      scrollTrigger: {
        trigger: ".poster",
        start: "top top",
        end: "bottom top",
        scrub: 1.25
      }
    });

    gsap.to(".spaceSceneRingSecondary", {
      rotate: -32,
      yPercent: -10,
      ease: "none",
      scrollTrigger: {
        trigger: ".poster",
        start: "top top",
        end: "bottom top",
        scrub: 1.25
      }
    });

    gsap.to(".missionBackdrop", {
      rotate: 360,
      ease: "linear",
      duration: 120,
      repeat: -1
    });

    gsap.to(".missionBackdrop", {
      yPercent: 15,
      scale: 1.25,
      ease: "none",
      scrollTrigger: {
        trigger: ".missionSection",
        start: "top bottom",
        end: "bottom top",
        scrub: 1.5
      }
    });

    gsap.utils.toArray<HTMLElement>("[data-reveal-panel]").forEach((panel, index) => {
      gsap.from(panel, {
        opacity: 0,
        y: 46,
        duration: 0.74,
        ease: "power3.out",
        delay: index % 3 === 0 ? 0 : 0.04,
        scrollTrigger: {
          trigger: panel,
          start: "top 84%",
          once: true
        }
      });
    });

    gsap.utils.toArray<HTMLElement>("[data-orbit-float]").forEach((sprite, index) => {
      const section = sprite.closest<HTMLElement>("[data-orbit-section]");
      const drift = Number(sprite.dataset.drift ?? (index % 2 === 0 ? 14 : -14));
      const lift = Number(sprite.dataset.lift ?? -24);
      const rotateEnd = Number(sprite.dataset.rotateEnd ?? (index % 2 === 0 ? 10 : -10));

      gsap.fromTo(
        sprite,
        {
          autoAlpha: 0,
          y: 80,
          x: drift * 1.5,
          rotate: rotateEnd - 16,
          scale: 0.72
        },
        {
          autoAlpha: 1,
          y: 0,
          x: 0,
          rotate: rotateEnd * 0.45,
          scale: 1,
          duration: 0.92,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section ?? sprite,
            start: "top 82%",
            once: true
          }
        }
      );

      gsap.to(sprite, {
        yPercent: lift,
        xPercent: drift,
        rotate: rotateEnd,
        ease: "none",
        scrollTrigger: {
          trigger: section ?? sprite,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.3
        }
      });
    });
  }, { scope });

  return (
    <div ref={scope} className="cadetLanding">
      <SpaceParallax />
      <div className="globalFloatingAstroContainer">
        <img
          alt="Floating Astro"
          className="globalFloatingAstro"
          data-lift="30"
          data-orbit-float
          decoding="async"
          src={retroAstroSrc}
        />
      </div>
      <section className="poster" data-orbit-section>
        <div className="posterCopy">
  
          <p className="eyebrow">Cadet // orbital agent control</p>
          <h1 className="headline">Put local and edge agents into the same event horizon.</h1>

          <p className="lede">
            Cadet is the command layer for event-driven operators: a local Bun control plane, an
            edge-hosted cloud lane on Vercel, Rust runners for heavy execution, and SpacetimeDB v2
            as the live mission fabric between them.
          </p>

          <div className="posterActions">
            <a className="primaryAction" href="#flight-stack">
              Explore the flight stack
            </a>
            <a className="secondaryAction" href="/docs">
              Read the operator guide
            </a>
            <a className="secondaryAction" href="#mission-log">
              Open the mission log
            </a>
          </div>

          <dl className="missionStats">
            {missionStats.map((stat) => (
              <div className="missionStat" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>

          <p className="posterNote">
            Local runners keep the heavy state. Edge agents answer fast. Heartbeats and schedules
            stay synchronized across both control planes.
          </p>
        </div>

        <div className="posterVisual" aria-hidden="true">
          <img
            alt="Cadet Astronaut Operating Laptop"
            className="posterAstro"
            data-lift="20"
            data-orbit-float
            decoding="async"
            src="/visuals/laptop-astro.png"
          />
        </div>
      </section>

      <section className="section orbitSection" data-orbit-section id="flight-stack">
        <div
          aria-hidden="true"
          className="orbitSprite orbitSpriteFlight"
          data-drift="18"
          data-lift="-30"
          data-orbit-float
          data-rotate-end="8"
        >
          <img alt="" height="500" loading="lazy" src={retroAstroSrc} width="500" />
        </div>

        <div className="sectionHeader">
          <p className="sectionTag">Flight stack</p>
          <h2>One launch surface, four orbital layers.</h2>
          <p className="sectionCopy">
            The page leads with atmosphere, but the stack stays literal: where commands start,
            where cloud wakeups happen, and where durable execution lives.
          </p>
        </div>

        <div className="flightGrid">
          {flightDeck.map((surface) => (
            <article className="flightPanel" data-reveal-panel key={surface.title}>
              <p className="panelIndex">{surface.title}</p>
              <h3>{surface.title}</h3>
              <p>{surface.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section telemetryGrid orbitSection" data-orbit-section>
        <div
          aria-hidden="true"
          className="orbitSprite orbitSpriteTelemetry"
          data-drift="-14"
          data-lift="-22"
          data-orbit-float
          data-rotate-end="-18"
        >
          <img alt="" height="500" loading="lazy" src={sketchAstroSrc} width="500" />
        </div>

        <article className="telemetryPanel" data-reveal-panel>
          <p className="sectionTag">Cloud telemetry</p>
          <h2>Current runtime coordinates.</h2>
          <ul className="telemetryList">
            <li>`http://localhost:3010` hosts the local Bun control plane for local-runner agents.</li>
            <li>`/api/jobs/dispatch` remains the cloud queue entrypoint on the Next.js app.</li>
            <li>`/api/agents/edge/dispatch` runs on the Vercel Edge Runtime for edge-hosted agents.</li>
            <li>`/schedules/reconcile` runs the local scheduler wakeup and stale-heartbeat reconciliation.</li>
            <li>`/api/cron/reconcile` is the secure cloud wakeup hook for schedules and stale-heartbeat cleanup.</li>
          </ul>
        </article>

        <article className="telemetryPanel" data-reveal-panel>
          <p className="sectionTag">Mission state</p>
          <h2>Live control-plane settings.</h2>
          <ul className="telemetryList">
            <li>Control plane URL: {env.controlPlaneUrl}</li>
            <li>SpacetimeDB URL: {env.spacetimeUrl}</li>
            <li>Database: {env.database}</li>
            <li>Cron secret configured: {env.hasCronSecret ? "yes" : "no"}</li>
          </ul>
        </article>

        <article className="telemetryPanel" data-reveal-panel>
          <p className="sectionTag">Cloud roster</p>
          <h2>Agents already in orbit.</h2>
          <ul className="telemetryList">
            {cloudAgents.map((agent) => (
              <li key={agent.id}>
                {agent.name}: {agent.execution} via {agent.runtime} with {agent.scheduleCount}{" "}
                schedule{agent.scheduleCount === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section missionSection orbitSection" data-orbit-section id="mission-log">
        <div className="missionBackdrop" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="orbitSprite orbitSpriteMission"
          data-drift="12"
          data-lift="-18"
          data-orbit-float
          data-rotate-end="14"
        >
          <img alt="" height="500" loading="lazy" src={sketchAstroSrc} width="500" />
        </div>

        <div className="missionCopy">
          <p className="sectionTag">Mission log</p>
          <h2>From local ignition to edge-side reconcile.</h2>
          <p className="sectionCopy">
            The CLI remains the first switchboard. Local commands can wake the Bun plane, cloud
            agents can dispatch from the edge, and the same schedule graph keeps both sides in
            sync.
          </p>
        </div>

        <div className="commandDeck" data-reveal-panel>
          <pre>{commands.join("\n")}</pre>
        </div>
      </section>

      <section className="section finalSection orbitSection" data-orbit-section>
        <div
          aria-hidden="true"
          className="orbitSprite orbitSpriteFinal"
          data-drift="-12"
          data-lift="-26"
          data-orbit-float
          data-rotate-end="-10"
        >
          <img alt="" height="500" loading="lazy" src={satelliteSrc} width="500" />
        </div>

        <p className="sectionTag">Launch condition</p>
        <h2>Built for operators who want the poster and the proof.</h2>
        <p className="sectionCopy">
          Cadet keeps the visual language cinematic, but the contract is still operational:
          stateful runners, heartbeat supervision, scheduled wakeups, and a direct command path
          from terminal to edge.
        </p>

        <div className="posterActions">
          <a className="primaryAction" href="#mission-log">
            Review launch commands
          </a>
          <a className="secondaryAction" href="#flight-stack">
            Return to stack overview
          </a>
        </div>
      </section>
    </div>
  );
}
