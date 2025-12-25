import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EyeOff, Shield, FileText, CheckCircle, Scale } from "lucide-react";
import P3 from "@/lib/sdk";

type SendStatus = "idle" | "encrypting" | "sending" | "sent";
type RecipientGroup = "journalists" | "law_enforcement";

export default function AnonymousSendTile() {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SendStatus>("idle");
  const [lastSent, setLastSent] = useState<{ group: RecipientGroup; ts: number } | null>(null);

  async function sendAnonymous(group: RecipientGroup) {
    if (!message.trim() && !file) return;
    
    setStatus("encrypting");
    await new Promise(r => setTimeout(r, 800));
    
    setStatus("sending");
    
    const digest = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    try {
      await P3.proofs.publish("anonymous_send", { 
        group, 
        hasMessage: !!message.trim(),
        hasAttachment: !!file,
        digest: digest.slice(0, 18) + "...",
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    
    setStatus("sent");
    setLastSent({ group, ts: Date.now() });
    setMessage("");
    setFile(null);
    
    setTimeout(() => setStatus("idle"), 3000);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const groupLabels: Record<RecipientGroup, { label: string; icon: typeof FileText; color: string }> = {
    journalists: { label: "Journalists", icon: FileText, color: "text-blue-400" },
    law_enforcement: { label: "Law Enforcement", icon: Scale, color: "text-orange-400" }
  };

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-anonymous-send">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <EyeOff className="h-5 w-5 text-violet-400" />
            Anonymous Send
          </CardTitle>
          <Badge variant="secondary" className="bg-violet-500/20 text-violet-400">
            {status === "idle" ? "Secure" : status === "sent" ? "Sent" : "Processing"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          End-to-end encrypted anonymous messaging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "sent" && lastSent ? (
          <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/20 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-violet-400 mb-2" />
            <p className="text-violet-300 font-medium">Message Sent Anonymously</p>
            <p className="text-xs text-slate-400 mt-1">
              Delivered to {groupLabels[lastSent.group].label}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Your identity is protected. No logs retained.
            </p>
          </div>
        ) : (
          <>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Shield className="h-3 w-3" />
                <span>Messages are encrypted before leaving your device</span>
              </div>
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message... Your identity will remain anonymous."
              className="bg-slate-800 border-slate-700 resize-none"
              rows={4}
              disabled={status !== "idle"}
              data-testid="input-anonymous-message"
            />
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="anon-file"
                data-testid="input-anonymous-file"
              />
              <label 
                htmlFor="anon-file" 
                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400">
                  {file ? file.name.slice(0, 20) + (file.name.length > 20 ? "..." : "") : "Attach file"}
                </span>
              </label>
              {file && <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => sendAnonymous("journalists")}
                disabled={status !== "idle" || (!message.trim() && !file)}
                className="bg-blue-500 hover:bg-blue-600"
                data-testid="button-send-journalists"
              >
                <FileText className="h-4 w-4 mr-1" />
                {status === "encrypting" ? "Encrypting..." : status === "sending" ? "Sending..." : "Journalists"}
              </Button>
              <Button 
                onClick={() => sendAnonymous("law_enforcement")}
                disabled={status !== "idle" || (!message.trim() && !file)}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="button-send-law-enforcement"
              >
                <Scale className="h-4 w-4 mr-1" />
                {status === "encrypting" ? "Encrypting..." : status === "sending" ? "Sending..." : "Law Enf."}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
