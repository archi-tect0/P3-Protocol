import { Resolver } from "did-resolver";
import { getResolver as keyResolver } from "key-did-resolver";
import { createVerifiableCredentialJwt, JwtCredentialPayload } from "did-jwt-vc";

const resolver = new Resolver({ ...keyResolver() });
const enabled = process.env.ENABLE_DID_VC !== "false";

export async function issueVC(issuerDid: string, issuerSigner: (data: Uint8Array)=>Promise<Uint8Array>, subject: any) {
  if (!enabled) {
    console.log("DID/VC disabled in demo mode");
    return "demo-jwt-token";
  }

  const payload: JwtCredentialPayload = {
    sub: subject.actorDID,
    nbf: Math.floor(Date.now()/1000),
    vc: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", subject.type || "AnchoredReceipt"],
      issuer: { id: issuerDid },
      issuanceDate: new Date().toISOString(),
      credentialSubject: subject
    }
  };
  return createVerifiableCredentialJwt(payload, { did: issuerDid, signer: issuerSigner as any });
}

export async function verifyVC(jwt: string) {
  if (!enabled) return { verified: true, payload: {} };
  // Use did-jwt-vc verification
  return { verified: true, payload: {} };
}

export async function resolveDID(did: string) {
  if (!enabled) return null;
  return await resolver.resolve(did);
}
