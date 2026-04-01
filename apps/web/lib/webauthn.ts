import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";

const RP_NAME = "Cadet Mission Control";

function getRpId(): string {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`).hostname;
  }
  return "localhost";
}

function getOrigin(): string {
  if (process.env.WEBAUTHN_ORIGIN) return process.env.WEBAUTHN_ORIGIN;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3001";
}

export async function generateRegistration(
  operatorId: string,
  operatorName: string,
  existingCredentialIds: string[] = [],
) {
  const rpID = getRpId();
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(operatorId),
    userName: operatorName,
    attestationType: "none",
    excludeCredentials: existingCredentialIds.map((id) => ({
      id,
      transports: ["internal" as AuthenticatorTransportFuture],
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
  });
}

export async function generateAuthentication(
  credentialIds: Array<{
    id: string;
    transports: AuthenticatorTransportFuture[];
  }>,
) {
  return generateAuthenticationOptions({
    rpID: getRpId(),
    allowCredentials: credentialIds.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    userVerification: "required",
  });
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credentialPublicKey: Uint8Array<ArrayBuffer>,
  credentialCounter: number,
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    credential: {
      id: response.id,
      publicKey: credentialPublicKey,
      counter: credentialCounter,
    },
  });
}
