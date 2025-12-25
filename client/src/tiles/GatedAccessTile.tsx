import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Shield, FileCheck, BarChart3, Key } from "lucide-react";
import {
  createDevTicket,
  getTicket,
  clearTicket,
  isTicketValid,
  signTicket,
  EIP712_DOMAIN,
} from "@/lib/sdk/bridge";
import type { SessionTicket } from "@/lib/sdk/bridge";
import P3 from "@/lib/sdk";

export default function GatedAccessTile() {
  const [ticket, setTicket] = useState<SessionTicket | null>(null);
  const [status, setStatus] = useState<"locked" | "ready" | "signing">("locked");
  const chainId = 8453;
  const verifyingContract = "0x2539823790424051Eb03eBea1EA9bc40A475A34D";

  useEffect(() => {
    const t = getTicket();
    if (t && isTicketValid()) {
      setTicket(t);
      setStatus("ready");
    }
  }, []);

  async function signNewTicket() {
    try {
      setStatus("signing");
      const anchorsDigestHash = `hub-gated-${Date.now()}`;
      const devTicket = createDevTicket(anchorsDigestHash, chainId, verifyingContract);
      const signed = await signTicket(devTicket);
      setTicket({ ...devTicket, clientSig: signed });
      setStatus("ready");
      await P3.proofs.publish("tile_access_grant", {
        tile: "EnterpriseConsole",
        ticketId: devTicket.id,
        domain: EIP712_DOMAIN(chainId, verifyingContract),
        ts: Date.now(),
      });
    } catch (e) {
      console.error(e);
      setStatus("locked");
    }
  }

  async function revoke() {
    clearTicket();
    setTicket(null);
    setStatus("locked");
    await P3.proofs.publish("tile_access_revoke", {
      tile: "EnterpriseConsole",
      ts: Date.now(),
    });
  }

  async function enterpriseAction(action: string) {
    if (!ticket) return;
    await P3.proofs.publish("enterprise_action", {
      action,
      ticketId: ticket.id,
      ts: Date.now(),
    });
  }

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-gated-access">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-sky-400" />
            Gated Access
          </CardTitle>
          <Badge variant={status === "ready" ? "default" : "secondary"} className={status === "ready" ? "bg-green-500/20 text-green-400" : ""}>
            {status === "ready" ? "Unlocked" : status === "signing" ? "Signing..." : "Locked"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Session ticket gated enterprise console
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status !== "ready" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-6">
              <Lock className="h-12 w-12 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 text-center">
              Sign an EIP-712 session ticket to access enterprise features
            </p>
            <Button 
              onClick={signNewTicket} 
              disabled={status === "signing"}
              className="w-full bg-sky-500 hover:bg-sky-600"
              data-testid="button-sign-ticket"
            >
              <Key className="h-4 w-4 mr-2" />
              {status === "signing" ? "Signing..." : "Sign Session Ticket"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Unlock className="h-5 w-5 text-green-400" />
              <span className="text-sm text-green-400">
                Ticket: {ticket?.id.slice(0, 8)}...
              </span>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Enterprise Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => enterpriseAction("policy_update_preview")}
                  className="border-slate-600 hover:bg-slate-700"
                  data-testid="button-policy-preview"
                >
                  <FileCheck className="h-4 w-4 mr-1" />
                  Policy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => enterpriseAction("quota_report_view")}
                  className="border-slate-600 hover:bg-slate-700"
                  data-testid="button-quota-report"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Quotas
                </Button>
              </div>
            </div>

            <Button 
              variant="destructive" 
              size="sm"
              onClick={revoke}
              className="w-full"
              data-testid="button-revoke-access"
            >
              Revoke Access
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
