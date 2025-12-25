window.P3 = {
  wallet: async () => {
    if (window.ethereum) {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      return addr;
    }
    return "0x-anon";
  },
  payNative: async (to, amountEth) => {
    const wei = (Number(amountEth) * 1e18).toString();
    const res = await fetch("/api/payments/initiate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, amount: wei, token: "native" })
    }).then(r => r.json());
    
    if (window.ethereum) {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: await P3.wallet(), to, value: '0x' + BigInt(wei).toString(16) }]
      });
      await fetch("/api/payments/record", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, chainId: 8453, from: await P3.wallet(), to, amount: wei, token: "native", timestamp: new Date().toISOString() })
      });
      return { hash: txHash };
    }
    throw new Error('No wallet connected');
  },
  msgEncrypted: async (recipient, text) => {
    const cid = "demoCID-" + Math.random().toString(36).slice(2);
    const me = await window.P3.wallet();
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sender": me },
      body: JSON.stringify({ recipient, cid, nonce: "nonce", wrappedKey: "key" })
    });
    return cid;
  },
  anchor: async (data) => {
    try {
      const hash = JSON.stringify(data);
      const response = await fetch("/api/proofs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: data.type, hash, metadata: data })
      });
      if (!response.ok) {
        console.warn("P3.anchor: Failed to publish proof");
        return null;
      }
      const result = await response.json();
      console.log("P3.anchor: Published", data.type, result);
      return result;
    } catch (e) {
      console.warn("P3.anchor: Error", e);
      return null;
    }
  }
};
