import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface GeneratePDFRequest {
  type: 'generateReceiptPDF';
  data: {
    receipts: Array<{
      id: string;
      type: string;
      timestamp: string;
      sender: string;
      recipient: string;
      amount?: string;
      description?: string;
    }>;
    title?: string;
    metadata?: Record<string, string>;
  };
}

export interface GenerateLedgerPDFRequest {
  type: 'generateLedgerPDF';
  data: {
    transactions: Array<{
      hash: string;
      timestamp: string;
      type: string;
      amount: string;
      status: string;
    }>;
    title?: string;
  };
}

export type PDFWorkerRequest = GeneratePDFRequest | GenerateLedgerPDFRequest;

self.onmessage = async (event: MessageEvent<PDFWorkerRequest>) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'generateReceiptPDF': {
        const doc = new jsPDF();
        const title = data.title || 'Receipt Export';
        
        doc.setFontSize(18);
        doc.text(title, 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        if (data.metadata) {
          let yPos = 35;
          Object.entries(data.metadata).forEach(([key, value]) => {
            doc.text(`${key}: ${value}`, 14, yPos);
            yPos += 6;
          });
        }

        const tableData = data.receipts.map(receipt => [
          receipt.id.substring(0, 8),
          receipt.type,
          new Date(receipt.timestamp).toLocaleString(),
          receipt.sender.substring(0, 10) + '...',
          receipt.recipient.substring(0, 10) + '...',
          receipt.amount || 'N/A',
          receipt.description || '',
        ]);

        autoTable(doc, {
          head: [['ID', 'Type', 'Timestamp', 'Sender', 'Recipient', 'Amount', 'Description']],
          body: tableData,
          startY: data.metadata ? 50 : 35,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [147, 51, 234] },
        });

        const pdfBlob = doc.output('blob');
        const arrayBuffer = await pdfBlob.arrayBuffer();

        self.postMessage({
          success: true,
          result: {
            pdf: arrayBuffer,
            filename: `receipts_${Date.now()}.pdf`,
          },
        });
        break;
      }

      case 'generateLedgerPDF': {
        const doc = new jsPDF();
        const title = data.title || 'Ledger Export';
        
        doc.setFontSize(18);
        doc.text(title, 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const tableData = data.transactions.map(tx => [
          tx.hash.substring(0, 12) + '...',
          new Date(tx.timestamp).toLocaleString(),
          tx.type,
          tx.amount,
          tx.status,
        ]);

        autoTable(doc, {
          head: [['Transaction Hash', 'Timestamp', 'Type', 'Amount', 'Status']],
          body: tableData,
          startY: 35,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [147, 51, 234] },
        });

        const pdfBlob = doc.output('blob');
        const arrayBuffer = await pdfBlob.arrayBuffer();

        self.postMessage({
          success: true,
          result: {
            pdf: arrayBuffer,
            filename: `ledger_${Date.now()}.pdf`,
          },
        });
        break;
      }

      default:
        throw new Error(`Unknown operation: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
