import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateRegistration, verifyRegistration } from "@/lib/webauthn";
import { createControlClient } from "@/lib/server";
import { setSessionCookie, findOperatorByEmail, type OperatorSession } from "@/lib/auth";

// In-memory challenge store (replaced by SpacetimeDB in production)
const challenges = new Map<string, { challenge: string; operatorId: string; displayName: string; email: string; expiresAt: number }>();

export async function POST(request: Request) {
  const url = new URL(request.url);
  const step = url.searchParams.get("step");

  if (step === "options") {
    return handleOptions(request);
  }
  if (step === "verify") {
    return handleVerify(request);
  }
  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}

async function handleOptions(request: Request) {
  try {
    const body = await request.json() as { displayName?: string; email?: string };
    const displayName = body.displayName?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!displayName || !email) {
      return NextResponse.json({ error: "Display name and email are required" }, { status: 400 });
    }

    // Check for existing operator — skip if SpacetimeDB unreachable
    try {
      const existing = await findOperatorByEmail(email);
      if (existing && existing.operatorId) {
        return NextResponse.json({ error: "An operator with this email already exists" }, { status: 409 });
      }
    } catch {
      // SpacetimeDB unreachable — allow registration to proceed
    }

    const operatorId = randomUUID();
    const options = await generateRegistration(operatorId, displayName);

    challenges.set(options.challenge, {
      challenge: options.challenge,
      operatorId,
      displayName,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return NextResponse.json(options);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration options failed" },
      { status: 500 },
    );
  }
}

async function handleVerify(request: Request) {
  try {
    const body = await request.json();

    // Find the matching challenge
    let challengeEntry: (typeof challenges extends Map<string, infer V> ? V : never) | undefined;
    for (const [key, value] of challenges) {
      if (Date.now() < value.expiresAt) {
        challengeEntry = value;
        challenges.delete(key);
        break;
      }
      challenges.delete(key); // expired
    }

    if (!challengeEntry) {
      return NextResponse.json({ error: "Challenge expired or not found" }, { status: 400 });
    }

    const verification = await verifyRegistration(body, challengeEntry.challenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    // Register operator in SpacetimeDB
    const client = createControlClient();
    await client.callReducer("register_operator", [
      challengeEntry.operatorId,
      challengeEntry.displayName,
      challengeEntry.email,
      credential.id,
      JSON.stringify(Array.from(credential.publicKey)),
      JSON.stringify(credential.transports ?? []),
    ]);

    // Set session cookie
    const session: OperatorSession = {
      operatorId: challengeEntry.operatorId,
      displayName: challengeEntry.displayName,
      email: challengeEntry.email,
      role: "operator",
    };
    await setSessionCookie(session);

    return NextResponse.json({ verified: true, operatorId: challengeEntry.operatorId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration verification failed" },
      { status: 500 },
    );
  }
}
