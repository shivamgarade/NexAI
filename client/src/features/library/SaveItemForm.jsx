import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Globe, FileText, Sparkles, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { TagInput } from '@/components/ui/TagInput';
import { NoteEditor } from './NoteEditor';
import { SnippetEditor } from './SnippetEditor';
import { cn } from '@/lib/utils/cn';
import styles from './SaveItemForm.module.scss';

function parseSnippetContent(content, fallbackLang = 'plaintext') {
  if (!content) return { lang: fallbackLang, code: '' };
  const match = content.trim().match(/^```([a-zA-Z0-9_#-]*)\s*\n([\s\S]*?)\n?```$/);
  if (match) {
    return {
      lang: match[1] || fallbackLang,
      code: match[2],
    };
  }
  return {
    lang: fallbackLang,
    code: content,
  };
}

export function SaveItemForm({
  onSuggest,
  onDirectSave,
  isSuggesting,
  isSaving,
  error,
  prefill = null,
}) {
  const isSnippet = Boolean(
    prefill?.isSnippet ||
      prefill?.tags?.includes('snippet') ||
      (prefill?.type === 'note' && prefill?.content?.startsWith('```')),
  );

  const initialSnippet = parseSnippetContent(
    prefill?.content || '',
    prefill?.language || 'plaintext',
  );

  const [type, setType] = useState(prefill?.type || 'link');
  const [url, setUrl] = useState(prefill?.url || '');
  const [noteContent, setNoteContent] = useState(prefill?.content || '');
  const [snippetCode, setSnippetCode] = useState(initialSnippet.code);
  const [snippetLang, setSnippetLang] = useState(initialSnippet.lang);
  const [noteTitleHint, setNoteTitleHint] = useState(prefill?.title || '');
  const [tags, setTags] = useState(() => prefill?.tags || (isSnippet ? ['snippet'] : []));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (prefill) {
      if (prefill.type) setType(prefill.type);
      if (prefill.url) setUrl(prefill.url);
      if (prefill.content) {
        setNoteContent(prefill.content);
        const parsed = parseSnippetContent(prefill.content, prefill.language || 'plaintext');
        setSnippetCode(parsed.code);
        setSnippetLang(parsed.lang);
      }
      if (prefill.title) setNoteTitleHint(prefill.title);
      if (prefill.tags) setTags(prefill.tags);
    }
  }, [prefill]);

  const getCompiledContent = () => {
    if (isSnippet) {
      const trimmed = snippetCode.trim();
      return `\`\`\`${snippetLang || 'plaintext'}\n${trimmed}\n\`\`\``;
    }
    return noteContent.trim();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (type === 'link') {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setValidationError('Please enter a website URL');
        return;
      }
      try {
        const parsed = new URL(trimmedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setValidationError('URL must start with http:// or https://');
          return;
        }
      } catch {
        setValidationError('Please enter a valid web URL');
        return;
      }

      onSuggest({ type: 'link', url: trimmedUrl });
    } else {
      const activeText = isSnippet ? snippetCode.trim() : noteContent.trim();
      if (!activeText) {
        setValidationError(isSnippet ? 'Please enter snippet code' : 'Please enter note content');
        return;
      }
      if (activeText.length < 5) {
        setValidationError(
          isSnippet
            ? 'Snippet code should be at least 5 characters'
            : 'Note content should be at least 5 characters',
        );
        return;
      }

      onSuggest({
        type: 'note',
        content: getCompiledContent(),
        suggestedTitle: noteTitleHint.trim(),
        tags: tags || [],
      });
    }
  };

  const handleDirectSaveNote = (e) => {
    e.preventDefault();
    setValidationError('');

    const activeText = isSnippet ? snippetCode.trim() : noteContent.trim();
    if (!activeText) {
      setValidationError(isSnippet ? 'Please enter snippet code' : 'Please enter note content');
      return;
    }

    // Auto title if not specified
    const title =
      noteTitleHint.trim() ||
      activeText.split('\n')[0].replace(/^#+\s*/, '').replace(/^[/*#-]+\s*/, '').slice(0, 50) ||
      (isSnippet ? 'Untitled Snippet' : 'Untitled Note');

    onDirectSave?.({
      type: 'note',
      title,
      content: getCompiledContent(),
      summary: activeText.slice(0, 150) + (activeText.length > 150 ? '...' : ''),
      tags: tags || [],
    });
  };

  if (isSuggesting) {
    return (
      <div className={styles.loadingBox}>
        <Spinner size="lg" />
        <div className={styles.loadingText}>
          {type === 'link'
            ? 'Fetching webpage and analyzing content...'
            : isSnippet
              ? 'Analyzing code snippet with Gemini...'
              : 'Analyzing notes with Gemini...'}
        </div>
        <div className={styles.loadingSubtext}>
          Generating descriptive title, concise summary, and smart tags.
        </div>
      </div>
    );
  }

  // Hide the Web Link / Note toggle when prefill is provided or when saving a snippet
  const showTypeSelector = !prefill && !isSnippet;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {showTypeSelector && (
        <div className={styles.typeSelector} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={type === 'link'}
            className={cn(styles.typeBtn, type === 'link' && styles.active)}
            onClick={() => {
              setType('link');
              setValidationError('');
            }}
          >
            <Globe size={16} />
            Web Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={type === 'note'}
            className={cn(styles.typeBtn, type === 'note' && styles.active)}
            onClick={() => {
              setType('note');
              setValidationError('');
            }}
          >
            <FileText size={16} />
            Note / Text
          </button>
        </div>
      )}

      {(validationError || error) && (
        <div className={styles.errorBanner}>{validationError || error}</div>
      )}

      {type === 'link' ? (
        <div className={styles.inputGroup}>
          <Input
            label="Page URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            leftIcon={<Globe size={16} />}
            autoFocus
          />
          <div className={styles.hint}>
            NexAI will fetch the article content and auto-generate title, summary, and tags.
          </div>
          <Button type="submit" variant="primary" fullWidth leftIcon={<Sparkles size={16} />}>
            Suggest Title & Tags
          </Button>
        </div>
      ) : (
        <div className={styles.inputGroup}>
          <Input
            label={isSnippet ? 'Snippet Title' : 'Note Title (Optional)'}
            type="text"
            value={noteTitleHint}
            onChange={(e) => setNoteTitleHint(e.target.value)}
            placeholder={
              isSnippet
                ? 'e.g. Express REST Endpoint, Auth Hook...'
                : 'e.g. Architecture decisions, API cheatsheet...'
            }
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className={styles.label}>{isSnippet ? 'Snippet Code' : 'Note Content'}</span>
            {isSnippet ? (
              <SnippetEditor
                value={snippetCode}
                onChange={setSnippetCode}
                language={snippetLang}
                minHeight={220}
              />
            ) : (
              <NoteEditor
                value={noteContent}
                onChange={setNoteContent}
                placeholder="Write your note with rich markdown formatting, code snippets, lists, and quotes..."
                minHeight={200}
                autoFocus
              />
            )}
          </div>

          <div className={styles.tagGroup}>
            <span className={styles.label}>Tags</span>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder={isSnippet ? 'Add tags (e.g. api, express, backend)...' : 'Add tags...'}
            />
          </div>

          <div className={styles.buttonRow}>
            <Button
              type="button"
              variant="primary"
              onClick={handleDirectSaveNote}
              loading={isSaving}
              leftIcon={<Check size={16} />}
              className={styles.saveBtn}
            >
              {isSnippet ? 'Save Snippet' : 'Save Directly'}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              leftIcon={<Sparkles size={16} className={styles.sparkleIcon} />}
              className={styles.suggestBtn}
            >
              AI Suggest & Tags
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

SaveItemForm.propTypes = {
  onSuggest: PropTypes.func.isRequired,
  onDirectSave: PropTypes.func,
  isSuggesting: PropTypes.bool,
  isSaving: PropTypes.bool,
  error: PropTypes.string,
  prefill: PropTypes.shape({
    type: PropTypes.string,
    url: PropTypes.string,
    content: PropTypes.string,
    title: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    isSnippet: PropTypes.bool,
    language: PropTypes.string,
  }),
};

