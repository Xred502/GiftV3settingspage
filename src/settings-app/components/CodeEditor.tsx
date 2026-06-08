import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: 'html' | 'css';
  minHeight?: string;
}

const baseTheme = EditorView.theme({
  '&': { borderRadius: '0.375rem', fontSize: '13px', width: '100%' },
  '.cm-scroller': { fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace', overflowX: 'auto' },
});

export default function CodeEditor({ value, onChange, language, minHeight = '260px' }: Props) {
  return (
    <CodeMirror
      value={value}
      extensions={[language === 'html' ? html() : css(), baseTheme]}
      theme={vscodeDark}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
      }}
      style={{ minHeight, borderRadius: '0.375rem', width: '100%' }}
    />
  );
}
