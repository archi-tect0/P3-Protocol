import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Upload, Download, RefreshCw, LogOut, Copy, Check } from "lucide-react";
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

type ExportPayload = {
  version: 1;
  ticket: SessionTicket;
};

function deviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  return { ua: ua.slice(0, 50), tz };
}

export default function CrossDeviceResumeTile() {
  const [ticket, setTicket] = useState<SessionTicket | null>(null);
  const [exportBlob, setExportBlob] = useState<string>("");
  const [importText, setImportText] = useState<string>("");
  const [valid, setValid] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const chainId = 8453;
  const verifyingContract = "0x2539823790424051Eb03eBea1EA9bc40A475A34D";

  useEffect(() => {
    const t = getTicket();
    const ok = t && isTicketValid();
    setTicket(ok ? t : null);
    setValid(!!ok);
  }, []);

  async function createAndSign() {
    const devTicket = createDevTicket(`resume-${Date.now()}`, chainId, verifyingContract);
    const signed = await signTicket(devTicket);
    const fullTicket = { ...devTicket, clientSig: signed };
    setTicket(fullTicket);
    setValid(true);
    await P3.proofs.publish("session_start", {
      ticketId: devTicket.id,
      domain: EIP712_DOMAIN(chainId, verifyingContract),
      device: deviceInfo(),
      ts: Date.now(),
    });
  }

  function exportTicket() {
    if (!ticket) return;
    const payload: ExportPayload = { version: 1, ticket };
    const text = JSON.stringify(payload);
    setExportBlob(text);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(exportBlob);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function importTicket() {
    try {
      const data = JSON.parse(importText) as ExportPayload;
      if (!data?.ticket) throw new Error("Invalid import payload");
      localStorage.setItem("P3_SESSION_TICKET", JSON.stringify(data.ticket));
      setTicket(data.ticket);
      setValid(true);
      await P3.proofs.publish("session_resume", {
        ticketId: data.ticket.id,
        device: deviceInfo(),
        ts: Date.now(),
      });
    } catch (e) {
      console.error(e);
      setValid(false);
    }
  }

  async function clear() {
    clearTicket();
    localStorage.removeItem("P3_SESSION_TICKET");
    setTicket(null);
    setValid(false);
    setExportBlob("");
    setImportText("");
    await P3.proofs.publish("session_end", {
      ts: Date.now(),
    });
  }

  const shareUrl = useMemo(() => {
    if (!exportBlob) return "";
    const encoded = encodeURIComponent(exportBlob);
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/resume#import=${encoded}`;
  }, [exportBlob]);

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-cross-device">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-purple-400" />
            Cross-Device Resume
          </CardTitle>
          <Badge variant={valid ? "default" : "secondary"} className={valid ? "bg-purple-500/20 text-purple-400" : ""}>
            {valid ? "Active" : "No Session"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Export/import session tickets across devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!valid ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-10 w-10 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 text-center">
              Create a session ticket to enable cross-device continuity
            </p>
            <Button 
              onClick={createAndSign}
              className="w-full bg-purple-500 hover:bg-purple-600"
              data-testid="button-create-session"
            >
              Create & Sign Session
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <span className="text-xs text-purple-400">
                Ticket: {ticket?.id.slice(0, 12)}...
              </span>
              <span className="text-xs text-slate-500">
                Expires: {ticket ? new Date(ticket.expiresAt).toLocaleTimeString() : ''}
              </span>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "import")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger 
                  value="export" 
                  className="data-[state=active]:bg-slate-700"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </TabsTrigger>
                <TabsTrigger 
                  value="import" 
                  className="data-[state=active]:bg-slate-700"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </TabsTrigger>
              </TabsList>
              <TabsContent value="export" className="space-y-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportTicket}
                    className="w-full border-slate-600"
                    data-testid="button-generate-export"
                  >
                    Generate Export Payload
                  </Button>
                  {exportBlob && (
                    <>
                      <Textarea 
                        readOnly 
                        value={exportBlob} 
                        rows={3}
                        className="text-xs bg-slate-800 border-slate-700 font-mono"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={copyToClipboard}
                          className="flex-1 border-slate-600"
                          data-testid="button-copy-payload"
                        >
                          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                      <Input 
                        readOnly 
                        value={shareUrl} 
                        className="text-xs bg-slate-800 border-slate-700 font-mono"
                      />
                    </>
                  )}
                </TabsContent>
              <TabsContent value="import" className="space-y-2 mt-3">
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste export JSON from other device..."
                  rows={3}
                  className="text-xs bg-slate-800 border-slate-700 font-mono"
                  data-testid="input-import-payload"
                />
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={importTicket}
                  disabled={!importText}
                  className="w-full border-slate-600"
                  data-testid="button-import-resume"
                >
                  Import & Resume
                </Button>
              </TabsContent>
            </Tabs>

            <Button 
              variant="destructive" 
              size="sm"
              onClick={clear}
              className="w-full"
              data-testid="button-end-session"
            >
              <LogOut className="h-4 w-4 mr-2" />
              End Session
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
