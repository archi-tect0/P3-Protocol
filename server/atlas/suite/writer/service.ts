import { db } from '../../../db';
import { 
  writerDocs, 
  writerBlocks, 
  atlasArtifacts, 
  atlasReceipts, 
  walletScopes,
  writerRevisions,
  type WriterDoc,
  type WriterBlock,
  type AtlasArtifact,
  type AtlasReceipt,
  type WalletScope as WalletScopeRecord
} from '@shared/schema';
import { eq, and, desc, asc, gt, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'crypto';

export interface WalletScope {
  walletAddress: string;
  sessionId: string;
  profileId?: string;
}

export interface BlockInit {
  blockType?: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'listOrdered' | 'listUnordered' | 'table' | 'image' | 'quote' | 'codeBlock' | 'embed';
  text?: string;
  marks?: string[];
  attrs?: Record<string, unknown>;
}

export interface CreateDocInit {
  title?: string;
  blocks?: BlockInit[];
}

export interface DocExport {
  format: 'md' | 'pdf' | 'docx';
  content: string;
  filename: string;
  mimeType: string;
}

function computeHash(content: string, prevHash?: string): string {
  return createHash('sha256').update((prevHash || '') + content).digest('hex');
}

function blockToMarkdown(block: WriterBlock): string {
  const text = block.text || '';
  const marks = block.marks || [];
  
  let formatted = text;
  if (marks.includes('bold')) formatted = `**${formatted}**`;
  if (marks.includes('italic')) formatted = `*${formatted}*`;
  if (marks.includes('code')) formatted = `\`${formatted}\``;
  if (marks.includes('strikethrough')) formatted = `~~${formatted}~~`;
  
  switch (block.blockType) {
    case 'heading1':
      return `# ${formatted}\n\n`;
    case 'heading2':
      return `## ${formatted}\n\n`;
    case 'heading3':
      return `### ${formatted}\n\n`;
    case 'listOrdered':
      return `1. ${formatted}\n`;
    case 'listUnordered':
      return `- ${formatted}\n`;
    case 'quote':
      return `> ${formatted}\n\n`;
    case 'codeBlock':
      return `\`\`\`\n${text}\n\`\`\`\n\n`;
    case 'paragraph':
    default:
      return `${formatted}\n\n`;
  }
}

export class WriterService {
  private async getOrCreateWalletScope(scope: WalletScope): Promise<WalletScopeRecord> {
    const existing = await db.select()
      .from(walletScopes)
      .where(and(
        eq(walletScopes.walletAddress, scope.walletAddress.toLowerCase()),
        eq(walletScopes.sessionId, scope.sessionId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db.insert(walletScopes).values({
      walletAddress: scope.walletAddress.toLowerCase(),
      sessionId: scope.sessionId,
      profileId: scope.profileId || null
    }).returning();
    
    return created;
  }

  private async getLatestReceiptHash(artifactId: string): Promise<string | undefined> {
    const latest = await db.select()
      .from(atlasReceipts)
      .where(eq(atlasReceipts.artifactId, artifactId))
      .orderBy(desc(atlasReceipts.createdAt))
      .limit(1);
    
    return latest.length > 0 ? latest[0].nextHash : undefined;
  }

  private async createReceipt(
    artifactId: string, 
    scopeId: string, 
    op: 'insertText' | 'deleteText' | 'applyStyle' | 'setCell' | 'createChart' | 'defineRange' | 'createDoc' | 'createSheet' | 'exportDoc' | 'exportSheet',
    meta?: Record<string, unknown>
  ): Promise<AtlasReceipt> {
    const prevHash = await this.getLatestReceiptHash(artifactId);
    const nextHash = computeHash(JSON.stringify({ op, meta, artifactId, timestamp: Date.now() }), prevHash);
    
    const [receipt] = await db.insert(atlasReceipts).values({
      artifactId,
      op,
      prevHash: prevHash || null,
      nextHash,
      actorScopeId: scopeId,
      meta: meta || null
    }).returning();
    
    return receipt;
  }

  async createDoc(scope: WalletScope, init?: CreateDocInit): Promise<{ doc: WriterDoc; artifact: AtlasArtifact; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const [artifact] = await db.insert(atlasArtifacts).values({
      type: 'writer.doc',
      ownerId: walletScopeRecord.id,
      title: init?.title || 'Untitled Document',
      visibility: 'private'
    }).returning();
    
    const [doc] = await db.insert(writerDocs).values({
      artifactId: artifact.id,
      version: 1,
      trackChangesEnabled: false,
      outline: null
    }).returning();
    
    if (init?.blocks && init.blocks.length > 0) {
      const blockValues = init.blocks.map((block, index) => ({
        docId: doc.id,
        position: index,
        blockType: block.blockType || 'paragraph' as const,
        text: block.text || '',
        marks: block.marks || [],
        attrs: block.attrs || null,
        contentHash: computeHash(block.text || '')
      }));
      
      await db.insert(writerBlocks).values(blockValues);
    } else {
      await db.insert(writerBlocks).values({
        docId: doc.id,
        position: 0,
        blockType: 'paragraph',
        text: '',
        marks: [],
        contentHash: computeHash('')
      });
    }
    
    const receipt = await this.createReceipt(artifact.id, walletScopeRecord.id, 'createDoc', {
      title: init?.title,
      blockCount: init?.blocks?.length || 1
    });
    
    return { doc, artifact, receipt };
  }

  async getDoc(docId: string): Promise<{ doc: WriterDoc; blocks: WriterBlock[] } | null> {
    const docs = await db.select()
      .from(writerDocs)
      .where(eq(writerDocs.id, docId))
      .limit(1);
    
    if (docs.length === 0) return null;
    
    const blocks = await db.select()
      .from(writerBlocks)
      .where(eq(writerBlocks.docId, docId))
      .orderBy(asc(writerBlocks.position));
    
    return { doc: docs[0], blocks };
  }

  async insertText(
    docId: string, 
    scope: WalletScope, 
    blockId: string, 
    offset: number, 
    text: string
  ): Promise<{ block: WriterBlock; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const blocks = await db.select()
      .from(writerBlocks)
      .where(eq(writerBlocks.id, blockId))
      .limit(1);
    
    if (blocks.length === 0) {
      throw new Error(`Block ${blockId} not found`);
    }
    
    const block = blocks[0];
    const currentText = block.text || '';
    const newText = currentText.slice(0, offset) + text + currentText.slice(offset);
    const newHash = computeHash(newText);
    
    const [updatedBlock] = await db.update(writerBlocks)
      .set({ 
        text: newText, 
        contentHash: newHash,
        updatedAt: new Date()
      })
      .where(eq(writerBlocks.id, blockId))
      .returning();
    
    const doc = await db.select()
      .from(writerDocs)
      .where(eq(writerDocs.id, docId))
      .limit(1);
    
    if (doc.length === 0) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    const receipt = await this.createReceipt(doc[0].artifactId, walletScopeRecord.id, 'insertText', {
      blockId,
      offset,
      insertedLength: text.length,
      newHash
    });
    
    if (doc[0].trackChangesEnabled) {
      await db.insert(writerRevisions).values({
        docId,
        actorScopeId: walletScopeRecord.id,
        op: 'insertText',
        rangeFrom: `${offset}`,
        rangeTo: `${offset + text.length}`,
        diffHash: computeHash(text, block.contentHash || undefined)
      });
    }
    
    return { block: updatedBlock, receipt };
  }

  async applyStyle(
    docId: string, 
    scope: WalletScope, 
    blockId: string, 
    marks: string[]
  ): Promise<{ block: WriterBlock; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const blocks = await db.select()
      .from(writerBlocks)
      .where(eq(writerBlocks.id, blockId))
      .limit(1);
    
    if (blocks.length === 0) {
      throw new Error(`Block ${blockId} not found`);
    }
    
    const validMarks = marks.filter(m => 
      ['bold', 'italic', 'underline', 'code', 'link', 'strikethrough'].includes(m)
    );
    
    const [updatedBlock] = await db.update(writerBlocks)
      .set({ 
        marks: validMarks,
        updatedAt: new Date()
      })
      .where(eq(writerBlocks.id, blockId))
      .returning();
    
    const doc = await db.select()
      .from(writerDocs)
      .where(eq(writerDocs.id, docId))
      .limit(1);
    
    if (doc.length === 0) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    const receipt = await this.createReceipt(doc[0].artifactId, walletScopeRecord.id, 'applyStyle', {
      blockId,
      marks: validMarks
    });
    
    return { block: updatedBlock, receipt };
  }

  async insertBlock(
    docId: string, 
    scope: WalletScope, 
    block: BlockInit, 
    position?: { afterId?: string }
  ): Promise<{ block: WriterBlock; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const doc = await db.select()
      .from(writerDocs)
      .where(eq(writerDocs.id, docId))
      .limit(1);
    
    if (doc.length === 0) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    let newPosition = 0;
    
    if (position?.afterId) {
      const afterBlocks = await db.select()
        .from(writerBlocks)
        .where(eq(writerBlocks.id, position.afterId))
        .limit(1);
      
      if (afterBlocks.length > 0) {
        newPosition = afterBlocks[0].position + 1;
        
        await db.update(writerBlocks)
          .set({ position: sql`${writerBlocks.position} + 1` })
          .where(and(
            eq(writerBlocks.docId, docId),
            gt(writerBlocks.position, afterBlocks[0].position)
          ));
      }
    } else {
      const maxPosResult = await db.select({ maxPos: sql<number>`COALESCE(MAX(${writerBlocks.position}), -1)` })
        .from(writerBlocks)
        .where(eq(writerBlocks.docId, docId));
      
      newPosition = (maxPosResult[0]?.maxPos ?? -1) + 1;
    }
    
    const contentHash = computeHash(block.text || '');
    
    const [newBlock] = await db.insert(writerBlocks).values({
      docId,
      position: newPosition,
      blockType: block.blockType || 'paragraph',
      text: block.text || '',
      marks: block.marks || [],
      attrs: block.attrs || null,
      contentHash
    }).returning();
    
    const receipt = await this.createReceipt(doc[0].artifactId, walletScopeRecord.id, 'insertText', {
      blockId: newBlock.id,
      blockType: block.blockType,
      position: newPosition
    });
    
    return { block: newBlock, receipt };
  }

  async deleteBlock(
    docId: string, 
    scope: WalletScope, 
    blockId: string
  ): Promise<{ receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const doc = await db.select()
      .from(writerDocs)
      .where(eq(writerDocs.id, docId))
      .limit(1);
    
    if (doc.length === 0) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    const blocks = await db.select()
      .from(writerBlocks)
      .where(eq(writerBlocks.id, blockId))
      .limit(1);
    
    if (blocks.length === 0) {
      throw new Error(`Block ${blockId} not found`);
    }
    
    const deletedBlock = blocks[0];
    
    await db.delete(writerBlocks)
      .where(eq(writerBlocks.id, blockId));
    
    await db.update(writerBlocks)
      .set({ position: sql`${writerBlocks.position} - 1` })
      .where(and(
        eq(writerBlocks.docId, docId),
        gt(writerBlocks.position, deletedBlock.position)
      ));
    
    const receipt = await this.createReceipt(doc[0].artifactId, walletScopeRecord.id, 'deleteText', {
      blockId,
      blockType: deletedBlock.blockType,
      deletedPosition: deletedBlock.position
    });
    
    if (doc[0].trackChangesEnabled) {
      await db.insert(writerRevisions).values({
        docId,
        actorScopeId: walletScopeRecord.id,
        op: 'deleteBlock',
        rangeFrom: `${deletedBlock.position}`,
        rangeTo: `${deletedBlock.position}`,
        diffHash: computeHash(deletedBlock.text || '', deletedBlock.contentHash || undefined)
      });
    }
    
    return { receipt };
  }

  async enableTrackChanges(
    docId: string, 
    scope: WalletScope, 
    enabled: boolean
  ): Promise<{ doc: WriterDoc }> {
    await this.getOrCreateWalletScope(scope);
    
    const [updatedDoc] = await db.update(writerDocs)
      .set({ 
        trackChangesEnabled: enabled,
        updatedAt: new Date()
      })
      .where(eq(writerDocs.id, docId))
      .returning();
    
    if (!updatedDoc) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    return { doc: updatedDoc };
  }

  async exportDoc(
    docId: string, 
    scope: WalletScope, 
    format: 'md' | 'pdf' | 'docx'
  ): Promise<DocExport> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const docResult = await this.getDoc(docId);
    if (!docResult) {
      throw new Error(`Doc ${docId} not found`);
    }
    
    const { doc, blocks } = docResult;
    
    const artifactResult = await db.select()
      .from(atlasArtifacts)
      .where(eq(atlasArtifacts.id, doc.artifactId))
      .limit(1);
    
    const title = artifactResult[0]?.title || 'Untitled Document';
    
    let content: string;
    let mimeType: string;
    let filename: string;
    
    switch (format) {
      case 'md':
        content = blocks.map(blockToMarkdown).join('');
        mimeType = 'text/markdown';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
        break;
        
      case 'pdf':
        content = blocks.map(blockToMarkdown).join('');
        mimeType = 'application/pdf';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        break;
        
      case 'docx':
        content = blocks.map(blockToMarkdown).join('');
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    await this.createReceipt(doc.artifactId, walletScopeRecord.id, 'exportDoc', {
      format,
      blockCount: blocks.length,
      filename
    });
    
    return { format, content, filename, mimeType };
  }

  async listDocs(scope: WalletScope): Promise<Array<{ doc: WriterDoc; artifact: AtlasArtifact }>> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const artifacts = await db.select()
      .from(atlasArtifacts)
      .where(and(
        eq(atlasArtifacts.ownerId, walletScopeRecord.id),
        eq(atlasArtifacts.type, 'writer.doc')
      ))
      .orderBy(desc(atlasArtifacts.updatedAt));
    
    const results: Array<{ doc: WriterDoc; artifact: AtlasArtifact }> = [];
    
    for (const artifact of artifacts) {
      const docs = await db.select()
        .from(writerDocs)
        .where(eq(writerDocs.artifactId, artifact.id))
        .limit(1);
      
      if (docs.length > 0) {
        results.push({ doc: docs[0], artifact });
      }
    }
    
    return results;
  }

  async getRevisions(docId: string): Promise<Array<{ 
    id: string; 
    op: string; 
    rangeFrom: string; 
    rangeTo: string; 
    createdAt: Date 
  }>> {
    const revisions = await db.select()
      .from(writerRevisions)
      .where(eq(writerRevisions.docId, docId))
      .orderBy(desc(writerRevisions.createdAt));
    
    return revisions.map(r => ({
      id: r.id,
      op: r.op,
      rangeFrom: r.rangeFrom,
      rangeTo: r.rangeTo,
      createdAt: r.createdAt
    }));
  }
}

export const writerService = new WriterService();
