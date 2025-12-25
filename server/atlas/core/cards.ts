import { randomBytes } from 'crypto';

export type CardKind = 'data' | 'reasoning' | 'pipeline' | 'error';

export type CardSource = {
  type: 'app' | 'llm' | 'atlas' | 'meta-adapter';
  ref: string;
  model?: string;
};

export interface CanvasCard {
  id: string;
  kind: CardKind;
  title: string;
  source: CardSource;
  payload: any;
  createdAt: string;
  wallet?: string;
  sessionId?: string;
  meta?: Record<string, any>;
}

export interface MaterializeOptions {
  wallet?: string;
  sessionId?: string;
  emitReceipt?: boolean;
}

export type ReceiptEmitter = (receipt: {
  type: 'atlas_llm' | 'atlas_app' | 'atlas_materialize';
  wallet: string;
  ref: string;
  meta?: Record<string, any>;
}) => void;

export class Materializer {
  private cards: CanvasCard[] = [];
  private receiptEmitter?: ReceiptEmitter;
  private defaultWallet?: string;
  private sessionId?: string;

  constructor(options?: { receiptEmitter?: ReceiptEmitter; wallet?: string; sessionId?: string }) {
    this.receiptEmitter = options?.receiptEmitter;
    this.defaultWallet = options?.wallet;
    this.sessionId = options?.sessionId;
  }

  emit(card: Omit<CanvasCard, 'id' | 'createdAt'>, options?: MaterializeOptions): CanvasCard {
    const id = `card_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const wallet = options?.wallet || this.defaultWallet;
    
    const c: CanvasCard = {
      ...card,
      id,
      createdAt: new Date().toISOString(),
      wallet,
      sessionId: options?.sessionId || this.sessionId,
    };
    
    this.cards.push(c);

    if (this.receiptEmitter && wallet && options?.emitReceipt !== false) {
      this.receiptEmitter({
        type: 'atlas_materialize',
        wallet,
        ref: `${c.kind}:${c.source.ref}`,
        meta: {
          cardId: c.id,
          title: c.title,
          sourceType: c.source.type,
        },
      });
    }

    return c;
  }

  emitData(
    title: string,
    source: CardSource,
    payload: any,
    options?: MaterializeOptions
  ): CanvasCard {
    return this.emit({ kind: 'data', title, source, payload }, options);
  }

  emitReasoning(
    title: string,
    source: CardSource,
    text: string,
    meta?: { tokens?: number; model?: string },
    options?: MaterializeOptions
  ): CanvasCard {
    return this.emit({
      kind: 'reasoning',
      title,
      source,
      payload: { text, ...meta },
      meta,
    }, options);
  }

  emitPipeline(
    title: string,
    steps: Array<{ provider: string; action: string; duration?: number }>,
    options?: MaterializeOptions
  ): CanvasCard {
    return this.emit({
      kind: 'pipeline',
      title,
      source: { type: 'atlas', ref: 'pipeline' },
      payload: { steps },
    }, options);
  }

  emitError(
    title: string,
    error: string,
    source: CardSource,
    options?: MaterializeOptions
  ): CanvasCard {
    return this.emit({
      kind: 'error',
      title,
      source,
      payload: { error },
    }, options);
  }

  getCards(): CanvasCard[] {
    return [...this.cards];
  }

  clear(): void {
    this.cards = [];
  }

  toJSON(): CanvasCard[] {
    return this.getCards();
  }
}

export function createMaterializer(options?: { 
  receiptEmitter?: ReceiptEmitter; 
  wallet?: string; 
  sessionId?: string 
}): Materializer {
  return new Materializer(options);
}
