import { NextResponse } from "next/server";
import { generateAuthentication, verifyAuthentication } from "@/lib/webauthn";
import {
  findCredentialsByOperator,
  findCredentialById,
  findOperatorByEmail,
  setSessionCookie,
  type OperatorSession,
} from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

// In-memory challenge store
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

export async function POST(request: Request) {
  const url = new URL(request.url);
  const step = url.searchParams.get("step");

  if (step === "options") return handleOptions(request);
  if (step === "verify") return handleVerify(request);
  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}

async function handleOptions(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const operator = await findOperatorByEmail(email);
    if (!operator) {
      return NextResponse.json({ error: "No operator found with this email" }, { status: 404 });
    }

    const credentials = await findCredentialsByOperator(operator.operatorId);
    if (credentials.length === 0) {
      return NextResponse.json({ error: "No passkeys registered for this operator" }, { status: 404 });
    }

    const allowCredentials = credentials.map((cred) => {
      let transports: AuthenticatorTransportFuture[] = [];
      try {
        transports = JSON.parse(cred.transportsJson) as AuthenticatorTransportFuture[];
      } catch { /* use empty */ }
      return { id: cred.credentialId, transports };
    });

    const options = await generateAuthentication(allowCredentials);

    challenges.set(options.challenge, {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return NextResponse.json({ ...options, operatorId: operator.operatorId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login options failed" },
      { status: 500 },
    );
  }
}

async function handleVerify(request: Request) {
  try {
    const body = await request.json();

    // Find valid challenge
    let matchedChallenge: string | undefined;
    for (const [key, value] of challenges) {
      if (Date.now() < value.expiresAt) {
        matchedChallenge = value.challenge;
        challenges.delete(key);
        break;
      }
      challenges.delete(key);
    }

    if (!matchedChallenge) {
      return NextResponse.json({ error: "Challenge expired or not found" }, { status: 400 });
    }

    const credentialId = body.id as string;
    const storedCredential = await findCredentialById(credentialId);
    if (!storedCredential) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 400 });
    }

    const publicKeyArray = JSON.parse(storedCredential.publicKeyJson) as number[];
    const publicKey = new Uint8Array(publicKeyArray);

    const verification = await verifyAuthentication(
      body,
      matchedChallenge,
      publicKey,
      storedCredential.counter,
    );

    if (!verification.verified) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
    }

    // Update counter in SpacetimeDB
    const client = createControlClient();
    await client.callReducer("update_webauthn_counter", [
      credentialId,
      verification.authenticationInfo.newCounter,
    ]);

    // Look up operator
    const operatorRows = (await client.sql(
      `SELECT operator_id, display_name, email, role FROM operator_account WHERE operator_id = '${storedCredential.operatorId.replace(/'/g, "''")}'`,
    )) as Record<string, unknown>[];

    if (operatorRows.length === 0) {
      return NextResponse.json({ error: "Operator not found" }, { status: 404 });
    }

    const op = operatorRows[0] as Record<string, unknown>;
    const session: OperatorSession = {
      operatorId: String(op.operator_id),
      displayName: String(op.display_name),
      email: String(op.email),
      role: String(op.role),
    };
    await setSessionCookie(session);

    return NextResponse.json({ verified: true, operatorId: session.operatorId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login verification failed" },
      { status: 500 },
    );
  }
}
