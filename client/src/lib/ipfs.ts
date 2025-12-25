const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
  const response = await fetch(`${IPFS_GATEWAY}${cid}`);
  if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function fetchJSONFromIPFS<T>(cid: string): Promise<T> {
  const bytes = await fetchFromIPFS(cid);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

export interface UploadResult {
  cid: string;
  size: number;
}

export async function uploadToIPFS(data: Uint8Array, filename?: string): Promise<UploadResult> {
  const formData = new FormData();
  const blob = new Blob([data], { type: 'application/octet-stream' });
  formData.append('file', blob, filename || `encrypted-${Date.now()}.bin`);
  
  const pinataMetadata = JSON.stringify({
    name: filename || `p3-gallery-${Date.now()}`,
    keyvalues: {
      app: 'p3-gallery',
      encrypted: 'true'
    }
  });
  formData.append('pinataMetadata', pinataMetadata);

  const response = await fetch('/api/ipfs/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }
  
  const result = await response.json();
  return {
    cid: result.IpfsHash || result.cid,
    size: result.PinSize || data.length
  };
}

export async function uploadEncryptedBlob(
  encryptedData: Uint8Array, 
  iv: Uint8Array,
  owner: string
): Promise<UploadResult> {
  const combined = new Uint8Array(iv.length + encryptedData.length);
  combined.set(iv, 0);
  combined.set(encryptedData, iv.length);
  
  return uploadToIPFS(combined, `gallery-${owner.slice(0, 8)}-${Date.now()}.enc`);
}

export function getIPFSUrl(cid: string): string {
  return `${IPFS_GATEWAY}${cid}`;
}
