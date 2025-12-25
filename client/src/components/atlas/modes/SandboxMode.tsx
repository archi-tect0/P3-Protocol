import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Box, Plus, Code, Layers, Play, Send, Eye, RefreshCw,
  AlertCircle, Loader2, Check, Clock, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type ProjectKind = 'app' | 'canvasCard' | 'workflow';
type ProjectStatus = 'draft' | 'awaitingApproval' | 'approved' | 'rejected' | 'exported';

interface SandboxProject {
  id: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

interface ProjectsResponse {
  projects: SandboxProject[];
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  awaitingApproval: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  exported: 'bg-blue-500/20 text-blue-300',
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  awaitingApproval: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  exported: 'Exported',
};

const KIND_ICONS: Record<ProjectKind, any> = {
  app: Code,
  canvasCard: Layers,
  workflow: Play,
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function SandboxMode() {
  const wallet = useAtlasStore(s => s.wallet);
  const pushReceipt = useAtlasStore(s => s.pushReceipt);
  const { toast } = useToast();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKind, setNewProjectKind] = useState<ProjectKind>('app');
  const [selectedProject, setSelectedProject] = useState<SandboxProject | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ProjectsResponse>({
    queryKey: ['/api/sandbox/projects', wallet],
    enabled: !!wallet,
  });

  const createProject = useMutation({
    mutationFn: async (params: { name: string; kind: ProjectKind }) => {
      return apiRequest('/api/sandbox/projects', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sandbox/projects'] });
      setShowCreateForm(false);
      setNewProjectName('');
      toast({ title: 'Project created' });
      pushReceipt({
        id: `receipt-sandbox-create-${data.project.id}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.sandbox.project.create',
        endpoint: '/api/sandbox/projects',
        timestamp: Date.now(),
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create project', description: err.message, variant: 'destructive' });
    },
  });

  const submitForApproval = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/sandbox/projects/${projectId}/submitForApproval`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sandbox/projects'] });
      toast({ title: 'Submitted for review' });
    },
    onError: (err: Error) => {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    },
  });

  const startPreview = useMutation({
    mutationFn: async (params: { projectId: string; mode: 'app' | 'canvasCard' }) => {
      return apiRequest(`/api/sandbox/projects/${params.projectId}/preview`, {
        method: 'POST',
        body: JSON.stringify({ mode: params.mode }),
      });
    },
    onSuccess: (data) => {
      toast({ title: 'Preview started' });
      if (data.preview?.url) {
        window.open(data.preview.url, '_blank');
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="sandbox-no-wallet">
        <Box className="w-12 h-12 text-white/30" />
        <p className="text-white/60 text-center">Connect wallet to use Sandbox</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="sandbox-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="sandbox-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load projects</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-sandbox-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const projects = data?.projects || [];

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="sandbox-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80">Atlas Sandbox</h2>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30"
          data-testid="button-new-project"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10"
            data-testid="create-project-form"
          >
            <h3 className="text-lg text-white/80 mb-4">Create New Project</h3>
            <div className="space-y-4">
              <Input
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="bg-black/30 border-white/20 text-white placeholder:text-white/40"
                data-testid="input-project-name"
              />
              
              <div className="flex gap-2">
                {(['app', 'canvasCard', 'workflow'] as ProjectKind[]).map((kind) => {
                  const Icon = KIND_ICONS[kind];
                  return (
                    <button
                      key={kind}
                      onClick={() => setNewProjectKind(kind)}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        newProjectKind === kind
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                      data-testid={`button-kind-${kind}`}
                    >
                      <Icon className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-xs capitalize">{kind === 'canvasCard' ? 'Canvas Card' : kind}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 text-white/60"
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createProject.mutate({ name: newProjectName, kind: newProjectKind })}
                  disabled={!newProjectName.trim() || createProject.isPending}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                  data-testid="button-confirm-create"
                >
                  {createProject.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Create'
                  )}
                </Button>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="sandbox-empty">
          <Box className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No projects yet</p>
          <p className="text-sm text-white/40">Create your first AI-built app or Canvas card</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => {
            const KindIcon = KIND_ICONS[project.kind];
            return (
              <MotionDiv
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors cursor-pointer"
                onClick={() => setSelectedProject(project)}
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-white/10">
                      <KindIcon className="w-4 h-4 text-white/70" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/90" data-testid={`text-project-name-${project.id}`}>
                        {project.name}
                      </h3>
                      <p className="text-xs text-white/50 capitalize">
                        {project.kind === 'canvasCard' ? 'Canvas Card' : project.kind}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[project.status]}`}>
                    {STATUS_LABELS[project.status]}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(project.updatedAt)}
                  </span>
                  
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {project.status === 'draft' && (
                      <>
                        <button
                          onClick={() => startPreview.mutate({ 
                            projectId: project.id, 
                            mode: project.kind === 'canvasCard' ? 'canvasCard' : 'app' 
                          })}
                          className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                          title="Preview"
                          data-testid={`button-preview-${project.id}`}
                        >
                          <Eye className="w-3 h-3 text-white/70" />
                        </button>
                        <button
                          onClick={() => submitForApproval.mutate(project.id)}
                          className="p-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors"
                          title="Submit for Review"
                          data-testid={`button-submit-${project.id}`}
                        >
                          <Send className="w-3 h-3 text-cyan-300" />
                        </button>
                      </>
                    )}
                    {project.status === 'approved' && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-3 h-3" />
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </MotionDiv>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedProject && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedProject(null)}
            data-testid="project-modal"
          >
            <MotionDiv
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white/90">{selectedProject.name}</h3>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-1 rounded hover:bg-white/10"
                  data-testid="button-close-modal"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm">Type:</span>
                  <span className="text-white/80 text-sm capitalize">
                    {selectedProject.kind === 'canvasCard' ? 'Canvas Card' : selectedProject.kind}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selectedProject.status]}`}>
                    {STATUS_LABELS[selectedProject.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm">Last updated:</span>
                  <span className="text-white/80 text-sm">{formatTimeAgo(selectedProject.updatedAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                {selectedProject.status === 'draft' && (
                  <>
                    <Button
                      onClick={() => {
                        startPreview.mutate({ 
                          projectId: selectedProject.id, 
                          mode: selectedProject.kind === 'canvasCard' ? 'canvasCard' : 'app' 
                        });
                        setSelectedProject(null);
                      }}
                      className="flex-1 bg-white/10 hover:bg-white/20"
                      data-testid="button-modal-preview"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      onClick={() => {
                        submitForApproval.mutate(selectedProject.id);
                        setSelectedProject(null);
                      }}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                      data-testid="button-modal-submit"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit
                    </Button>
                  </>
                )}
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
