import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserCircle, Award, ThumbsUp, Briefcase, Code, Sparkles } from "lucide-react";
import P3 from "@/lib/sdk";

type ProCardData = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  endorsements: number;
  ts: number;
};

function generateId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProCardTile() {
  const [card, setCard] = useState<ProCardData | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);

  async function createCard() {
    if (!name.trim() || !role.trim()) return;
    setLoading(true);
    
    const id = generateId();
    const skillsList = skills.split(",").map(s => s.trim()).filter(Boolean);
    
    const newCard: ProCardData = {
      id,
      name: name.trim(),
      role: role.trim(),
      skills: skillsList.length > 0 ? skillsList : ["Protocol Developer"],
      endorsements: 0,
      ts: Date.now()
    };
    
    try {
      await P3.proofs.publish("procard_create", { cardId: id, name: newCard.name, role: newCard.role, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    
    setCard(newCard);
    setLoading(false);
  }

  async function endorse() {
    if (!card) return;
    
    const updatedCard = { ...card, endorsements: card.endorsements + 1 };
    setCard(updatedCard);
    
    try {
      await P3.proofs.publish("endorsement_add", { cardId: card.id, count: updatedCard.endorsements, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  }

  function resetCard() {
    setCard(null);
    setName("");
    setRole("");
    setSkills("");
  }

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-procard">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="h-5 w-5 text-amber-400" />
            ProCard
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
            {card ? "Active" : "Create"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Portable professional credential with endorsements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!card ? (
          <div className="space-y-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="bg-slate-800 border-slate-700"
              data-testid="input-procard-name"
            />
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role (e.g., Smart Contract Developer)"
              className="bg-slate-800 border-slate-700"
              data-testid="input-procard-role"
            />
            <Input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Skills (comma-separated)"
              className="bg-slate-800 border-slate-700"
              data-testid="input-procard-skills"
            />
            <Button 
              onClick={createCard} 
              disabled={loading || !name.trim() || !role.trim()}
              className="w-full bg-amber-500 hover:bg-amber-600"
              data-testid="button-create-procard"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Creating..." : "Create ProCard"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{card.name}</h4>
                  <p className="text-sm text-amber-300 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {card.role}
                  </p>
                </div>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-1">
                {card.skills.map((skill, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-amber-500/30 text-amber-300">
                    <Code className="h-3 w-3 mr-1" />
                    {skill}
                  </Badge>
                ))}
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-400">
                  <Award className="h-4 w-4" />
                  <span className="text-sm font-medium">{card.endorsements} endorsements</span>
                </div>
                <span className="text-xs text-slate-500">
                  Created {new Date(card.ts).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={endorse}
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                data-testid="button-endorse"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Endorse
              </Button>
              <Button 
                variant="outline"
                onClick={resetCard}
                className="border-slate-600"
                data-testid="button-reset-procard"
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
