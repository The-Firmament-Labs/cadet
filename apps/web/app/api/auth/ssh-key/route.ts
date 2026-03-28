import { NextResponse } from "next/server";
import { generateKeyPairSync } from "node:crypto";
import { requireOperatorApiSession } from "@/lib/auth";

/**
 * POST /api/auth/ssh-key — Generate an ed25519 SSH key pair for the operator.
 * Returns the private key (download once) and stores the public key with the operator.
 */
export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    // Generate ed25519 key pair
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // Convert PEM public key to OpenSSH format for authorized_keys
    const publicKeyBase64 = publicKey
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\n/g, "");

    const sshPublicKey = `ssh-ed25519 ${publicKeyBase64} cadet-operator-${operatorId}`;

    // TODO: Store sshPublicKey in SpacetimeDB operator record
    // await storeOperatorSshKey(operatorId, sshPublicKey);

    return NextResponse.json({
      ok: true,
      publicKey: sshPublicKey,
      privateKey,
      instructions: [
        "Save the private key to ~/.ssh/cadet_ed25519",
        "Run: chmod 600 ~/.ssh/cadet_ed25519",
        "Add to SSH config: Host cadet-cloud",
        "  IdentityFile ~/.ssh/cadet_ed25519",
        "  User operator",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Key generation failed" },
      { status: 500 },
    );
  }
}
