import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import P3 from "@/lib/sdk";

interface StoryLine {
  id: string;
  text: string;
  timestamp: Date;
}

export default function StoryTile() {
  const { toast } = useToast();
  const [newLine, setNewLine] = useState("");
  const [lines, setLines] = useState<StoryLine[]>([]);

  const handleAddLine = async () => {
    if (!newLine.trim()) {
      toast({
        title: "Error",
        description: "Please enter a line to add",
        variant: "destructive",
      });
      return;
    }

    const line: StoryLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: newLine.trim(),
      timestamp: new Date(),
    };

    try {
      await P3.proofs.publish("story_contribution", { lineId: line.id, text: line.text.slice(0, 50), ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }

    setLines((prev) => [...prev, line]);
    setNewLine("");
    
    toast({
      title: "Line Added",
      description: "Your contribution has been added to the story",
    });
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddLine();
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-story">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Collab Story</h3>
          
          <div className="space-y-3">
            <Textarea
              placeholder="Add your line to the story..."
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              data-testid="textarea-story-line"
            />
            
            <Button
              onClick={handleAddLine}
              disabled={!newLine.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              data-testid="button-add-line"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Line
            </Button>

            {lines.length > 0 && (
              <div className="mt-4 max-h-[200px] overflow-y-auto">
                <p className="text-xs text-slate-400 mb-2 text-left">
                  Story Lines ({lines.length})
                </p>
                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="p-2 rounded-lg bg-slate-900/50 border border-slate-700 text-left group"
                      data-testid={`story-line-${index}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-300 flex-1">
                          <span className="text-purple-400 font-mono mr-2">
                            {index + 1}.
                          </span>
                          {line.text}
                        </p>
                        <button
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-800 transition-all flex-shrink-0"
                          data-testid={`button-remove-line-${index}`}
                        >
                          <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lines.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-500">
                  No lines yet. Start the story!
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
