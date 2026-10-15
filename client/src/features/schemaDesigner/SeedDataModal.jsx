import { useState, useMemo } from 'react';
import { Copy, Check, Download, Table2, Sparkles } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useSchemaStore } from '@/store/schemaStore';
import { toast } from '@/components/ui/Toast';
import styles from './SeedDataModal.module.scss';

export function SeedDataModal() {
  const { isSeedModalOpen, setSeedModalOpen, getMockSeedData, ir } = useSchemaStore();
  const [rowCount, setRowCount] = useState(3);
  const [copied, setCopied] = useState(false);

  const mockData = useMemo(() => {
    if (!isSeedModalOpen) return {};
    return getMockSeedData(rowCount);
  }, [isSeedModalOpen, rowCount, getMockSeedData]);

  if (!isSeedModalOpen) return null;

  const jsonString = JSON.stringify(mockData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('Copied mock seed data to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seed_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded seed data JSON');
  };

  return (
    <Modal
      isOpen={isSeedModalOpen}
      onClose={() => setSeedModalOpen(false)}
      title="Relational Seed Data Generator"
      size="lg"
    >
      <div className={styles.modalContent}>
        <div className={styles.topBar}>
          <div className={styles.infoText}>
            <Sparkles size={16} className="text-accent" />
            <span>
              Topologically sorted by Foreign Key dependencies using Kahn&apos;s algorithm.
            </span>
          </div>

          <div className={styles.controls}>
            <label htmlFor="rowCountSelect">Rows per table:</label>
            <select
              id="rowCountSelect"
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              className={styles.select}
            >
              <option value={2}>2 rows</option>
              <option value={3}>3 rows</option>
              <option value={5}>5 rows</option>
              <option value={10}>10 rows</option>
            </select>
          </div>
        </div>

        <div className={styles.previewContainer}>
          <pre className={styles.codeBlock}>{jsonString}</pre>
        </div>

        <div className={styles.footerActions}>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download size={14} />}
            onClick={handleDownload}
          >
            Download JSON
          </Button>
        </div>
      </div>
    </Modal>
  );
}
