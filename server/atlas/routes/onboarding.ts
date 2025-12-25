import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

interface NarrationItem {
  id: string;
  text: string;
  stage: string;
  order: number;
}

interface OnboardingData {
  version: string;
  narrations: {
    welcome: NarrationItem;
    userTypePrompt: NarrationItem;
    faceSetup: NarrationItem;
    endUser: Record<string, NarrationItem>;
    developer: Record<string, NarrationItem>;
  };
  stages: string[];
  userTypes: string[];
}

interface OnboardingStatus {
  wallet: string;
  completed: boolean;
  userType: 'endUser' | 'developer' | null;
  currentStage: string;
  completedStages: string[];
  startedAt: number;
  completedAt: number | null;
}

const statusStore = new Map<string, OnboardingStatus>();

let cachedData: OnboardingData | null = null;

function loadOnboardingData(): OnboardingData {
  if (cachedData) {
    return cachedData;
  }
  
  const dataPath = path.join(__dirname, '../data/onboarding.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  cachedData = JSON.parse(rawData) as OnboardingData;
  return cachedData;
}

router.get('/scripts', (_req: Request, res: Response) => {
  try {
    const data = loadOnboardingData();
    res.json({
      ok: true,
      version: data.version,
      narrations: data.narrations,
      stages: data.stages,
      userTypes: data.userTypes,
      'data-testid': 'onboarding-scripts-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load onboarding scripts',
      'data-testid': 'onboarding-scripts-error',
    });
  }
});

router.get('/scripts/:userType', (req: Request, res: Response) => {
  try {
    const { userType } = req.params;
    const data = loadOnboardingData();
    
    if (!data.userTypes.includes(userType)) {
      res.status(400).json({
        ok: false,
        error: `Invalid user type. Valid types: ${data.userTypes.join(', ')}`,
        'data-testid': 'onboarding-scripts-error',
      });
      return;
    }
    
    const commonNarrations = [
      data.narrations.welcome,
      data.narrations.userTypePrompt,
      data.narrations.faceSetup,
    ];
    
    const userNarrations = Object.values(
      data.narrations[userType as keyof typeof data.narrations] as Record<string, NarrationItem>
    );
    
    const allNarrations = [...commonNarrations, ...userNarrations].sort(
      (a, b) => a.order - b.order
    );
    
    res.json({
      ok: true,
      userType,
      narrations: allNarrations,
      count: allNarrations.length,
      'data-testid': 'onboarding-scripts-usertype-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load onboarding scripts',
      'data-testid': 'onboarding-scripts-error',
    });
  }
});

router.get('/narration/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = loadOnboardingData();
    
    const findNarration = (narrations: Record<string, NarrationItem | Record<string, NarrationItem>>): NarrationItem | null => {
      for (const [key, value] of Object.entries(narrations)) {
        if ((value as NarrationItem).id === id) {
          return value as NarrationItem;
        }
        if (typeof value === 'object' && !('text' in value)) {
          const nested = findNarration(value as Record<string, NarrationItem>);
          if (nested) return nested;
        }
      }
      return null;
    };
    
    const narration = findNarration(data.narrations as unknown as Record<string, NarrationItem | Record<string, NarrationItem>>);
    
    if (!narration) {
      res.status(404).json({
        ok: false,
        error: `Narration "${id}" not found`,
        'data-testid': 'onboarding-narration-error',
      });
      return;
    }
    
    res.json({
      ok: true,
      narration,
      'data-testid': 'onboarding-narration-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load narration',
      'data-testid': 'onboarding-narration-error',
    });
  }
});

router.get('/status/:wallet', (req: Request, res: Response) => {
  const { wallet } = req.params;
  
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(400).json({
      ok: false,
      error: 'Valid wallet address required',
      'data-testid': 'onboarding-status-error',
    });
    return;
  }
  
  const normalizedWallet = wallet.toLowerCase();
  const status = statusStore.get(normalizedWallet);
  
  if (!status) {
    res.json({
      ok: true,
      status: {
        wallet: normalizedWallet,
        completed: false,
        userType: null,
        currentStage: 'intro',
        completedStages: [],
        startedAt: null,
        completedAt: null,
      },
      'data-testid': 'onboarding-status-response',
    });
    return;
  }
  
  res.json({
    ok: true,
    status,
    'data-testid': 'onboarding-status-response',
  });
});

router.post('/status', (req: Request, res: Response) => {
  const { wallet, userType, currentStage, completedStage, completed } = req.body;
  
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(400).json({
      ok: false,
      error: 'Valid wallet address required',
      'data-testid': 'onboarding-status-error',
    });
    return;
  }
  
  const normalizedWallet = wallet.toLowerCase();
  const existing: OnboardingStatus = statusStore.get(normalizedWallet) || {
    wallet: normalizedWallet,
    completed: false,
    userType: null,
    currentStage: 'intro',
    completedStages: [] as string[],
    startedAt: Date.now(),
    completedAt: null,
  };
  
  const data = loadOnboardingData();
  
  if (userType && data.userTypes.includes(userType)) {
    existing.userType = userType;
  }
  
  if (currentStage && data.stages.includes(currentStage)) {
    existing.currentStage = currentStage;
  }
  
  if (completedStage && data.stages.includes(completedStage) && !existing.completedStages.includes(completedStage)) {
    existing.completedStages.push(completedStage);
  }
  
  if (completed === true) {
    existing.completed = true;
    existing.completedAt = Date.now();
    existing.currentStage = 'complete';
    if (!existing.completedStages.includes('complete')) {
      existing.completedStages.push('complete');
    }
  }
  
  statusStore.set(normalizedWallet, existing);
  
  res.json({
    ok: true,
    status: existing,
    'data-testid': 'onboarding-status-update-response',
  });
});

router.post('/complete', (req: Request, res: Response) => {
  const { wallet, userType } = req.body;
  
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(400).json({
      ok: false,
      error: 'Valid wallet address required',
      'data-testid': 'onboarding-complete-error',
    });
    return;
  }
  
  const normalizedWallet = wallet.toLowerCase();
  const data = loadOnboardingData();
  
  const status: OnboardingStatus = {
    wallet: normalizedWallet,
    completed: true,
    userType: data.userTypes.includes(userType) ? userType : 'endUser',
    currentStage: 'complete',
    completedStages: [...data.stages],
    startedAt: Date.now(),
    completedAt: Date.now(),
  };
  
  statusStore.set(normalizedWallet, status);
  
  res.json({
    ok: true,
    status,
    message: 'Onboarding completed successfully',
    'data-testid': 'onboarding-complete-response',
  });
});

router.delete('/status/:wallet', (req: Request, res: Response) => {
  const { wallet } = req.params;
  
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(400).json({
      ok: false,
      error: 'Valid wallet address required',
      'data-testid': 'onboarding-reset-error',
    });
    return;
  }
  
  const normalizedWallet = wallet.toLowerCase();
  statusStore.delete(normalizedWallet);
  
  res.json({
    ok: true,
    message: 'Onboarding status reset',
    'data-testid': 'onboarding-reset-response',
  });
});

export default router;
