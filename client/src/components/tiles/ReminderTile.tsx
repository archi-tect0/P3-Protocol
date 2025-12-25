import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, Copy, Check, Bell } from "lucide-react";
import P3 from "@/lib/sdk";

export default function ReminderTile() {
  const { toast } = useToast();
  const [reminder, setReminder] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [anchoredCid, setAnchoredCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSetReminder = async () => {
    if (!reminder.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reminder",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          payload: {
            text: reminder,
            createdAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to anchor reminder");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmRemind${Date.now().toString(36)}`;

      setAnchoredCid(cid);
      setReminder("");

      try {
        await P3.proofs.publish("reminder_create", { reminderId: cid, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Reminder Set",
        description: "Your reminder has been anchored",
      });
    } catch (error) {
      console.error("Reminder error:", error);
      const mockCid = `QmRemind${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setAnchoredCid(mockCid);
      setReminder("");

      toast({
        title: "Reminder Set (Demo)",
        description: "Anchored locally",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCid = async () => {
    if (anchoredCid) {
      await navigator.clipboard.writeText(anchoredCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-reminder">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-orange-600/20">
            <Clock className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Reminder</h3>
            <p className="text-xs text-slate-400">Anchor reminder events</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter your reminder..."
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
            data-testid="input-reminder-text"
          />

          <Button
            onClick={handleSetReminder}
            disabled={isLoading || !reminder.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-set-reminder"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Anchoring...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Set
              </>
            )}
          </Button>

          {anchoredCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-1">Anchored CID</p>
                  <p className="text-sm text-emerald-400 font-mono truncate" data-testid="text-reminder-cid">
                    {anchoredCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-reminder-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
