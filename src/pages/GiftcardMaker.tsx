import { useEffect, useRef, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { defaultGiftcardMakerPage } from '@/lib/giftcard-maker';
import { giftcardMakerService } from '@/services/giftcardMakerService';

const giftcardEditorStyleId = 'giftcard-editor-native-style';
const giftcardEditorScriptAttribute = 'data-giftcard-editor-native-script';
const giftcardMakerAssetRoot = import.meta.env.DEV
  ? 'http://localhost:3011/giftcard-maker-assets'
  : '/giftcard-maker-assets';
const defaultGiftcardLayoutUrl = `${giftcardMakerAssetRoot}/premade-templates/giftcard-layout-default.json`;
const templateApiUrl = '/api/giftcard-maker/giftcard/templates';

let giftcardEditorCssPromise: Promise<string> | null = null;

declare global {
  interface Window {
    giftcardEditorApi?: {
      applyLayoutState: (layout: unknown) => void;
      createLayoutState: () => unknown;
      downloadLayoutJson: () => void;
      applyTemplateRecord: (template: unknown) => boolean;
      hydrateGiftcardFieldsFromApi: (layout: unknown) => Promise<void>;
    };
  }
}

interface OperatorTemplateOption {
  templateId: string;
  operatorId: string;
  templateName: string;
}

type EditorSectionId = 'menu-background' | 'menu-content' | 'menu-bottom-box' | 'menu-typography' | 'menu-save-load';

interface EditorSectionDefinition {
  id: EditorSectionId;
  buttonLabel: string;
  title: string;
  description: string;
}

interface EditorFormState {
  title: string;
  message: string;
  info: string;
  backgroundColor: string;
  textColor: string;
  backgroundImageDataUrl: string;
  visibility: Record<string, boolean>;
  bottomGroupTextColor: string;
  bottomGroupBackdropColor: string;
  bottomGroupBackdropOpacity: string;
  bottomGroupBackdropShadowColor: string;
  bottomGroupBackdropShadowX: string;
  bottomGroupBackdropShadowY: string;
  bottomGroupBackdropShadowBlur: string;
  bottomGroupBackdropShadowOpacity: string;
  textTarget: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  textShadowColor: string;
  textShadowOffsetX: string;
  textShadowOffsetY: string;
  textShadowBlur: string;
}

interface PreviewElementLayout {
  top: string;
  left: string;
  width?: string;
  height?: string;
  display?: string;
}

interface EditorPreviewState {
  titlePreview: PreviewElementLayout;
  messagePreview: PreviewElementLayout;
  infoPreview: PreviewElementLayout;
  detailsPreviewGroup: PreviewElementLayout;
  bottomMovableGroup?: PreviewElementLayout;
  bottomBackdropPreview?: PreviewElementLayout;
}

const premadeTemplateDefinitions = [
  { id: 'giftcard-layout-7', label: 'Mall 1', url: `${giftcardMakerAssetRoot}/premade-templates/giftcard-layout-7.json` },
  { id: 'giftcard-layout-11', label: 'Mall 2', url: `${giftcardMakerAssetRoot}/premade-templates/giftcard-layout-11.json` },
  { id: 'giftcard-layout-3', label: 'Mall 3', url: `${giftcardMakerAssetRoot}/premade-templates/giftcard-layout-3.json` },
  { id: 'giftcard-layout-4', label: 'Mall 4', url: `${giftcardMakerAssetRoot}/premade-templates/giftcard-layout-4.json` },
] as const;

const editorSections: EditorSectionDefinition[] = [
  {
    id: 'menu-background',
    buttonLabel: 'Background',
    title: 'Background',
    description: 'Background image and base card colors.',
  },
  {
    id: 'menu-content',
    buttonLabel: 'Content',
    title: 'Content',
    description: 'Text content and visibility per field.',
  },
  {
    id: 'menu-bottom-box',
    buttonLabel: 'Card info',
    title: 'Card info',
    description: 'Card info box color, opacity and shadow.',
  },
  {
    id: 'menu-typography',
    buttonLabel: 'Typography',
    title: 'Typography',
    description: 'Fonts, size, weight and text shadow.',
  },
  {
    id: 'menu-save-load',
    buttonLabel: 'Save / Load',
    title: 'Save / Load',
    description: 'Export and import editor JSON layouts.',
  },
];

const defaultEditorFormState: EditorFormState = {
  title: 'Title',
  message: 'Message',
  info: 'Info',
  backgroundColor: '#2563eb',
  textColor: '#ffffff',
  backgroundImageDataUrl: '',
  visibility: {
    titlePreview: true,
    messagePreview: true,
    infoPreview: true,
    amountPreview: true,
    identifierPreview: true,
    shortpassPreview: true,
    validtoPreview: true,
    bottomBackdropPreview: true,
  },
  bottomGroupTextColor: '#ffffff',
  bottomGroupBackdropColor: '#000000',
  bottomGroupBackdropOpacity: '50',
  bottomGroupBackdropShadowColor: '#000000',
  bottomGroupBackdropShadowX: '0',
  bottomGroupBackdropShadowY: '10',
  bottomGroupBackdropShadowBlur: '18',
  bottomGroupBackdropShadowOpacity: '0',
  textTarget: 'titlePreview',
  fontFamily: 'inherit',
  fontSize: '48',
  fontWeight: '400',
  textShadowColor: '#000000',
  textShadowOffsetX: '0',
  textShadowOffsetY: '0',
  textShadowBlur: '0',
};

const defaultPreviewState: EditorPreviewState = {
  titlePreview: { top: '100px', left: '100px', display: '' },
  messagePreview: { top: '200px', left: '100px', display: '' },
  infoPreview: { top: '260px', left: '100px', display: '' },
  detailsPreviewGroup: { top: '78%', left: '8%', display: '' },
  bottomMovableGroup: undefined,
  bottomBackdropPreview: undefined,
};

function readInputValue(id: string, fallback = '') {
  const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return element?.value ?? fallback;
}

function readCheckboxValue(selector: string, fallback = true) {
  const element = document.querySelector(selector) as HTMLInputElement | null;
  return element?.checked ?? fallback;
}

function readGiftcardBackgroundImage() {
  const giftcard = document.getElementById('giftcard') as HTMLDivElement | null;
  const backgroundImage = giftcard?.style.backgroundImage || '';
  const match = backgroundImage.match(/^url\((['"]?)(.*)\1\)$/);
  return match?.[2] ?? '';
}

function readPreviewElementLayout(id: string, fallback: PreviewElementLayout): PreviewElementLayout {
  const element = document.getElementById(id) as HTMLElement | null;
  if (!element) return fallback;

  return {
    top: element.style.top || fallback.top,
    left: element.style.left || fallback.left,
    width: element.style.width || fallback.width,
    height: element.style.height || fallback.height,
    display: element.style.display || '',
  };
}

function extractEditorFormStateFromDom(): EditorFormState {
  return {
    title: readInputValue('titleInput', defaultEditorFormState.title),
    message: readInputValue('messageInput', defaultEditorFormState.message),
    info: readInputValue('infoInput', defaultEditorFormState.info),
    backgroundColor: readInputValue('bgColorInput', defaultEditorFormState.backgroundColor),
    textColor: readInputValue('textColorInput', defaultEditorFormState.textColor),
    backgroundImageDataUrl: readGiftcardBackgroundImage(),
    visibility: {
      titlePreview: readCheckboxValue('[data-text-visibility-target="titlePreview"]', true),
      messagePreview: readCheckboxValue('[data-text-visibility-target="messagePreview"]', true),
      infoPreview: readCheckboxValue('[data-text-visibility-target="infoPreview"]', true),
      amountPreview: readCheckboxValue('[data-text-visibility-target="amountPreview"]', true),
      identifierPreview: readCheckboxValue('[data-text-visibility-target="identifierPreview"]', true),
      shortpassPreview: readCheckboxValue('[data-text-visibility-target="shortpassPreview"]', true),
      validtoPreview: readCheckboxValue('[data-text-visibility-target="validtoPreview"]', true),
      bottomBackdropPreview: readCheckboxValue('[data-text-visibility-target="bottomBackdropPreview"]', true),
    },
    bottomGroupTextColor: readInputValue('bottomGroupTextColorInput', defaultEditorFormState.bottomGroupTextColor),
    bottomGroupBackdropColor: readInputValue('bottomGroupBackdropColorInput', defaultEditorFormState.bottomGroupBackdropColor),
    bottomGroupBackdropOpacity: readInputValue('bottomGroupBackdropOpacityInput', defaultEditorFormState.bottomGroupBackdropOpacity),
    bottomGroupBackdropShadowColor: readInputValue('bottomGroupBackdropShadowColorInput', defaultEditorFormState.bottomGroupBackdropShadowColor),
    bottomGroupBackdropShadowX: readInputValue('bottomGroupBackdropShadowXInput', defaultEditorFormState.bottomGroupBackdropShadowX),
    bottomGroupBackdropShadowY: readInputValue('bottomGroupBackdropShadowYInput', defaultEditorFormState.bottomGroupBackdropShadowY),
    bottomGroupBackdropShadowBlur: readInputValue('bottomGroupBackdropShadowBlurInput', defaultEditorFormState.bottomGroupBackdropShadowBlur),
    bottomGroupBackdropShadowOpacity: readInputValue('bottomGroupBackdropShadowOpacityInput', defaultEditorFormState.bottomGroupBackdropShadowOpacity),
    textTarget: readInputValue('textTargetInput', defaultEditorFormState.textTarget),
    fontFamily: readInputValue('fontFamilyInput', defaultEditorFormState.fontFamily),
    fontSize: readInputValue('fontSizeInput', defaultEditorFormState.fontSize),
    fontWeight: readInputValue('fontWeightInput', defaultEditorFormState.fontWeight),
    textShadowColor: readInputValue('textShadowColorInput', defaultEditorFormState.textShadowColor),
    textShadowOffsetX: readInputValue('textShadowOffsetXInput', defaultEditorFormState.textShadowOffsetX),
    textShadowOffsetY: readInputValue('textShadowOffsetYInput', defaultEditorFormState.textShadowOffsetY),
    textShadowBlur: readInputValue('textShadowBlurInput', defaultEditorFormState.textShadowBlur),
  };
}

function extractPreviewStateFromDom(): EditorPreviewState {
  return {
    titlePreview: readPreviewElementLayout('titlePreview', defaultPreviewState.titlePreview),
    messagePreview: readPreviewElementLayout('messagePreview', defaultPreviewState.messagePreview),
    infoPreview: readPreviewElementLayout('infoPreview', defaultPreviewState.infoPreview),
    detailsPreviewGroup: readPreviewElementLayout('detailsPreviewGroup', defaultPreviewState.detailsPreviewGroup),
    bottomMovableGroup: document.getElementById('bottomMovableGroup')
      ? readPreviewElementLayout('bottomMovableGroup', { top: '74%', left: '8%', width: '42%', height: '18%', display: '' })
      : undefined,
    bottomBackdropPreview: document.getElementById('bottomBackdropPreview')
      ? readPreviewElementLayout('bottomBackdropPreview', { top: '0%', left: '0%', width: '100%', height: '100%', display: '' })
      : undefined,
  };
}

function applyPreviewLayoutToElement(id: string, layout?: PreviewElementLayout) {
  if (!layout) return;
  const element = document.getElementById(id) as HTMLElement | null;
  if (!element) return;

  if (layout.top) element.style.top = layout.top;
  if (layout.left) element.style.left = layout.left;
  if (layout.width) element.style.width = layout.width;
  if (layout.height) element.style.height = layout.height;
  if (layout.display !== undefined) {
    element.style.display = layout.display;
  }
}

function scopeGiftcardEditorCss(css: string) {
  const scopedCss = css.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (_match, prefix, selectorGroup) => {
    const scopedSelectors = selectorGroup
      .split(',')
      .map((selector: string) => selector.trim())
      .filter(Boolean)
      .map((selector: string) => {
        let scopedSelector = selector
          .replace(/:root/g, '.giftcard-editor-root')
          .replace(/\bbody\b/g, '.giftcard-editor-root')
          .replace(/\bhtml\b/g, '.giftcard-editor-root');

        if (!scopedSelector.includes('.giftcard-editor-root')) {
          scopedSelector = `.giftcard-editor-root ${scopedSelector}`;
        }

        return scopedSelector;
      })
      .join(', ');

    return `${prefix}\n${scopedSelectors} {`;
  });

  const nativeOverrides = `
.giftcard-editor-root {
  --header-height: 0px;
  --top-nav-height: 0px;
  padding: 0;
  background: transparent;
}

.giftcard-editor-root .top-nav {
  position: sticky;
  top: 0;
  left: auto;
  right: auto;
  z-index: 30;
  border-radius: 16px;
  margin-bottom: 1rem;
}

.giftcard-editor-root .layout {
  min-height: auto;
}

.giftcard-editor-root .menu-panel,
.giftcard-editor-root .detail-panel {
  top: 4.5rem;
  max-height: calc(100vh - 16rem);
}

.giftcard-editor-root .preview-wrapper {
  min-width: 0;
}

@media (max-width: 1040px) {
  .giftcard-editor-root .top-nav {
    position: static;
  }

  .giftcard-editor-root .menu-panel,
  .giftcard-editor-root .detail-panel {
    top: auto;
    max-height: none;
  }
}
`;

  return `${scopedCss}\n${nativeOverrides}`;
}

async function ensureGiftcardEditorStyles() {
  if (!giftcardEditorCssPromise) {
    giftcardEditorCssPromise = fetch(`${giftcardMakerAssetRoot}/style.css`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Kunde inte ladda editor-stilarna');
        }
        return response.text();
      })
      .then((css) => scopeGiftcardEditorCss(css));
  }

  const css = await giftcardEditorCssPromise;
  let styleTag = document.getElementById(giftcardEditorStyleId) as HTMLStyleElement | null;

  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = giftcardEditorStyleId;
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = css;
}

function GiftcardEditorMarkup({
  activeSectionId,
  onSectionChange,
  formState,
  previewState,
  onFieldChange,
  onBackgroundImageChange,
  onGenericInputChange,
  onVisibilityChange,
}: {
  activeSectionId: EditorSectionId;
  onSectionChange: (sectionId: EditorSectionId) => void;
  formState: EditorFormState;
  previewState: EditorPreviewState;
  onFieldChange: (field: keyof EditorFormState, value: string) => void;
  onBackgroundImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGenericInputChange: () => void;
  onVisibilityChange: (previewId: string, isVisible: boolean) => void;
}) {
  const activeSection = editorSections.find((section) => section.id === activeSectionId) || editorSections[0];

  return (
    <>
      <div className="layout">
        <aside className="menu-panel" id="mainMenuPanel" aria-label="Main menu">
          <p className="menu-panel-kicker" data-i18n="menuMain">Main Menu</p>
          <h2 className="menu-panel-title" data-i18n="menuProperties">Properties</h2>
          {editorSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`menu-panel-btn${activeSectionId === section.id ? ' active' : ''}`}
              data-menu-target={section.id}
              data-menu-title={section.title}
              data-menu-description={section.description}
              onClick={() => onSectionChange(section.id)}
            >
              {section.buttonLabel}
            </button>
          ))}
        </aside>

        <div className="preview-wrapper">
          <div
            id="giftcard"
            data-mode="giftcard"
            style={{
              backgroundColor: formState.backgroundColor,
              color: formState.textColor,
              backgroundImage: formState.backgroundImageDataUrl ? `url(${formState.backgroundImageDataUrl})` : 'none',
              backgroundSize: formState.backgroundImageDataUrl ? '100% 100%' : undefined,
              backgroundPosition: formState.backgroundImageDataUrl ? 'center' : undefined,
              backgroundRepeat: formState.backgroundImageDataUrl ? 'no-repeat' : undefined,
            }}
          >
            <p
              id="titlePreview"
              className="draggable"
              style={{ top: previewState.titlePreview.top, left: previewState.titlePreview.left, display: formState.visibility.titlePreview ? '' : 'none' }}
            >
              {formState.title}
            </p>
            <p
              id="messagePreview"
              className="draggable"
              style={{ top: previewState.messagePreview.top, left: previewState.messagePreview.left, display: formState.visibility.messagePreview ? '' : 'none' }}
            >
              {formState.message}
            </p>
            <p
              id="infoPreview"
              className="draggable"
              style={{ top: previewState.infoPreview.top, left: previewState.infoPreview.left, display: formState.visibility.infoPreview ? '' : 'none' }}
            >
              {formState.info}
            </p>
            <div
              id="detailsPreviewGroup"
              className="draggable details-preview-group"
              style={{
                top: previewState.detailsPreviewGroup.top,
                left: previewState.detailsPreviewGroup.left,
                width: previewState.detailsPreviewGroup.width,
                height: previewState.detailsPreviewGroup.height,
                display: previewState.detailsPreviewGroup.display || undefined,
              }}
            >
              <p id="identifierPreview" className="details-preview-line">#IDENTIFIER#</p>
              <p id="shortpassPreview" className="details-preview-line">#SHORTPASS#</p>
              <p id="validtoPreview" className="details-preview-line">#VALIDTO#</p>
            </div>
          </div>
        </div>

        <aside className="detail-panel" id="detailPanel" aria-label="Detailed properties">
          <div className="detail-panel-head">
            <p className="detail-panel-kicker" data-i18n="menuElement">Element</p>
            <h3 id="detailPanelTitle">{activeSection.title}</h3>
            <p id="detailPanelDescription">{activeSection.description}</p>
          </div>

          <section className={`menu-detail-section${activeSectionId === 'menu-background' ? ' active' : ''}`} id="menu-background">
            <label className="file-upload-btn"><span data-i18n="backgroundImage">Background image</span>
              <input type="file" id="bgImageInput" accept="image/*" onChange={onBackgroundImageChange} />
            </label>
            <label><span data-i18n="backgroundColor">Background color</span>
              <input type="color" id="bgColorInput" value={formState.backgroundColor} onChange={(event) => onFieldChange('backgroundColor', event.target.value)} />
            </label>
            <label><span data-i18n="textColor">Text color</span>
              <input type="color" id="textColorInput" value={formState.textColor} onChange={(event) => onFieldChange('textColor', event.target.value)} />
            </label>
          </section>

          <section className={`menu-detail-section${activeSectionId === 'menu-content' ? ' active' : ''}`} id="menu-content">
            <label><span data-i18n="title">Title</span>
              <input type="text" id="titleInput" value={formState.title} onChange={(event) => onFieldChange('title', event.target.value)} />
            </label>
            <label><span data-i18n="message">Message</span>
              <textarea id="messageInput" rows={3} value={formState.message} onChange={(event) => onFieldChange('message', event.target.value)} />
            </label>
            <label><span data-i18n="info">Info</span>
              <textarea id="infoInput" rows={3} value={formState.info} onChange={(event) => onFieldChange('info', event.target.value)} />
            </label>
            <div className="toggle-group" id="textVisibilityControls">
              <p className="toggle-group-title" data-i18n="visibleTextFields">Visible text fields</p>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="titlePreview" checked={formState.visibility.titlePreview} onChange={(event) => onVisibilityChange('titlePreview', event.target.checked)} />
                <span data-i18n="title">Title</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="messagePreview" checked={formState.visibility.messagePreview} onChange={(event) => onVisibilityChange('messagePreview', event.target.checked)} />
                <span data-i18n="message">Message</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="infoPreview" checked={formState.visibility.infoPreview} onChange={(event) => onVisibilityChange('infoPreview', event.target.checked)} />
                <span data-i18n="info">Info</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="amountPreview" checked={formState.visibility.amountPreview} onChange={(event) => onVisibilityChange('amountPreview', event.target.checked)} />
                <span data-i18n="amount">Amount</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="identifierPreview" checked={formState.visibility.identifierPreview} onChange={(event) => onVisibilityChange('identifierPreview', event.target.checked)} />
                <span data-i18n="identifier">Identifier</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="shortpassPreview" checked={formState.visibility.shortpassPreview} onChange={(event) => onVisibilityChange('shortpassPreview', event.target.checked)} />
                <span data-i18n="shortpass">Shortpass</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="validtoPreview" checked={formState.visibility.validtoPreview} onChange={(event) => onVisibilityChange('validtoPreview', event.target.checked)} />
                <span data-i18n="validTo">Valid to</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" data-text-visibility-target="bottomBackdropPreview" checked={formState.visibility.bottomBackdropPreview} onChange={(event) => onVisibilityChange('bottomBackdropPreview', event.target.checked)} />
                <span data-i18n="bottomGroupBox">Bottom group box</span>
              </label>
            </div>
          </section>

          <section className={`menu-detail-section${activeSectionId === 'menu-bottom-box' ? ' active' : ''}`} id="menu-bottom-box">
            <label><span data-i18n="bottomGroupTextColor">Bottom group text color</span>
              <input type="color" id="bottomGroupTextColorInput" value={formState.bottomGroupTextColor} onChange={(event) => { onFieldChange('bottomGroupTextColor', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxColor">Bottom group box color</span>
              <input type="color" id="bottomGroupBackdropColorInput" value={formState.bottomGroupBackdropColor} onChange={(event) => { onFieldChange('bottomGroupBackdropColor', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxOpacity">Bottom group box opacity</span>
              <input type="range" id="bottomGroupBackdropOpacityInput" min="0" max="100" step="1" value={formState.bottomGroupBackdropOpacity} onChange={(event) => { onFieldChange('bottomGroupBackdropOpacity', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxShadowColor">Bottom group box shadow color</span>
              <input type="color" id="bottomGroupBackdropShadowColorInput" value={formState.bottomGroupBackdropShadowColor} onChange={(event) => { onFieldChange('bottomGroupBackdropShadowColor', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxShadowX">Bottom group box shadow X (px)</span>
              <input type="number" id="bottomGroupBackdropShadowXInput" min="-200" max="200" step="1" value={formState.bottomGroupBackdropShadowX} onChange={(event) => { onFieldChange('bottomGroupBackdropShadowX', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxShadowY">Bottom group box shadow Y (px)</span>
              <input type="number" id="bottomGroupBackdropShadowYInput" min="-200" max="200" step="1" value={formState.bottomGroupBackdropShadowY} onChange={(event) => { onFieldChange('bottomGroupBackdropShadowY', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxShadowBlur">Bottom group box shadow blur (px)</span>
              <input type="number" id="bottomGroupBackdropShadowBlurInput" min="0" max="200" step="1" value={formState.bottomGroupBackdropShadowBlur} onChange={(event) => { onFieldChange('bottomGroupBackdropShadowBlur', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="bottomGroupBoxShadowOpacity">Bottom group box shadow opacity</span>
              <input type="range" id="bottomGroupBackdropShadowOpacityInput" min="0" max="100" step="1" value={formState.bottomGroupBackdropShadowOpacity} onChange={(event) => { onFieldChange('bottomGroupBackdropShadowOpacity', event.target.value); onGenericInputChange(); }} />
            </label>
          </section>

          <section className={`menu-detail-section${activeSectionId === 'menu-typography' ? ' active' : ''}`} id="menu-typography">
            <label><span data-i18n="textField">Text field</span>
              <select id="textTargetInput" value={formState.textTarget} onChange={(event) => { onFieldChange('textTarget', event.target.value); onGenericInputChange(); }}>
                <option value="titlePreview" data-i18n="title">Title</option>
                <option value="messagePreview" data-i18n="message">Message</option>
                <option value="infoPreview" data-i18n="info">Info</option>
                <option value="amountPreview" data-i18n="amount">Amount</option>
                <option value="detailsPreviewGroup" data-i18n="bottomGroup">Bottom group</option>
              </select>
            </label>
            <label><span data-i18n="fontFamily">Font family</span>
              <select id="fontFamilyInput" value={formState.fontFamily} onChange={(event) => { onFieldChange('fontFamily', event.target.value); onGenericInputChange(); }}>
                <option value="inherit" data-i18n="default">Default</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>
            </label>
            <label><span data-i18n="fontSizePx">Font size (px)</span>
              <input type="number" id="fontSizeInput" min="8" max="300" step="1" value={formState.fontSize} onChange={(event) => { onFieldChange('fontSize', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="fontWeight">Font weight</span>
              <select id="fontWeightInput" value={formState.fontWeight} onChange={(event) => { onFieldChange('fontWeight', event.target.value); onGenericInputChange(); }}>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="700">700</option>
                <option value="800">800</option>
                <option value="900">900</option>
              </select>
            </label>
            <label><span data-i18n="textShadowColor">Text shadow color</span>
              <input type="color" id="textShadowColorInput" value={formState.textShadowColor} onChange={(event) => { onFieldChange('textShadowColor', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="textShadowOffsetX">Text shadow X (px)</span>
              <input type="number" id="textShadowOffsetXInput" min="-200" max="200" step="1" value={formState.textShadowOffsetX} onChange={(event) => { onFieldChange('textShadowOffsetX', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="textShadowOffsetY">Text shadow Y (px)</span>
              <input type="number" id="textShadowOffsetYInput" min="-200" max="200" step="1" value={formState.textShadowOffsetY} onChange={(event) => { onFieldChange('textShadowOffsetY', event.target.value); onGenericInputChange(); }} />
            </label>
            <label><span data-i18n="textShadowBlur">Text shadow blur (px)</span>
              <input type="number" id="textShadowBlurInput" min="0" max="200" step="1" value={formState.textShadowBlur} onChange={(event) => { onFieldChange('textShadowBlur', event.target.value); onGenericInputChange(); }} />
            </label>
          </section>

          <section className={`menu-detail-section${activeSectionId === 'menu-save-load' ? ' active' : ''}`} id="menu-save-load">
            <button type="button" id="saveLayoutBtn" data-i18n="saveJson">Save JSON</button>
            <label className="file-upload-btn"><span data-i18n="loadJson">Load JSON</span>
              <input type="file" id="loadLayoutInput" accept="application/json,.json" />
            </label>
          </section>

          <div className="hidden-binding-fields">
            <label hidden>Amount
              <input type="text" id="amountInput" defaultValue="#AMOUNT#" />
            </label>
            <label hidden>Sender
              <input type="text" id="senderInput" defaultValue="Sender Name" />
            </label>
            <label hidden>Kortnummer
              <input type="text" id="identifierInput" defaultValue="#IDENTIFIER#" />
            </label>
            <label hidden>Shortpass
              <input type="text" id="shortpassInput" defaultValue="#SHORTPASS#" />
            </label>
            <label hidden>Giltlighetstdatum
              <input type="text" id="validToInput" defaultValue="#VALIDTO#" />
            </label>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function GiftcardMaker() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<EditorSectionId>('menu-background');
  const [editorFormState, setEditorFormState] = useState<EditorFormState>(defaultEditorFormState);
  const [previewState, setPreviewState] = useState<EditorPreviewState>(defaultPreviewState);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [showPremadeTemplates, setShowPremadeTemplates] = useState(false);
  const [showOperatorTemplates, setShowOperatorTemplates] = useState(false);
  const [selectedPremadeTemplateId, setSelectedPremadeTemplateId] = useState('');
  const [selectedOperatorTemplateId, setSelectedOperatorTemplateId] = useState('');
  const [operatorTemplateOptions, setOperatorTemplateOptions] = useState<OperatorTemplateOption[]>([]);
  const [operatorTemplatesById, setOperatorTemplatesById] = useState<Record<string, unknown>>({});
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const setTemplateStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    setStatusError(isError);
  };

  const requireEditorApi = () => {
    const api = window.giftcardEditorApi;
    if (!api) {
      throw new Error('Presentkortseditorn är inte klar än.');
    }
    return api;
  };

  const applyLayoutFromUrl = async (url: string, successMessage: string) => {
    const api = requireEditorApi();
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Kunde inte ladda layouten (${response.status}).`);
    }

      const layout = await response.json();
      api.applyLayoutState(layout);
      setActiveSectionId('menu-background');
      setTemplateStatus(successMessage, false);
  };

  const handleLoadDefaultLayout = async () => {
    try {
      await applyLayoutFromUrl(defaultGiftcardLayoutUrl, 'Standardlayout för presentkort laddad.');
      setSelectedPremadeTemplateId('');
      setSelectedOperatorTemplateId('');
    } catch (layoutError) {
      setTemplateStatus(layoutError instanceof Error ? layoutError.message : 'Kunde inte ladda standardlayouten.', true);
    }
  };

  const handlePremadeTemplateChange = async (templateId: string) => {
    setSelectedPremadeTemplateId(templateId);
    if (!templateId) return;

    const definition = premadeTemplateDefinitions.find((item) => item.id === templateId);
    if (!definition) {
      setTemplateStatus('Vald mall hittades inte.', true);
      return;
    }

    try {
      await applyLayoutFromUrl(definition.url, `${definition.label} laddades.`);
      setSelectedOperatorTemplateId('');
    } catch (layoutError) {
      setTemplateStatus(layoutError instanceof Error ? layoutError.message : 'Kunde inte ladda vald mall.', true);
    }
  };

  const normalizeTemplatesPayload = (payload: unknown) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object' && Array.isArray((payload as { templates?: unknown[] }).templates)) {
      return (payload as { templates: unknown[] }).templates;
    }
    if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)) {
      return (payload as { data: unknown[] }).data;
    }
    return [];
  };

  const getTemplateOperatorId = (template: unknown) => {
    if (!template || typeof template !== 'object') return null;
    const candidate = (template as Record<string, unknown>).operatorId
      ?? (template as Record<string, unknown>).operatorID
      ?? (template as Record<string, unknown>).OperatorId;
    if (candidate === undefined || candidate === null || candidate === '') return null;
    return String(candidate);
  };

  const getTemplateId = (template: unknown) => {
    if (!template || typeof template !== 'object') return null;
    const candidate = (template as Record<string, unknown>).templateId
      ?? (template as Record<string, unknown>).id
      ?? (template as Record<string, unknown>).TemplateId;
    if (candidate === undefined || candidate === null || candidate === '') return null;
    return String(candidate);
  };

  const getTemplateName = (template: unknown) => {
    if (!template || typeof template !== 'object') return 'Unnamed template';
    const candidate = (template as Record<string, unknown>).templateName
      ?? (template as Record<string, unknown>).name
      ?? (template as Record<string, unknown>).TemplateName;
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
    return 'Unnamed template';
  };

  const handleLoadTemplates = async () => {
    setIsLoadingTemplates(true);
    setTemplateStatus('Laddar mallar...');

    try {
      const response = await fetch(templateApiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Kunde inte hämta mallar (${response.status}).`);
      }

      const payload = await response.json();
      const templates = normalizeTemplatesPayload(payload);
      const nextTemplatesById: Record<string, unknown> = {};
      const nextOptions: OperatorTemplateOption[] = [];

      templates.forEach((template) => {
        const operatorId = getTemplateOperatorId(template);
        const templateId = getTemplateId(template);
        if (!operatorId || !templateId || nextTemplatesById[templateId]) return;

        nextTemplatesById[templateId] = template;
        nextOptions.push({
          templateId,
          operatorId,
          templateName: getTemplateName(template),
        });
      });

      nextOptions.sort((a, b) => {
        const operatorSort = a.operatorId.localeCompare(b.operatorId);
        return operatorSort !== 0 ? operatorSort : a.templateName.localeCompare(b.templateName);
      });

      setOperatorTemplatesById(nextTemplatesById);
      setOperatorTemplateOptions(nextOptions);
      setShowOperatorTemplates(true);
      setTemplateStatus(`Laddade ${nextOptions.length} mallar.`, false);
    } catch (templatesError) {
      setTemplateStatus(templatesError instanceof Error ? templatesError.message : 'Kunde inte hämta mallar.', true);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleOperatorTemplateChange = (templateId: string) => {
    setSelectedOperatorTemplateId(templateId);
    if (!templateId) return;

    try {
      const api = requireEditorApi();
      const template = operatorTemplatesById[templateId];
      if (!template) {
        throw new Error('Vald operatörsmall hittades inte.');
      }
      const applied = api.applyTemplateRecord(template);
      if (!applied) {
        throw new Error('Mallformatet stöds inte.');
      }
      setSelectedPremadeTemplateId('');
    } catch (templateError) {
      setTemplateStatus(templateError instanceof Error ? templateError.message : 'Kunde inte använda mallen.', true);
    }
  };

  const handleSaveLayout = () => {
    try {
      requireEditorApi().downloadLayoutJson();
      setTemplateStatus('Layout exporterad som JSON.', false);
    } catch (saveError) {
      setTemplateStatus(saveError instanceof Error ? saveError.message : 'Kunde inte spara layouten.', true);
    }
  };

  const handleLoadLayoutFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const api = requireEditorApi();
      const contents = await file.text();
      const layout = JSON.parse(contents);
      api.applyLayoutState(layout);
      setActiveSectionId('menu-background');
      setTemplateStatus('JSON-layout laddad.', false);
      setSelectedPremadeTemplateId('');
      setSelectedOperatorTemplateId('');
    } catch (loadError) {
      setTemplateStatus(loadError instanceof Error ? loadError.message : 'Kunde inte ladda JSON-layouten.', true);
    }
  };

  const applyGiftcardCookies = (operatorIds: string[]) => {
    if (!operatorIds || operatorIds.length === 0) return;
    const maxAge = 12 * 60 * 60;
    const options = `path=/; max-age=${maxAge}; SameSite=Lax`;
    const operatorId = operatorIds[0];
    document.cookie = `giftcard_auth=1; ${options}`;
    document.cookie = `giftcard_role=operator; ${options}`;
    document.cookie = `giftcard_operator=${encodeURIComponent(operatorId)}; ${options}`;
    document.cookie = `giftcard_operator_ids=${encodeURIComponent(operatorIds.join(','))}; ${options}`;
  };

  const syncFormStateFromDom = () => {
    setEditorFormState(extractEditorFormStateFromDom());
  };

  const syncPreviewStateFromDom = () => {
    setPreviewState(extractPreviewStateFromDom());
  };

  const updatePreviewText = (previewId: string, value: string) => {
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.textContent = value;
    }
  };

  const handleFieldChange = (field: keyof EditorFormState, value: string) => {
    if (field === 'backgroundColor') {
      setEditorFormState((current) => ({
        ...current,
        backgroundColor: value,
        backgroundImageDataUrl: '',
      }));
      const input = document.getElementById('bgColorInput') as HTMLInputElement | null;
      const giftcard = document.getElementById('giftcard');
      if (input) input.value = value;
      if (giftcard) {
        giftcard.style.backgroundColor = value;
        giftcard.style.backgroundImage = 'none';
      }
      return;
    }

    if (field === 'backgroundImageDataUrl') {
      setEditorFormState((current) => ({ ...current, backgroundImageDataUrl: value }));
      const giftcard = document.getElementById('giftcard');
      if (giftcard) {
        if (value) {
          giftcard.style.backgroundImage = `url(${value})`;
          giftcard.style.backgroundSize = '100% 100%';
          giftcard.style.backgroundPosition = 'center';
          giftcard.style.backgroundRepeat = 'no-repeat';
        } else {
          giftcard.style.backgroundImage = 'none';
        }
      }
      return;
    }

    if (field === 'textColor') {
      setEditorFormState((current) => ({ ...current, textColor: value }));
      const input = document.getElementById('textColorInput') as HTMLInputElement | null;
      const giftcard = document.getElementById('giftcard');
      if (input) input.value = value;
      if (giftcard) {
        giftcard.style.color = value;
      }
      return;
    }

    setEditorFormState((current) => ({ ...current, [field]: value }));

    if (
      field === 'bottomGroupTextColor'
      || field === 'bottomGroupBackdropColor'
      || field === 'bottomGroupBackdropOpacity'
      || field === 'bottomGroupBackdropShadowColor'
      || field === 'bottomGroupBackdropShadowX'
      || field === 'bottomGroupBackdropShadowY'
      || field === 'bottomGroupBackdropShadowBlur'
      || field === 'bottomGroupBackdropShadowOpacity'
      || field === 'textTarget'
      || field === 'fontFamily'
      || field === 'fontSize'
      || field === 'fontWeight'
      || field === 'textShadowColor'
      || field === 'textShadowOffsetX'
      || field === 'textShadowOffsetY'
      || field === 'textShadowBlur'
    ) {
      return;
    }

    const inputIdByField = {
      title: 'titleInput',
      message: 'messageInput',
      info: 'infoInput',
    } as const;

    const previewIdByField = {
      title: 'titlePreview',
      message: 'messagePreview',
      info: 'infoPreview',
    } as const;

    const input = document.getElementById(inputIdByField[field]) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) {
      input.value = value;
    }
    updatePreviewText(previewIdByField[field], value);
  };

  const handleGenericInputChange = () => {
    window.requestAnimationFrame(() => {
      syncFormStateFromDom();
    });
  };

  const handleBackgroundImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : '';
      if (!result) return;
      handleFieldChange('backgroundImageDataUrl', result);
      syncFormStateFromDom();
    };
    reader.readAsDataURL(file);
  };

  const handleVisibilityChange = (previewId: string, isVisible: boolean) => {
    setEditorFormState((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [previewId]: isVisible,
      },
    }));

    const checkbox = document.querySelector(`[data-text-visibility-target="${previewId}"]`) as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = isVisible;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initEditor = async () => {
      setError(null);
      setIsReady(false);
      setIsEditorMounted(false);

      try {
        await ensureGiftcardEditorStyles();
      } catch (styleError) {
        if (!cancelled) {
          setError(styleError instanceof Error ? styleError.message : 'Kunde inte ladda editorn');
        }
        return;
      }

      const result = await giftcardMakerService.initSession();
      if (cancelled) return;

      if (!result.success) {
        setError(result.error || 'Kunde inte initiera presentkortsskaparen');
        return;
      }

      const operatorIds = (result.operatorIds && result.operatorIds.length > 0)
        ? result.operatorIds
        : (result.terminalIds && result.terminalIds.length > 0)
          ? result.terminalIds
          : result.companyIds || [];

      if (operatorIds.length > 0) {
        applyGiftcardCookies(operatorIds);
      }

      setIsReady(true);
      setIsEditorMounted(true);
      setEditorFormState(defaultEditorFormState);
      setPreviewState(defaultPreviewState);
    };

    initEditor();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditorMounted || !rootRef.current) return;

    const existingScript = document.querySelector(`script[${giftcardEditorScriptAttribute}="true"]`);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.src = `${giftcardMakerAssetRoot}/Script.js?native=${Date.now()}`;
    script.async = false;
    script.setAttribute(giftcardEditorScriptAttribute, 'true');
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [isEditorMounted]);

  useEffect(() => {
    if (!isEditorMounted) return;

    const handleStateChange = () => {
      syncFormStateFromDom();
      syncPreviewStateFromDom();
    };

    const timeoutId = window.setTimeout(handleStateChange, 50);
    window.addEventListener('giftcard-editor-state-change', handleStateChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('giftcard-editor-state-change', handleStateChange);
    };
  }, [isEditorMounted]);

  useEffect(() => {
    if (!isEditorMounted) return;

    applyPreviewLayoutToElement('titlePreview', previewState.titlePreview);
    applyPreviewLayoutToElement('messagePreview', previewState.messagePreview);
    applyPreviewLayoutToElement('infoPreview', previewState.infoPreview);
    applyPreviewLayoutToElement('detailsPreviewGroup', previewState.detailsPreviewGroup);
    applyPreviewLayoutToElement('bottomMovableGroup', previewState.bottomMovableGroup);
    applyPreviewLayoutToElement('bottomBackdropPreview', previewState.bottomBackdropPreview);
  }, [isEditorMounted, previewState]);

  return (
    <MainLayout>
      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {isReady ? (
          <nav className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm">
            <button type="button" onClick={handleLoadDefaultLayout} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Nytt presentkort
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPremadeTemplates((value) => !value)}
                className="rounded-full border px-4 py-2 text-sm font-medium"
              >
                Färdiga mallar
              </button>
              {showPremadeTemplates ? (
                <select
                  value={selectedPremadeTemplateId}
                  onChange={(event) => void handlePremadeTemplateChange(event.target.value)}
                  className="rounded-full border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Välj färdig mall</option>
                  {premadeTemplateDefinitions.map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.label}</option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleLoadTemplates()}
                disabled={isLoadingTemplates}
                className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {isLoadingTemplates ? 'Laddar mallar...' : 'Hämta mall'}
              </button>
              {showOperatorTemplates ? (
                <select
                  value={selectedOperatorTemplateId}
                  onChange={(event) => handleOperatorTemplateChange(event.target.value)}
                  className="rounded-full border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Välj operatorId och mall</option>
                  {operatorTemplateOptions.map((option) => (
                    <option key={option.templateId} value={option.templateId}>
                      {option.operatorId} - {option.templateName}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <button type="button" onClick={handleSaveLayout} className="rounded-full border px-4 py-2 text-sm font-medium">
              Spara JSON
            </button>

            <label className="rounded-full border px-4 py-2 text-sm font-medium">
              Ladda JSON
              <input type="file" accept="application/json,.json" onChange={(event) => void handleLoadLayoutFile(event)} className="hidden" />
            </label>

            {statusMessage ? (
              <p className={`text-sm ${statusError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {statusMessage}
              </p>
            ) : null}
          </nav>
        ) : null}

        {isReady ? (
          <div
            id="giftcard-editor-root"
            ref={rootRef}
            data-react-managed-inspector="true"
            className="giftcard-editor-root rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm backdrop-blur-sm"
          >
            <GiftcardEditorMarkup
              activeSectionId={activeSectionId}
              onSectionChange={setActiveSectionId}
              formState={editorFormState}
              previewState={previewState}
              onFieldChange={handleFieldChange}
              onBackgroundImageChange={handleBackgroundImageChange}
              onGenericInputChange={handleGenericInputChange}
              onVisibilityChange={handleVisibilityChange}
            />
          </div>
        ) : (
          <div className="flex min-h-[18rem] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
            Initierar {defaultGiftcardMakerPage.title}...
          </div>
        )}
      </div>
    </MainLayout>
  );
}
