import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Upload, CheckCircle, Pen, Shield, Hash, FileCheck } from "lucide-react";
import P3 from "@/lib/sdk";

type NotaryDoc = {
  id: string;
  title: string;
  fileName: string;
  sha256: string;
  size: number;
  signatures: number;
  verified: boolean;
  ts: number;
};

function generateId() {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ProofOfNotaryTile() {
  const [doc, setDoc] = useState<NotaryDoc | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function upload() {
    if (!file || !title.trim()) return;
    setLoading(true);
    
    const sha256 = await computeSHA256(file);
    const id = generateId();
    
    const newDoc: NotaryDoc = {
      id,
      title: title.trim(),
      fileName: file.name,
      sha256,
      size: file.size,
      signatures: 0,
      verified: false,
      ts: Date.now()
    };
    
    try {
      await P3.proofs.publish("notary_doc_upload", { 
        docId: id, 
        title: newDoc.title, 
        digest: sha256.slice(0, 16) + "...",
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    
    setDoc(newDoc);
    setTitle("");
    setFile(null);
    setLoading(false);
  }

  async function signDoc() {
    if (!doc) return;
    
    const updatedDoc = { ...doc, signatures: doc.signatures + 1 };
    setDoc(updatedDoc);
    
    try {
      await P3.proofs.publish("notary_signature", { 
        docId: doc.id, 
        sigCount: updatedDoc.signatures, 
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  }

  async function verifyDoc() {
    if (!doc) return;
    
    const updatedDoc = { ...doc, verified: true };
    setDoc(updatedDoc);
    
    try {
      await P3.proofs.publish("notary_verify", { 
        docId: doc.id, 
        verified: true, 
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  }

  function resetDoc() {
    setDoc(null);
    setTitle("");
    setFile(null);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-notary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-emerald-400" />
            Proof-of-Notary
          </CardTitle>
          <Badge variant="secondary" className={doc?.verified ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}>
            {doc?.verified ? "Verified" : doc ? "Pending" : "Upload"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Document notarization with cryptographic proofs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!doc ? (
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="bg-slate-800 border-slate-700"
              data-testid="input-notary-title"
            />
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="notary-file"
                data-testid="input-notary-file"
              />
              <label htmlFor="notary-file" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">
                  {file ? file.name : "Click to select document"}
                </p>
                {file && <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>}
              </label>
            </div>
            <Button 
              onClick={upload} 
              disabled={loading || !file || !title.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              data-testid="button-upload-notary"
            >
              <Shield className="h-4 w-4 mr-2" />
              {loading ? "Processing..." : "Upload & Anchor"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <FileCheck className="h-8 w-8 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">{doc.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{doc.fileName}</p>
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Hash className="h-3 w-3 text-slate-500" />
                  <span className="text-slate-400 font-mono truncate">SHA-256: {doc.sha256.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatBytes(doc.size)}</span>
                  <span>{doc.signatures} signature{doc.signatures !== 1 ? 's' : ''}</span>
                </div>
              </div>
              
              {doc.verified && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Document Verified</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={signDoc}
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                data-testid="button-sign-notary"
              >
                <Pen className="h-4 w-4 mr-1" />
                Sign
              </Button>
              <Button 
                onClick={verifyDoc}
                disabled={doc.verified}
                className="bg-emerald-500 hover:bg-emerald-600"
                data-testid="button-verify-notary"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Verify
              </Button>
            </div>
            
            <Button 
              variant="outline"
              onClick={resetDoc}
              className="w-full border-slate-600"
              data-testid="button-reset-notary"
            >
              New Document
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
