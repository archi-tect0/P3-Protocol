import { createHash, createGzip } from 'crypto';
import { Readable } from 'stream';
import type { IStorage } from '../storage';
import type { AuditLog } from '@shared/schema';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export format
 */
export type ExportFormat = 'pdf' | 'csv';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  compress?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  format: ExportFormat;
  data: Buffer;
  filename: string;
  hash: string;
  compressed: boolean;
  generatedAt: number;
  generatedBy: string;
}

/**
 * ExportService - Generate privacy-preserving audit exports
 * 
 * Features:
 * - PDF export with jsPDF and formatted tables
 * - CSV export for bulk data analysis
 * - Watermarking with timestamp and user
 * - Hash-based references (no PII in exports)
 * - Compression for large exports
 * - Role-based export permissions (enforced at route level)
 */
export class ExportService {
  constructor(private storage: IStorage) {}

  /**
   * Generate audit export in specified format
   * 
   * @param options - Export options
   * @param userId - User ID generating the export
   * @returns Promise<ExportResult> - Export result with data and metadata
   */
  async generateExport(options: ExportOptions, userId: string): Promise<ExportResult> {
    // Fetch audit logs based on filters
    const auditLogs = await this.fetchAuditLogs(options);

    let data: Buffer;
    let filename: string;

    if (options.format === 'pdf') {
      data = await this.generatePDF(auditLogs, userId);
      filename = `audit-export-${Date.now()}.pdf`;
    } else {
      data = await this.generateCSV(auditLogs, userId);
      filename = `audit-export-${Date.now()}.csv`;
    }

    // Compress if requested or if data is large (> 1MB)
    let compressed = false;
    if (options.compress || data.length > 1024 * 1024) {
      data = await this.compressData(data);
      filename += '.gz';
      compressed = true;
    }

    // Generate hash of exported data
    const hash = createHash('sha256').update(data).digest('hex');

    return {
      format: options.format,
      data,
      filename,
      hash,
      compressed,
      generatedAt: Date.now(),
      generatedBy: userId,
    };
  }

  /**
   * Fetch audit logs based on export options
   * 
   * @param options - Export options with filters
   * @returns Promise<AuditLog[]> - Filtered audit logs
   */
  private async fetchAuditLogs(options: ExportOptions): Promise<AuditLog[]> {
    const filters: { entityType?: string; entityId?: string } = {};

    if (options.entityType) {
      filters.entityType = options.entityType;
    }

    if (options.entityId) {
      filters.entityId = options.entityId;
    }

    let logs = await this.storage.getAuditLog(filters);

    // Apply date filters
    if (options.startDate) {
      logs = logs.filter(log => log.createdAt >= options.startDate!);
    }

    if (options.endDate) {
      logs = logs.filter(log => log.createdAt <= options.endDate!);
    }

    return logs;
  }

  /**
   * Generate PDF export with formatted tables and watermark
   * 
   * @param logs - Audit logs to export
   * @param userId - User ID for watermark
   * @returns Promise<Buffer> - PDF data as buffer
   */
  private async generatePDF(logs: AuditLog[], userId: string): Promise<Buffer> {
    const doc = new jsPDF();

    // Add watermark header
    const timestamp = new Date().toISOString();
    const userHash = createHash('sha256').update(userId).digest('hex').substring(0, 8);

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`P3 Protocol Audit Export`, 14, 15);
    doc.text(`Generated: ${timestamp}`, 14, 20);
    doc.text(`User: ${userHash}`, 14, 25);
    doc.text(`Total Records: ${logs.length}`, 14, 30);

    // Add separator line
    doc.setDrawColor(200);
    doc.line(14, 35, 196, 35);

    // Prepare table data - hash-based references only (no PII)
    const tableData = logs.map(log => {
      // Hash sensitive fields
      const entityIdHash = createHash('sha256').update(log.entityId).digest('hex').substring(0, 12);
      const actorHash = createHash('sha256').update(log.actor).digest('hex').substring(0, 12);

      return [
        log.entityType,
        entityIdHash,
        log.action,
        actorHash,
        new Date(log.createdAt).toISOString(),
        log.meta ? 'Yes' : 'No',
      ];
    });

    // Add table
    autoTable(doc, {
      head: [['Entity Type', 'Entity ID (Hash)', 'Action', 'Actor (Hash)', 'Timestamp', 'Has Meta']],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 40 },
    });

    // Add footer watermark
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} | Export Hash: ${createHash('sha256').update(timestamp).digest('hex').substring(0, 16)}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return pdfBuffer;
  }

  /**
   * Generate CSV export with hash-based references
   * 
   * @param logs - Audit logs to export
   * @param userId - User ID for metadata
   * @returns Promise<Buffer> - CSV data as buffer
   */
  private async generateCSV(logs: AuditLog[], userId: string): Promise<Buffer> {
    const timestamp = new Date().toISOString();
    const userHash = createHash('sha256').update(userId).digest('hex').substring(0, 8);

    // CSV header with metadata
    const lines: string[] = [
      `# P3 Protocol Audit Export`,
      `# Generated: ${timestamp}`,
      `# User: ${userHash}`,
      `# Total Records: ${logs.length}`,
      '',
      // Column headers
      'Entity Type,Entity ID (Hash),Action,Actor (Hash),Timestamp,Has Meta,Meta Summary',
    ];

    // Add data rows - hash sensitive fields
    for (const log of logs) {
      const entityIdHash = createHash('sha256').update(log.entityId).digest('hex').substring(0, 12);
      const actorHash = createHash('sha256').update(log.actor).digest('hex').substring(0, 12);
      const hasMeta = log.meta ? 'Yes' : 'No';
      const metaSummary = log.meta 
        ? JSON.stringify(log.meta).substring(0, 100).replace(/,/g, ';') // Escape commas
        : '';

      lines.push(
        `${this.escapeCsv(log.entityType)},${entityIdHash},${this.escapeCsv(log.action)},${actorHash},${new Date(log.createdAt).toISOString()},${hasMeta},"${metaSummary}"`
      );
    }

    // Add footer
    lines.push('');
    lines.push(`# Export Hash: ${createHash('sha256').update(timestamp).digest('hex').substring(0, 16)}`);

    const csvContent = lines.join('\n');
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Escape CSV field
   * 
   * @param field - Field value to escape
   * @returns string - Escaped field value
   */
  private escapeCsv(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Compress data using gzip
   * 
   * @param data - Data to compress
   * @returns Promise<Buffer> - Compressed data
   */
  private async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gzip = createGzip();

      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      // Create readable stream from buffer
      const readable = Readable.from(data);
      readable.pipe(gzip);
    });
  }

  /**
   * Verify export hash
   * 
   * @param data - Export data
   * @param expectedHash - Expected hash
   * @returns boolean - True if hash matches
   */
  verifyExportHash(data: Buffer, expectedHash: string): boolean {
    const hash = createHash('sha256').update(data).digest('hex');
    return hash === expectedHash;
  }
}
