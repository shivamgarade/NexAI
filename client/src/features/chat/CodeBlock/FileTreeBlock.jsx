import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Folder,
  FileCode,
  FileText,
  File,
  Copy,
  Check,
  FolderTree,
} from 'lucide-react';
import { toast } from '@/store/uiStore';
import styles from './FileTreeBlock.module.scss';

function getFileIcon(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('/') || !lower.includes('.')) {
    return <Folder size={14} className={styles.folderIcon} />;
  }
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.go') ||
    lower.endsWith('.rs') ||
    lower.endsWith('.java') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css') ||
    lower.endsWith('.scss')
  ) {
    return <FileCode size={14} className={styles.codeFileIcon} />;
  }
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.md') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.env')
  ) {
    return <FileText size={14} className={styles.docFileIcon} />;
  }
  return <File size={14} className={styles.genericFileIcon} />;
}

export function FileTreeBlock({ value = '' }) {
  const [copied, setCopied] = useState(false);

  const parsedLines = useMemo(() => {
    const rawLines = value.trim().split('\n');
    return rawLines.map((line, index) => {
      // Check for inline comments (# comment or // comment)
      const commentMatch = line.match(/^([\s\S]*?)(#|\/\/)(.*)$/);
      let contentPart = line;
      let commentPart = '';

      if (commentMatch) {
        contentPart = commentMatch[1];
        commentPart = `${commentMatch[2]}${commentMatch[3]}`.trim();
      }

      // Detect prefix tree branches like ├── └── │
      const treeBranchMatch = contentPart.match(/^([\s│├─└─|`+-]+)(.*)$/);
      let prefix = '';
      let itemName = contentPart.trim();

      if (treeBranchMatch && treeBranchMatch[1] && treeBranchMatch[2]) {
        prefix = treeBranchMatch[1];
        itemName = treeBranchMatch[2].trim();
      }

      const isFolder = itemName.endsWith('/') || !itemName.includes('.');

      return {
        id: index,
        raw: line,
        prefix,
        name: itemName,
        comment: commentPart,
        isFolder,
      };
    });
  }, [value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Directory tree copied to clipboard');
    } catch {
      toast.error('Failed to copy directory tree');
    }
  };

  return (
    <div className={styles.treeContainer}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <FolderTree size={15} className={styles.headerIcon} />
          <span className={styles.titleText}>Project Structure</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={styles.copyButton}
          aria-label="Copy directory structure"
        >
          {copied ? (
            <>
              <Check size={13} className={styles.checkIcon} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className={styles.treeBody}>
        {parsedLines.map((item) => (
          <div key={item.id} className={styles.treeRow}>
            <span className={styles.branchPrefix}>{item.prefix}</span>
            <span className={styles.itemIcon}>{getFileIcon(item.name)}</span>
            <span
              className={item.isFolder ? styles.folderName : styles.fileName}
            >
              {item.name}
            </span>
            {item.comment && (
              <span className={styles.commentTag}>
                {item.comment}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

FileTreeBlock.propTypes = {
  value: PropTypes.string.isRequired,
};
