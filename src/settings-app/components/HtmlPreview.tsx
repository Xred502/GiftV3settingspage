import { useMemo } from 'react';

interface Props {
  bannerHtml: string;
  footerHtml: string;
  customStyle: string;
  formBackgroundColor?: string;
}

export default function HtmlPreview({ bannerHtml, footerHtml, customStyle, formBackgroundColor }: Props) {
  const srcDoc = useMemo(() => `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: sans-serif;
    background: ${formBackgroundColor || '#ffffff'};
    min-height: 100vh;
  }
  .preview-body {
    padding: 24px;
    color: #333;
  }
  .preview-placeholder {
    background: rgba(0,0,0,0.06);
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 14px;
    margin: 24px 0;
  }
  ${customStyle}
</style>
</head>
<body>
  ${bannerHtml}
  <div class="preview-body">
    <div class="preview-placeholder">
      ← Presentkortsformuläret visas här →
    </div>
  </div>
  ${footerHtml}
</body>
</html>`, [bannerHtml, footerHtml, customStyle, formBackgroundColor]);

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      title="Förhandsvisning"
      className="w-full rounded-md border border-slate-700 bg-white"
      style={{ height: '480px' }}
    />
  );
}
