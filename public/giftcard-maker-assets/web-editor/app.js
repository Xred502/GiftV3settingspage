const htmlInput = document.getElementById("htmlInput");
const cssInput = document.getElementById("cssInput");
const jsInput = document.getElementById("jsInput");
const previewFrame = document.getElementById("previewFrame");
const previewStage = document.getElementById("previewStage");
const previewResizeHandle = document.getElementById("previewResizeHandle");
const statusPill = document.getElementById("statusPill");
const lastUpdate = document.getElementById("lastUpdate");
const livePreviewToggle = document.getElementById("livePreviewToggle");
const wrapToggle = document.getElementById("wrapToggle");
const editorPanel = document.getElementById("editorPanel");
const previewSizeSelect = document.getElementById("previewSizeSelect");
const editorSections = Array.from(document.querySelectorAll(".editor-section"));
const editorFocusButtons = Array.from(document.querySelectorAll("[data-editor-focus]"));
const editorFocusOverlay = document.getElementById("editorFocusOverlay");
const editorSectionPositions = new Map();
const editorTargetButtons = Array.from(document.querySelectorAll("[data-editor-target]"));
const htmlEditorSection = document.getElementById("htmlEditorSection");
const cssEditorSection = document.getElementById("cssEditorSection");
const jsEditorSection = document.getElementById("jsEditorSection");
const detailPanelTitle = document.getElementById("detailPanelTitle");
const detailPanelDescription = document.getElementById("detailPanelDescription");

const applyBtn = document.getElementById("applyBtn");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const restoreBackupBtn = document.getElementById("restoreBackupBtn");
const resetBtn = document.getElementById("resetBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const languageToggleBtn = document.getElementById("languageToggleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const operatorSwitch = document.getElementById("operatorSwitch");
const operatorSelect = document.getElementById("operatorSelect");
const operatorEmptyState = document.getElementById("operatorEmptyState");
const layoutMain = document.querySelector("main.layout");
const operatorScopedPanels = Array.from(document.querySelectorAll(".menu-panel, .preview-wrapper, .detail-panel"));
const themeStorageKey = "previewEditorTheme";
const previewHeightStorageKey = "previewEditorPreviewHeight";
const defaultEditorSaveKey = "webEditorSavedState";
const defaultEditorBackupKey = "webEditorSavedBackups";
const appRoot = "/giftcard-maker";
const backendOrigin = window.location.port === "8080"
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;
const giftcardMakerApiRoot = new URL("/api/giftcard-maker/", backendOrigin).toString();
const giftcardMakerAuthStatusUrl = new URL("auth/status", giftcardMakerApiRoot).toString();
const giftcardMakerCompaniesUrl = new URL("companies", giftcardMakerApiRoot).toString();
const giftcardMakerLogoutUrl = new URL("/api/auth/logout", backendOrigin).toString();
let editorSaveKey = defaultEditorSaveKey;
let editorBackupKey = defaultEditorBackupKey;
let activeOperatorId = "";
const operatorSelectionKey = "webEditorOperatorScope";
const placeholderOperatorIds = ["2Entertain", "Apature", "Barnsworth", "Twin Peeks"];
const editorTargetStorageKey = "webEditorTarget";
let activeEditorTarget = "web";
let currentAuthStatus = null;
let activeCompanyId = "";
let companyCacheLoaded = false;
let companyMarkupCache = { bannerHtml: "", companyFooterHtml: "" };

const loadHtmlInput = document.getElementById("loadHtmlInput");
const loadCssInput = document.getElementById("loadCssInput");
const loadJsInput = document.getElementById("loadJsInput");

const defaultState = {
  html: `<div id="root">
  <div class="app">
    <header class="app-header">
      <h1>Showtic</h1>
    </header>
    <main class="app-main">
      <div class="gift-card-form-container">
        <div class="form-card">
          <h2>Create New Gift Card</h2>
          <form>
            <div class="form-group">
              <label>Select Template *</label>
              <div class="template-thumbnails">
                <div class="template-thumbnail ">
                  <div class="template-preview">
                    <div class="template-iframe-wrapper">
                      <iframe
                        title="Template 3"
                        class="template-iframe"
                        srcdoc="
                                  &lt;!DOCTYPE html&gt;
                                  &lt;html&gt;
                                    &lt;head&gt;
                                      &lt;meta charset=&quot;UTF-8&quot;&gt;
                                      &lt;style&gt;
                                        @import url('https://fonts.googleapis.com/css?family=Proxima+Nova');  div.showtic {   position: absolute;   top: 0px;   left: 0px;   width: 1240px;   height: 1300px;   background-color: #1d1d1f;   color: white;   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   font-size: 22px;  }  div.presentkort  {   color: white;   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   font-size: 80px;  }  div.varde  {   color: white;   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   font-size: 40px;  }  div.message  {   color: white;   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   font-size: 30px; }  div.gifter{   color: white;   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   font-size: 30px;   font-style: italic; }  .fontNormalBlack {   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   color: white;   font-size: 22px;   font-weight: normal; }  .fontBoldBlack {   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   color: white;   font-size: 22px;   font-weight: bold; }  .fontUnderline {   font-family: 'Proxima Nova', 'Montserrat' , sans-serif;   color: white;   font-size: 22px;   font-weight: bold; }   span.cls_002 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;           font-size: 22px;            color: #FFFFFF;            font-weight: normal;            font-style: normal;            text-decoration: none        }         div.cls_002 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;           font-size: 22px;            color: #FFFFFF;             font-weight: normal;            font-style: normal;            text-decoration: none        }          span.cls_003 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;           font-size: 18px;            color: #FFFFFF;             font-weight: normal;            font-style: none;            text-decoration: none        }         div.cls_003 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;           font-size: 18px;            color: #FFFFFF;              font-weight: normal;            font-style: none;            text-decoration: none        }          span.cls_004 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;           font-size: 22px;            color: #FFFFFF;            font-weight: normal;            font-style: normal;            text-decoration: none        }         div.cls_004 {            font-family: 'Proxima Nova', 'Montserrat' , sans-serif;            font-size: 22px;            color: #FFFFFF;           font-weight: normal;            font-style: normal;            text-decoration: none        }
                                        * {
                                          margin: 0;
                                          padding: 0;
                                          box-sizing: border-box;
                                        }
                                        html, body {
                                          width: 100%;
                                          height: 100%;
                                          overflow: hidden;
                                        }
                                      &lt;/style&gt;
                                    &lt;/head&gt;
                                    &lt;body&gt;
                                      &lt;div class=&quot;showtic&quot;&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute; top:0px; left: 0px&quot;&gt;
&lt;img src=&quot;https://giftcards.microdeb.me/media/33gfmlsb/showtic-grattis.jpg&quot;&gt;
&lt;/div&gt;
&lt;div style=&quot;position:absolute; top:975px; margin-left:75px; margin-right:75px; left:0; right:0; text-align:center&quot; class=&quot;message&quot;&gt;
&lt;span class=&quot;message&quot;&gt;#PERSONALMESSAGE#&lt;/span&gt;
&lt;/div&gt;
&lt;div style=&quot;position:absolute; left:85px; top:1335px&quot;&gt;&lt;img src=&quot;https://giftcards.microdeb.me/media/lquj5red/qr-background.png&quot; width=&quot;179px&quot; height=&quot;179px&quot;&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:100px;top:1350px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;&lt;img class=&quot;qr-code-image&quot; src=https://api.qrserver.com/v1/create-qr-code/?size=150x150&amp;data=#IDENTIFIER# alt=&quot;&quot;&gt;&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:325px;top:1360px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;V&amp;Auml;RDE:&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:500px;top:1360px&quot; class=&quot;fontBoldBlack&quot;&gt;&lt;span class=&quot;fontBoldBlack&quot;&gt;#AMOUNT# kr&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:700px;top:1360px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;GILTIGHETSDATUM:&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:920px;top:1360px&quot; class=&quot;fontBoldBlack&quot;&gt;&lt;span class=&quot;fontBoldBlack&quot;&gt;#VALIDTO#&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:325px;top:1415px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;KORTNUMMER:&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:500px;top:1415px&quot; class=&quot;fontBoldBlack&quot;&gt;&lt;span class=&quot;fontBoldBlack&quot;&gt;#IDENTIFIER#&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:325px;top:1470px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;SHORTPASS:&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:500px;top:1470px&quot; class=&quot;fontBoldBlack&quot;&gt;&lt;span class=&quot;fontBoldBlack&quot;&gt;#SHORTPASS#&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:700px;top:1470px&quot; class=&quot;fontNormalBlack&quot;&gt;&lt;span class=&quot;fontNormalBlack&quot;&gt;SE TRANSAKTIONER: &lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;left:930px;top:1470px&quot; class=&quot;fontUnderline&quot;&gt;&lt;span class=&quot;fontUnderline&quot;&gt;&lt;a href=&quot;https://shortpass.microdeb.me/?c=#SHORTPASS#&quot; style=&quot;color: #FFFFFF&quot;&gt;shortpass.microdeb.me&lt;/a&gt;&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;top:1570px;margin-left:20;margin-right:20;left:0;right:0;text-align:center&quot; class=&quot;cls_003&quot;&gt;&lt;span class=&quot;cls_003&quot;&gt;F&amp;ouml;r att boka biljetter och se aktuellt utbud av teater, musikal och show - bes&amp;ouml;k&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;top:1600px;margin-left:20;margin-right:20;left:0;right:0;text-align:center&quot; class=&quot;cls_004&quot;&gt;&lt;span class=&quot;cls_004&quot;&gt;&lt;a href=&quot;https://www.showtic.se/presentkort&quot; style=&quot;color: #FFFFFF&quot;&gt;www.showtic.se/presentkort&lt;/a&gt;&lt;/span&gt;&lt;/div&gt;
&lt;div style=&quot;position:absolute;top:1640px;margin-left:20;margin-right:20;left:0;right:0;text-align:center&quot; class=&quot;cls_003&quot;&gt;&lt;span class=&quot;cls_003&quot;&gt;Presentkortet &amp;auml;r en v&amp;auml;rdehandling, f&amp;ouml;rvara det s&amp;auml;kert.&lt;/span&gt;&lt;/div&gt;
                                    &lt;/body&gt;
                                  &lt;/html&gt;
                                "
                      ></iframe>
                    </div>
                  </div>
                  <div class="template-name">Presentkort</div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label for="amount">Amount *</label>
              <input type="number" id="amount" name="amount" placeholder="100.00" min="2.50" max="10000" step="0.01" required class="" value="">
              <small>Enter amount between 2.50 and 10000 (in major units, e.g., 100.00)</small>
            </div>
            <div class="form-group">
              <label for="currency">Currency</label>
              <select id="currency" name="currency">
                <option value="SEK">SEK (kr)</option>
                <option value="GBP">GBP (&pound;)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (&euro;)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="senderName">Your Name (Sender) *</label>
              <input type="text" id="senderName" name="senderName" placeholder="Enter your name" required class="" value="">
            </div>
            <div class="form-group">
              <label for="customerEmail">Your Email (Customer)</label>
              <input type="email" id="customerEmail" name="customerEmail" placeholder="your@email.com" class="" value="">
              <small>Optional: Email address for order confirmation</small>
            </div>
            <div class="form-group">
              <label for="recipientName">Recipient Name *</label>
              <input type="text" id="recipientName" name="recipientName" placeholder="Enter recipient name" required class="" value="">
            </div>
            <div class="form-group">
              <label for="recipientEmail">Recipient Email *</label>
              <input type="email" id="recipientEmail" name="recipientEmail" placeholder="recipient@example.com" required class="" value="">
              <small>Email address to send the gift card to</small>
            </div>
            <div class="form-group">
              <label>Sending Option *</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" name="sendOption" value="now" checked>
                  <span>Send now</span>
                </label>
                <label class="radio-label">
                  <input type="radio" name="sendOption" value="schedule">
                  <span>Schedule sending</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label for="senderMessage">Message</label>
              <textarea id="senderMessage" name="senderMessage" placeholder="Add a personal message (optional, max 250 characters)" rows="4" maxlength="250"></textarea>
              <small>0/250 characters</small>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary">Cancel</button>
              <button type="button" class="btn btn-secondary">Preview Gift Card</button>
              <button type="submit" class="btn btn-primary">Proceed to Checkout</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</div>`,
  css: `.app{min-height:100vh;display:flex;flex-direction:column}.app-header{background:#fffffff2;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);padding:1.5rem 2rem;box-shadow:0 2px 10px #0000001a;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}.app-header h1{color:#333;font-size:2rem;font-weight:700}.app-main{flex:1;padding:2rem;max-width:1400px;width:100%;margin:0 auto}.loading-container{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:#fff}.spinner{width:50px;height:50px;border:4px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:1rem}@keyframes spin{to{transform:rotate(360deg)}}.error-banner{background:#f44;color:#fff;padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;margin:1rem 2rem 0;border-radius:8px}.error-banner button{background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;padding:0 .5rem}.error-banner button:hover{opacity:.8}.btn{padding:.75rem 1.5rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;transition:all .3s ease}.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 4px 12px #667eea66}.btn-secondary{background:#6c757d;color:#fff}.btn-secondary:hover{background:#5a6268}.btn-danger{background:#dc3545;color:#fff}.btn-danger:hover{background:#c82333}@media (max-width: 768px){.app-header{flex-direction:column;gap:1rem;padding:1rem}.app-header h1{font-size:1.5rem}.app-main{padding:1rem}}.gift-card-form-container{display:flex;justify-content:center;width:100%}.form-card{background:#fff;border-radius:16px;padding:2rem;box-shadow:0 4px 20px #00000026;width:100%;max-width:600px}.form-card h2{color:#333;margin-bottom:2rem;font-size:2rem}.form-group{margin-bottom:1.5rem}.form-group label{display:block;margin-bottom:.5rem;color:#333;font-weight:600;font-size:.95rem}.form-group input,.form-group select,.form-group textarea{width:100%;padding:.75rem;border:2px solid #e9ecef;border-radius:8px;font-size:1rem;transition:all .3s ease;font-family:inherit}.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px #667eea1a}.form-group input.error,.form-group select.error,.form-group textarea.error{border-color:#dc3545}.form-group textarea{resize:vertical;min-height:100px}.form-group input[type=checkbox]{width:auto;margin-right:.5rem;cursor:pointer}.form-group label.checkbox-label{display:flex;align-items:center;cursor:pointer;font-weight:400}.radio-group{display:flex;gap:2rem;flex-wrap:wrap;padding:1rem;background:#f8f9fa;border-radius:8px;border:2px solid #e9ecef;margin-top:.5rem}.radio-label{display:flex;align-items:center;cursor:pointer;font-weight:500;gap:.75rem;padding:.5rem 1rem;border-radius:6px;transition:all .2s ease;flex:1;min-width:150px;justify-content:center}.radio-label:hover{background:#e9ecef}.radio-label input[type=radio]{width:20px;height:20px;margin:0;cursor:pointer;accent-color:#667eea}.radio-label:has(input[type=radio]:checked){background:#e7f0ff;border:2px solid #667eea;color:#667eea}.radio-label span{-webkit-user-select:none;user-select:none;font-size:1rem}.form-group small{display:block;color:#6c757d;font-size:.85rem;margin-top:.25rem}.loading-templates{padding:1rem;text-align:center;color:#6c757d;font-style:italic}.error-message{display:block;color:#dc3545;font-size:.85rem;margin-top:.25rem}.form-actions{display:flex;gap:1rem;justify-content:flex-end;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e9ecef}.form-actions button{min-width:120px}.form-actions button:disabled{opacity:.6;cursor:not-allowed}.template-thumbnails{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem;margin-top:.5rem}.template-thumbnail{position:relative;border:2px solid #e9ecef;border-radius:12px;overflow:hidden;cursor:pointer;transition:all .3s ease;background:#fff;box-shadow:0 2px 8px #0000001a}.template-thumbnail:hover{border-color:#667eea;box-shadow:0 4px 12px #667eea33;transform:translateY(-2px)}.template-thumbnail.selected{border-color:#667eea;border-width:3px;box-shadow:0 4px 16px #667eea4d}.template-thumbnail.selected:after{content:"\\2713";position:absolute;top:8px;right:8px;background:#667eea;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;z-index:10;box-shadow:0 2px 4px #0003}.template-preview{width:100%;height:180px;position:relative;overflow:hidden;background:#f8f9fa;display:flex;align-items:center;justify-content:center}.template-preview-full{height:80vh;max-height:800px;display:flex;align-items:center;justify-content:center}.template-iframe-full{width:1200px;height:1900px;border:none;pointer-events:auto;position:absolute;background:#fff}.template-iframe-wrapper-full{width:1200px;height:1900px;position:relative;transform-origin:top left}.template-iframe-wrapper{width:120px;height:190px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}.template-iframe{width:1200px;height:1900px;border:none;pointer-events:none;transform:scale(.1);transform-origin:center center;position:absolute;background:#fff}.template-name{padding:.75rem;text-align:center;font-size:.85rem;font-weight:600;color:#333;background:#fff;border-top:1px solid #e9ecef;display:flex;flex-direction:column;gap:.5rem}.template-preview-button{border:none;background:transparent;color:#667eea;font-size:.8rem;cursor:pointer;text-decoration:underline;padding:0}.template-preview-button:hover{color:#4c5ccf}@media (max-width: 768px){.form-card{padding:1.5rem}.form-card h2{font-size:1.5rem}.form-actions{flex-direction:column-reverse}.form-actions button{width:100%}.template-thumbnails{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.75rem}.template-preview{height:150px}}.payment-success-container{display:flex;justify-content:center;align-items:center;min-height:60vh;width:100%;padding:2rem 1rem}.payment-success-card{background:#fff;border-radius:16px;padding:3rem 2rem;box-shadow:0 4px 20px #00000026;width:100%;max-width:600px;text-align:center}.success-icon{margin-bottom:1.5rem;display:flex;justify-content:center;animation:scaleIn .5s ease-out}@keyframes scaleIn{0%{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}.payment-success-card h1{color:#28a745;margin-bottom:1rem;font-size:2.5rem;font-weight:700}.success-message{color:#6c757d;font-size:1.1rem;margin-bottom:2rem;line-height:1.6}.order-details{background:#f8f9fa;border-radius:12px;padding:1.5rem;margin:2rem 0;text-align:left}.order-detail-row{display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid #e9ecef}.order-detail-row:last-child{border-bottom:none}.order-label{font-weight:600;color:#495057;font-size:.95rem}.order-value{color:#212529;font-size:.95rem}.order-status{text-transform:capitalize;color:#28a745;font-weight:600}.receipt-link{color:#667eea;text-decoration:none;font-weight:500;transition:color .3s ease}.receipt-link:hover{color:#5568d3;text-decoration:underline}.success-info{background:#e7f3ff;border:1px solid #b3d9ff;border-radius:8px;padding:1rem;margin:2rem 0;color:#004085;font-size:.95rem;line-height:1.5}.success-actions{margin-top:2rem}.success-actions .btn{min-width:200px;padding:.875rem 2rem;font-size:1rem;font-weight:600}@media (max-width: 768px){.payment-success-card{padding:2rem 1.5rem}.payment-success-card h1{font-size:2rem}.order-detail-row{flex-direction:column;align-items:flex-start;gap:.5rem}.success-actions .btn{width:100%}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh}code{font-family:source-code-pro,Menlo,Monaco,Consolas,Courier New,monospace}`,
  js: ``
};

const apatureDefaultState = {
  html: `<div class="portal-shell">
  <div class="portal-orb portal-blue"></div>
  <div class="portal-orb portal-orange"></div>

  <header class="portal-header">
    <div class="portal-logo">
      <span class="logo-mark">A</span>
      <div>
        <p class="logo-title">Apature Science</p>
        <p class="logo-subtitle">Testing Interface</p>
      </div>
    </div>
    <div class="portal-tag">CHAMBER 06</div>
  </header>

  <main class="portal-main">
    <section class="portal-card">
      <p class="portal-kicker">Subject</p>
      <h1>Welcome to the Enrichment Center</h1>
      <p class="portal-body">
        Reminder: This testing environment is designed to maximize scientific discovery
        while maintaining a pleasant automated experience.
      </p>
      <div class="portal-metrics">
        <div>
          <p class="metric-value">98.7%</p>
          <p class="metric-label">Chamber Integrity</p>
        </div>
        <div>
          <p class="metric-value">02:16</p>
          <p class="metric-label">Last Cycle</p>
        </div>
        <div>
          <p class="metric-value">47</p>
          <p class="metric-label">Active Sensors</p>
        </div>
      </div>
    </section>

    <section class="portal-card portal-status">
      <p class="portal-kicker">Systems</p>
      <div class="status-row">
        <span>Portal Emitters</span>
        <span class="status-pill ok">Online</span>
      </div>
      <div class="status-row">
        <span>Neurotoxin Reserve</span>
        <span class="status-pill warn">Standby</span>
      </div>
      <div class="status-row">
        <span>Companion Cube</span>
        <span class="status-pill ok">Secured</span>
      </div>
      <div class="portal-actions">
        <button class="portal-btn primary" id="initTest">Initiate Test</button>
        <button class="portal-btn ghost" id="calibrate">Calibrate Chamber</button>
      </div>
      <p class="portal-status-line" id="statusLine">Status: Awaiting subject input.</p>
    </section>
  </main>

  <footer class="portal-footer">
    <span>Apature OS 3.1</span>
    <span id="stageLine">Stage: Dormant</span>
  </footer>
</div>`,
  css: `:root {
  --portal-bg: #0b0f19;
  --portal-panel: #111827;
  --portal-panel-soft: rgba(17, 24, 39, 0.92);
  --portal-text: #e2e8f0;
  --portal-muted: #94a3b8;
  --portal-blue: #4db7ff;
  --portal-orange: #ff9b2f;
  --portal-border: rgba(148, 163, 184, 0.25);
  --portal-shadow: 0 16px 40px rgba(6, 9, 18, 0.55);
  --portal-font: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--portal-font);
  background: var(--portal-bg);
  color: var(--portal-text);
}

.portal-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  padding: 32px 48px 40px;
  background:
    radial-gradient(circle at 20% 20%, rgba(77, 183, 255, 0.12), transparent 40%),
    radial-gradient(circle at 80% 10%, rgba(255, 155, 47, 0.12), transparent 45%),
    linear-gradient(180deg, #0b0f19 0%, #0f172a 100%);
}

.portal-orb {
  position: absolute;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  opacity: 0.35;
  filter: blur(2px);
}

.portal-blue {
  top: -80px;
  right: 14%;
  background: radial-gradient(circle, rgba(77, 183, 255, 0.6), transparent 70%);
}

.portal-orange {
  bottom: -120px;
  left: 8%;
  background: radial-gradient(circle, rgba(255, 155, 47, 0.6), transparent 70%);
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.portal-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #0b0f19;
  background: linear-gradient(135deg, var(--portal-blue), var(--portal-orange));
}

.logo-title {
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
}

.logo-subtitle {
  margin: 4px 0 0;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--portal-muted);
}

.portal-tag {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--portal-muted);
}

.portal-main {
  margin-top: 32px;
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(260px, 0.8fr);
  gap: 24px;
  position: relative;
  z-index: 1;
}

.portal-card {
  background: var(--portal-panel-soft);
  border: 1px solid var(--portal-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: var(--portal-shadow);
}

.portal-kicker {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--portal-muted);
}

.portal-card h1 {
  margin: 12px 0 16px;
  font-size: 28px;
}

.portal-body {
  margin: 0 0 20px;
  color: var(--portal-muted);
  line-height: 1.5;
}

.portal-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 16px;
}

.metric-value {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.metric-label {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--portal-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.portal-status .status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  color: var(--portal-muted);
  font-size: 13px;
}

.status-pill {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-pill.ok {
  background: rgba(77, 183, 255, 0.2);
  color: var(--portal-blue);
  border: 1px solid rgba(77, 183, 255, 0.4);
}

.status-pill.warn {
  background: rgba(255, 155, 47, 0.18);
  color: var(--portal-orange);
  border: 1px solid rgba(255, 155, 47, 0.4);
}

.portal-actions {
  display: flex;
  gap: 12px;
  margin: 20px 0 12px;
}

.portal-btn {
  border-radius: 999px;
  padding: 10px 16px;
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.portal-btn.primary {
  background: linear-gradient(135deg, var(--portal-blue), var(--portal-orange));
  color: #0b0f19;
}

.portal-btn.ghost {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.35);
  color: var(--portal-text);
}

.portal-status-line {
  margin: 0;
  font-size: 12px;
  color: var(--portal-muted);
}

.portal-footer {
  margin-top: 28px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--portal-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

@media (max-width: 900px) {
  .portal-shell {
    padding: 24px;
  }

  .portal-main {
    grid-template-columns: 1fr;
  }
}
`,
  js: `const statusLine = document.getElementById("statusLine");
const stageLine = document.getElementById("stageLine");
const initBtn = document.getElementById("initTest");
const calibrateBtn = document.getElementById("calibrate");

if (initBtn) {
  initBtn.addEventListener("click", () => {
    statusLine.textContent = "Status: Test sequence engaged.";
    stageLine.textContent = "Stage: Active";
  });
}

if (calibrateBtn) {
  calibrateBtn.addEventListener("click", () => {
    statusLine.textContent = "Status: Chamber recalibrated.";
    stageLine.textContent = "Stage: Calibration";
  });
}
`
};

const barnsworthDefaultState = {
  html: `<div class="barnsworth-shell">
  <div class="splatter splatter-a"></div>
  <div class="splatter splatter-b"></div>
  <div class="splatter splatter-c"></div>

  <header class="barnsworth-header">
    <div class="barnsworth-brand">
      <span class="barnsworth-badge">B</span>
      <div>
        <p class="barnsworth-title">Barnsworth Borough</p>
        <p class="barnsworth-subtitle">Operator Preview Console</p>
      </div>
    </div>
    <div class="barnsworth-marquee">
      <span>Thank goodness you're here!</span>
      <span class="marquee-divider">&bull;</span>
      <span>High street alert feed</span>
    </div>
  </header>

  <main class="barnsworth-main tgh-stack">
    <section class="barnsworth-hero tgh-panel">
      <p class="tgh-kicker">High Street Dispatch</p>
      <h1>Morning shift at Barnsworth.</h1>
      <p class="tgh-body">
        Keep the town cheerful, the notices legible, and the queues moving with a
        steady hand and a bright voice.
      </p>
      <div class="tgh-actions">
        <button class="tgh-btn primary" id="barnsworthAction">Ring the bell</button>
        <button class="tgh-btn ghost" id="barnsworthReset">Repaint signs</button>
      </div>
      <p class="barnsworth-status" id="barnsworthStatus">Status: Waiting for a helpful operator.</p>
    </section>

    <aside class="barnsworth-notice tgh-panel">
      <div class="notice-header">
        <span>Town Notice Board</span>
        <span class="notice-tag" id="barnsworthTag">Queued</span>
      </div>
      <ul class="notice-list">
        <li>Market opens at 10:00, bring the brass band.</li>
        <li>Clock tower needs a gentle nudge at noon.</li>
        <li>Red trolley parked outside the bakery again.</li>
        <li>Deliver flyers to the pier before tea time.</li>
      </ul>
      <div class="notice-footer">Hotline: 0140 555 200</div>
    </aside>
  </main>

  <section class="barnsworth-grid tgh-stack">
    <article class="tgh-card">
      <h3>Queue Control</h3>
      <p>Friendly reminders keep the line tidy and the mood light.</p>
      <span class="tgh-stamp">Priority</span>
    </article>
    <article class="tgh-card">
      <h3>Message Wall</h3>
      <p>Rotate the hand-painted signage every two hours.</p>
      <span class="tgh-stamp alt">Fresh</span>
    </article>
    <article class="tgh-card">
      <h3>Shopfront Checks</h3>
      <p>Wave hello, sweep the stoop, press the doorbell.</p>
      <span class="tgh-stamp">Daily</span>
    </article>
  </section>

  <section class="barnsworth-operator tgh-panel">
    <div class="operator-head">
      <h2>Operator Board</h2>
      <span class="operator-pill">Shift 1 / 3</span>
    </div>
    <div class="operator-rows">
      <div class="operator-row">
        <span>Town Mood</span>
        <span class="operator-meter"><span style="width: 74%"></span></span>
        <span class="operator-value">74%</span>
      </div>
      <div class="operator-row">
        <span>Delivery Pace</span>
        <span class="operator-meter"><span style="width: 61%"></span></span>
        <span class="operator-value">61%</span>
      </div>
      <div class="operator-row">
        <span>Sign Clarity</span>
        <span class="operator-meter"><span style="width: 89%"></span></span>
        <span class="operator-value">89%</span>
      </div>
    </div>
  </section>
</div>`,
  css: `@import url("https://fonts.googleapis.com/css2?family=Bungee&family=Nunito:wght@400;600;700&display=swap");

:root {
  --tgh-red: #e04d3a;
  --tgh-blue: #2b6df6;
  --tgh-yellow: #f7c948;
  --tgh-green: #1aa179;
  --tgh-cream: #fff5e5;
  --tgh-ink: #1f1b16;
  --tgh-shadow: 6px 6px 0 #1f1b16;
  --tgh-border: 4px solid #1f1b16;
  --tgh-font-display: "Bungee", cursive;
  --tgh-font-body: "Nunito", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--tgh-font-body);
  background: var(--tgh-cream);
  color: var(--tgh-ink);
}

.barnsworth-shell {
  min-height: 100vh;
  padding: 32px 40px 56px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 18%, rgba(247, 201, 72, 0.35), transparent 45%),
    radial-gradient(circle at 88% 20%, rgba(43, 109, 246, 0.2), transparent 40%),
    linear-gradient(180deg, #fff5e5 0%, #ffe9cf 100%);
}

.barnsworth-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      135deg,
      rgba(31, 27, 22, 0.03) 0,
      rgba(31, 27, 22, 0.03) 2px,
      transparent 2px,
      transparent 8px
    );
  pointer-events: none;
}

.splatter {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  opacity: 0.25;
  filter: blur(1px);
}

.splatter-a {
  background: #f7c948;
  top: -80px;
  right: 8%;
}

.splatter-b {
  background: #2b6df6;
  bottom: -90px;
  left: -40px;
}

.splatter-c {
  background: #e04d3a;
  bottom: 30%;
  right: -90px;
}

.barnsworth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.barnsworth-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.barnsworth-badge {
  width: 56px;
  height: 56px;
  border: var(--tgh-border);
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-family: var(--tgh-font-display);
  background: #fff;
  box-shadow: var(--tgh-shadow);
  font-size: 26px;
}

.barnsworth-title {
  margin: 0;
  font-family: var(--tgh-font-display);
  letter-spacing: 0.04em;
  font-size: 20px;
}

.barnsworth-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.barnsworth-marquee {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border: var(--tgh-border);
  border-radius: 999px;
  background: #fff;
  box-shadow: var(--tgh-shadow);
  font-family: var(--tgh-font-display);
  font-size: 12px;
  text-transform: uppercase;
}

.marquee-divider {
  font-size: 18px;
  color: var(--tgh-red);
}

.barnsworth-main {
  margin-top: 36px;
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(280px, 0.8fr);
  gap: 24px;
  position: relative;
  z-index: 1;
}

.tgh-panel {
  background: #fff;
  border: var(--tgh-border);
  border-radius: 22px;
  padding: 24px;
  box-shadow: var(--tgh-shadow);
}

.tgh-kicker {
  margin: 0;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.3em;
  font-weight: 700;
}

.barnsworth-hero h1 {
  margin: 12px 0 16px;
  font-family: var(--tgh-font-display);
  font-size: clamp(28px, 3.5vw, 42px);
}

.tgh-body {
  margin: 0 0 18px;
  font-size: 16px;
  line-height: 1.6;
}

.tgh-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.tgh-btn {
  border: var(--tgh-border);
  border-radius: 999px;
  padding: 10px 18px;
  font-family: var(--tgh-font-display);
  font-size: 12px;
  text-transform: uppercase;
  background: #fff;
  cursor: pointer;
  box-shadow: var(--tgh-shadow);
  transition: transform 0.2s ease;
}

.tgh-btn:hover {
  transform: translate(-2px, -2px);
}

.tgh-btn.primary {
  background: var(--tgh-yellow);
}

.tgh-btn.ghost {
  background: #fff;
}

.barnsworth-status {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.barnsworth-notice {
  background: #fff8f0;
}

.notice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--tgh-font-display);
  text-transform: uppercase;
  font-size: 12px;
}

.notice-tag {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--tgh-blue);
  color: #fff;
  border: var(--tgh-border);
  font-size: 10px;
  letter-spacing: 0.18em;
}

.notice-tag.pulse {
  animation: pulse 1.6s ease-in-out infinite;
}

.notice-list {
  margin: 18px 0 16px;
  padding-left: 20px;
  display: grid;
  gap: 10px;
  font-size: 14px;
}

.notice-footer {
  font-family: var(--tgh-font-display);
  font-size: 11px;
  text-transform: uppercase;
}

.barnsworth-grid {
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  position: relative;
  z-index: 1;
}

.tgh-card {
  background: #fff;
  border: var(--tgh-border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--tgh-shadow);
  position: relative;
  overflow: hidden;
}

.tgh-card h3 {
  margin: 0 0 10px;
  font-family: var(--tgh-font-display);
  font-size: 16px;
}

.tgh-card p {
  margin: 0 0 20px;
  font-size: 13px;
}

.tgh-stamp {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  border: var(--tgh-border);
  background: var(--tgh-green);
  color: #fff;
  font-family: var(--tgh-font-display);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.tgh-stamp.alt {
  background: var(--tgh-red);
}

.barnsworth-operator {
  margin-top: 28px;
  position: relative;
  z-index: 1;
}

.operator-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.barnsworth-operator h2 {
  margin: 0;
  font-family: var(--tgh-font-display);
  font-size: 18px;
}

.operator-pill {
  padding: 6px 12px;
  border-radius: 999px;
  border: var(--tgh-border);
  background: #fff;
  font-family: var(--tgh-font-display);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.operator-rows {
  display: grid;
  gap: 12px;
}

.operator-row {
  display: grid;
  grid-template-columns: 120px 1fr 48px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
}

.operator-meter {
  height: 12px;
  border-radius: 999px;
  border: var(--tgh-border);
  background: #fff;
  overflow: hidden;
}

.operator-meter span {
  display: block;
  height: 100%;
  background: var(--tgh-blue);
}

.operator-value {
  text-align: right;
  font-family: var(--tgh-font-display);
  font-size: 12px;
}

.tgh-stack > * {
  animation: popIn 0.7s ease both;
}

.tgh-stack > *:nth-child(2) {
  animation-delay: 0.12s;
}

.tgh-stack > *:nth-child(3) {
  animation-delay: 0.24s;
}

.tgh-card {
  animation: float 6s ease-in-out infinite;
}

.tgh-card:nth-child(2) {
  animation-delay: 0.8s;
}

.tgh-card:nth-child(3) {
  animation-delay: 1.6s;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@media (max-width: 900px) {
  .barnsworth-shell {
    padding: 24px;
  }

  .barnsworth-main {
    grid-template-columns: 1fr;
  }

  .barnsworth-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .operator-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .operator-value {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tgh-stack > *,
  .tgh-card,
  .notice-tag.pulse {
    animation: none;
  }
}
`,
  js: `const barnsworthStatus = document.getElementById("barnsworthStatus");
const barnsworthAction = document.getElementById("barnsworthAction");
const barnsworthReset = document.getElementById("barnsworthReset");
const barnsworthTag = document.getElementById("barnsworthTag");

if (barnsworthAction) {
  barnsworthAction.addEventListener("click", () => {
    if (barnsworthStatus) {
      barnsworthStatus.textContent = "Status: Bell rung. The town stirs.";
    }
    if (barnsworthTag) {
      barnsworthTag.textContent = "Active";
      barnsworthTag.classList.add("pulse");
    }
  });
}

if (barnsworthReset) {
  barnsworthReset.addEventListener("click", () => {
    if (barnsworthStatus) {
      barnsworthStatus.textContent = "Status: Signs repainted. Fresh and readable.";
    }
    if (barnsworthTag) {
      barnsworthTag.textContent = "Queued";
      barnsworthTag.classList.remove("pulse");
    }
  });
}
`
};

let renderTimer = null;
let currentLanguage = "en";

const translations = {
  en: {
    modeGiftcard: "Giftcard mode",
    modeThumbnail: "Thumbnail mode",
    modeEditor: "Web Editor",
    logout: "Logout",
    workspace: "Workspace",
    targetPreview: "Target + Preview",
    targetUrl: "Target URL",
    fetchHtml: "Fetch HTML",
    open: "Open",
    fetchHelp: "Fetching is limited by browser CORS rules. Use Load HTML for local files.",
    editorActions: "Editor actions",
    newProject: "New project",
    loadHtml: "Load HTML",
    loadCss: "Load CSS",
    loadJs: "Load JS",
    applyChanges: "Apply changes",
    saveProject: "Save project",
    restoreBackup: "Undo last save",
    operatorLabel: "Operator",
    operatorSelectPlaceholder: "Select operator",
    noOperatorAccess: "You are not connected to any Operators.",
    copyBundle: "Copy bundle",
    downloadBundle: "Download bundle",
    livePreview: "Live preview",
    wrapLines: "Wrap editor lines",
    previewSize: "Preview size",
    previewFit: "Fit container",
    previewDesktop: "Desktop 1200",
    previewLaptop: "Laptop 1024",
    previewTablet: "Tablet 768",
    previewMobile: "Mobile 375",
    status: "Status",
    lastUpdated: "Last updated",
    resetEditors: "Reset editors",
    previewKicker: "Preview",
    liveCanvas: "Live canvas",
    sandbox: "Sandbox",
    editors: "Editors",
    htmlCssJs: "HTML + CSS + JS",
    editorsDescription: "Update code and push changes to the preview.",
    markup: "Markup",
    styles: "Styles",
    behavior: "Behavior",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    editorTargetLabel: "Content source",
    editorTargetWeb: "Web editor",
    editorTargetBanner: "Banner HTML",
    editorTargetFooter: "Footer HTML",
    editorTargetWebTitle: "HTML + CSS + JS",
    editorTargetWebDesc: "Update code and push changes to the preview.",
    editorTargetBannerTitle: "Company banner",
    editorTargetBannerDesc: "Edit the company bannerHtml snippet.",
    editorTargetFooterTitle: "Company footer",
    editorTargetFooterDesc: "Edit the companyFooterHtml snippet."
  },
  sv: {
    modeGiftcard: "Presentkortsl\u00e4ge",
    modeThumbnail: "Miniatyrl\u00e4ge",
    modeEditor: "Webbredigerare",
    logout: "Logga ut",
    workspace: "Arbetsyta",
    targetPreview: "M\u00e5l + F\u00f6rhandsvisning",
    targetUrl: "M\u00e5l-URL",
    fetchHtml: "H\u00e4mta HTML",
    open: "\u00d6ppna",
    fetchHelp: "H\u00e4mtning begr\u00e4nsas av webbl\u00e4sarens CORS-regler. Anv\u00e4nd Ladda HTML f\u00f6r lokala filer.",
    editorActions: "Redigerar\u00e5tg\u00e4rder",
    newProject: "Nytt projekt",
    loadHtml: "Ladda HTML",
    loadCss: "Ladda CSS",
    loadJs: "Ladda JS",
    applyChanges: "Till\u00e4mpa \u00e4ndringar",
    saveProject: "Spara projekt",
    restoreBackup: "\u00c5ngra senaste sparning",
    operatorLabel: "Operat\u00f6r",
    operatorSelectPlaceholder: "V\u00e4lj operat\u00f6r",
    noOperatorAccess: "Du \u00e4r inte kopplad till n\u00e5gra operat\u00f6rer.",
    copyBundle: "Kopiera paket",
    downloadBundle: "Ladda ner paket",
    livePreview: "Live f\u00f6rhandsvisning",
    wrapLines: "Radbryt i editor",
    previewSize: "F\u00f6rhandsstorlek",
    previewFit: "Anpassa till yta",
    previewDesktop: "Skrivbord 1200",
    previewLaptop: "Laptop 1024",
    previewTablet: "Surfplatta 768",
    previewMobile: "Mobil 375",
    status: "Status",
    lastUpdated: "Senast uppdaterad",
    resetEditors: "\u00c5terst\u00e4ll editor",
    previewKicker: "F\u00f6rhandsvisning",
    liveCanvas: "Live canvas",
    sandbox: "Sandbox",
    editors: "Editorer",
    htmlCssJs: "HTML + CSS + JS",
    editorsDescription: "Uppdatera kod och skicka \u00e4ndringar till f\u00f6rhandsvisningen.",
    markup: "Markup",
    styles: "Stilar",
    behavior: "Beteende",
    lightMode: "Ljust l\u00e4ge",
    darkMode: "M\u00f6rkt l\u00e4ge",
    editorTargetLabel: "Inneh\u00e5ll",
    editorTargetWeb: "Webbredigerare",
    editorTargetBanner: "Banner HTML",
    editorTargetFooter: "Footer HTML",
    editorTargetWebTitle: "HTML + CSS + JS",
    editorTargetWebDesc: "Uppdatera kod och skicka \u00e4ndringar till f\u00f6rhandsvisningen.",
    editorTargetBannerTitle: "F\u00f6retagsbanner",
    editorTargetBannerDesc: "Redigera f\u00f6retagsf\u00e4ltet bannerHtml.",
    editorTargetFooterTitle: "F\u00f6retagsfooter",
    editorTargetFooterDesc: "Redigera f\u00f6retagsf\u00e4ltet companyFooterHtml."
  }
};

function getTranslation(key) {
  const dictionary = translations[currentLanguage] || translations.en;
  return dictionary[key] || key;
}

function escapeScript(content) {
  return content.replace(/<\/script>/gi, "<\\/script>");
}

const navigationGuardCode = `(() => {
  const lockHistory = () => {
    try {
      const noop = () => null;
      history.pushState = noop;
      history.replaceState = noop;
    } catch {
      // Ignore if not permitted.
    }
  };

  const isModifiedClick = (event) =>
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey;

  document.addEventListener(
    "click",
    (event) => {
      if (isModifiedClick(event)) {
        return;
      }
      const anchor = event.target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) {
        return;
      }
      event.preventDefault();
    },
    true
  );

  document.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
    },
    true
  );

  try {
    const noop = () => null;
    window.open = noop;
    if (window.location && window.location.assign) {
      window.location.assign = noop;
    }
    if (window.location && window.location.replace) {
      window.location.replace = noop;
    }
  } catch {
    // Ignore if the browser blocks reassignment.
  }

  lockHistory();
})();`;

function getNavigationGuardTag() {
  return `<script>${escapeScript(navigationGuardCode)}<\/script>`;
}

function attachNavigationGuards() {
  const frameWindow = previewFrame.contentWindow;
  const frameDocument = previewFrame.contentDocument;
  if (!frameWindow || !frameDocument) {
    return;
  }

  if (frameDocument.__navigationGuardInstalled) {
    return;
  }
  frameDocument.__navigationGuardInstalled = true;

  const isModifiedClick = (event) =>
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey;

  frameDocument.addEventListener(
    "click",
    (event) => {
      if (isModifiedClick(event)) {
        return;
      }
      const anchor = event.target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) {
        return;
      }
      event.preventDefault();
    },
    true
  );

  frameDocument.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
    },
    true
  );

  try {
    const noop = () => null;
    frameWindow.open = noop;
    if (frameWindow.location && frameWindow.location.assign) {
      frameWindow.location.assign = noop;
    }
    if (frameWindow.location && frameWindow.location.replace) {
      frameWindow.location.replace = noop;
    }
  } catch {
    // Ignore if the browser blocks reassignment.
  }

  try {
    const noop = () => null;
    frameWindow.history.pushState = noop;
    frameWindow.history.replaceState = noop;
  } catch {
    // Ignore if the browser blocks reassignment.
  }
}

function injectAssetsIntoHtml(html, css, js) {
  let output = html;
  const safeJs = escapeScript(js);
  const navigationGuardTag = getNavigationGuardTag();

  if (css.trim()) {
    if (output.includes("</head>")) {
      output = output.replace("</head>", `<style>${css}</style></head>`);
    } else {
      output = `<style>${css}</style>` + output;
    }
  }

  const scripts = `${safeJs.trim() ? `<script>${safeJs}<\/script>` : ""}${navigationGuardTag}`;
  if (output.includes("</body>")) {
    output = output.replace("</body>", `${scripts}</body>`);
  } else {
    output += scripts;
  }

  return output;
}

function buildSrcDoc() {
  const previewState = getPreviewState();
  const html = previewState.html.trim();
  const css = previewState.css;
  const js = previewState.js;

  if (html.toLowerCase().includes("<html") || html.toLowerCase().includes("<!doctype")) {
    return injectAssetsIntoHtml(html, css, js);
  }

  const safeJs = escapeScript(js);
  const navigationGuardTag = getNavigationGuardTag();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${safeJs}<\/script>
    ${navigationGuardTag}
  </body>
</html>`;
}

function getPreviewHtmlForTarget(target) {
  if (activeEditorTarget === target) {
    return htmlInput.value || "";
  }
  const saved = getSavedStateForTarget(target);
  if (saved && typeof saved.html === "string") {
    return saved.html;
  }
  if (target === "web") {
    return getDefaultStateForOperator(activeOperatorId).html || "";
  }
  const companyMarkup = getCompanyMarkupForTarget(target);
  return companyMarkup.html || "";
}

function getPreviewWebState() {
  if (activeEditorTarget === "web") {
    return getEditorState();
  }
  const saved = getSavedStateForTarget("web");
  if (saved) return saved;
  return getDefaultStateForOperator(activeOperatorId);
}

function getPreviewState() {
  const bannerHtml = getPreviewHtmlForTarget("banner");
  const footerHtml = getPreviewHtmlForTarget("footer");
  const webState = getPreviewWebState();
  const mainHtml = webState.html || "";

  const combinedHtml = `
<header class="company-banner">
${bannerHtml}
</header>
<main class="company-main">
${mainHtml}
</main>
<footer class="company-footer">
${footerHtml}
</footer>
`;

  return {
    html: combinedHtml,
    css: webState.css || "",
    js: webState.js || ""
  };
}

function setStatus(message, status = "info") {
  statusPill.textContent = message;
  statusPill.dataset.status = status;
}

function updateTimestamp() {
  const now = new Date();
  lastUpdate.textContent = now.toLocaleTimeString();
}

function handleFrameLoad() {
  attachNavigationGuards();
  const href = previewFrame.contentWindow?.location?.href || "";
  const isSrcDoc = href.startsWith("about:srcdoc") || href.startsWith("about:blank");
  if (!isSrcDoc) {
    previewFrame.srcdoc = buildSrcDoc();
  }
}

function renderPreview() {
  previewFrame.srcdoc = buildSrcDoc();
  setStatus("Preview updated", "ok");
  updateTimestamp();
}

function scheduleRender() {
  if (!livePreviewToggle.checked) {
    return;
  }
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }
  renderTimer = window.setTimeout(renderPreview, 300);
}

function getDefaultStateForOperator(operatorId) {
  const normalized = (operatorId || "").toLowerCase();
  if (normalized === "apature") {
    return apatureDefaultState;
  }
  if (normalized === "barnsworth") {
    return barnsworthDefaultState;
  }
  return defaultState;
}

async function resetEditors() {
  if (activeEditorTarget === "web") {
    applyEditorState(getDefaultStateForOperator(activeOperatorId));
    return;
  }
  await loadCompanyMarkupTarget(activeEditorTarget);
}

function getEditorState() {
  return {
    html: htmlInput.value,
    css: cssInput.value,
    js: jsInput.value,
    savedAt: new Date().toISOString()
  };
}

function applyEditorState(state) {
  if (!state) return;
  htmlInput.value = state.html ?? "";
  cssInput.value = state.css ?? "";
  jsInput.value = state.js ?? "";
  renderPreview();
}

function getSavedState() {
  return readSavedState(editorSaveKey);
}

function getStorageKeysForTarget(scope, target) {
  const normalizedScope = scope ? scope.toLowerCase() : "";
  const normalizedTarget = normalizeEditorTarget(target);
  const baseSaveKey =
    !normalizedScope || normalizedScope === "admin"
      ? defaultEditorSaveKey
      : `${defaultEditorSaveKey}:${normalizedScope}`;
  const baseBackupKey =
    !normalizedScope || normalizedScope === "admin"
      ? defaultEditorBackupKey
      : `${defaultEditorBackupKey}:${normalizedScope}`;

  if (normalizedTarget !== "web") {
    return {
      saveKey: `${baseSaveKey}:${normalizedTarget}`,
      backupKey: `${baseBackupKey}:${normalizedTarget}`
    };
  }

  return { saveKey: baseSaveKey, backupKey: baseBackupKey };
}

function readSavedState(saveKey) {
  try {
    const raw = localStorage.getItem(saveKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.html === "string" && typeof parsed.css === "string" && typeof parsed.js === "string") {
      return parsed;
    }
  } catch {
    // Ignore storage failures.
  }
  return null;
}

function getSavedStateForTarget(target) {
  const keys = getStorageKeysForTarget(activeOperatorId, target);
  return readSavedState(keys.saveKey);
}

function setSavedState(state) {
  try {
    localStorage.setItem(editorSaveKey, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

function getBackups() {
  try {
    const raw = localStorage.getItem(editorBackupKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setBackups(backups) {
  try {
    localStorage.setItem(editorBackupKey, JSON.stringify(backups));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeEditorTarget(value) {
  const normalized = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (normalized === "banner" || normalized === "footer") return normalized;
  return "web";
}

function getStoredEditorTarget() {
  try {
    return localStorage.getItem(editorTargetStorageKey) || "";
  } catch {
    return "";
  }
}

function setStoredEditorTarget(value) {
  try {
    localStorage.setItem(editorTargetStorageKey, value);
  } catch {
    // Ignore storage failures.
  }
}

function updateEditorTargetUI() {
  const target = activeEditorTarget;
  editorTargetButtons.forEach((button) => {
    const isActive = button.dataset.editorTarget === target;
    button.classList.toggle("active", isActive);
  });
  if (jsEditorSection) {
    jsEditorSection.hidden = target !== "web";
  }
  if (detailPanelTitle) {
    const titleKey =
      target === "banner"
        ? "editorTargetBannerTitle"
        : target === "footer"
          ? "editorTargetFooterTitle"
          : "editorTargetWebTitle";
    detailPanelTitle.textContent = getTranslation(titleKey);
  }
  if (detailPanelDescription) {
    const descKey =
      target === "banner"
        ? "editorTargetBannerDesc"
        : target === "footer"
          ? "editorTargetFooterDesc"
          : "editorTargetWebDesc";
    detailPanelDescription.textContent = getTranslation(descKey);
  }
}

async function fetchCompanies() {
  try {
    const response = await fetch(giftcardMakerCompaniesUrl, { credentials: "include" });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : data?.data || data?.companies || null;
  } catch {
    return null;
  }
}

function buildCompanyMatchCandidates() {
  const candidates = new Set();
  if (activeOperatorId) {
    candidates.add(activeOperatorId.trim().toLowerCase());
  }
  const status = currentAuthStatus;
  const operatorId = normalizeOperatorId(status?.operatorId);
  if (operatorId) {
    candidates.add(operatorId.toLowerCase());
  }
  parseOperatorIds(status?.operatorIds).forEach((id) => {
    if (id) candidates.add(id.toLowerCase());
  });
  return Array.from(candidates.values());
}

function findCompanyForOperator(companies, candidates) {
  if (!Array.isArray(companies) || companies.length === 0) return null;
  if (companies.length === 1) return companies[0];
  if (!candidates.length) return null;

  const normalizedCandidates = candidates.map((value) => value.toLowerCase());
  const exactIdMatch = companies.find((company) => {
    const id = typeof company?.id === "string" ? company.id.trim().toLowerCase() : "";
    return id && normalizedCandidates.includes(id);
  });
  if (exactIdMatch) return exactIdMatch;

  const exactMatch = companies.find((company) => {
    const name = typeof company?.companyName === "string" ? company.companyName.trim().toLowerCase() : "";
    return name && normalizedCandidates.includes(name);
  });
  if (exactMatch) return exactMatch;

  return companies.find((company) => {
    const name = typeof company?.companyName === "string" ? company.companyName.trim().toLowerCase() : "";
    if (!name) return false;
    return normalizedCandidates.some((candidate) => name.includes(candidate));
  });
}

function extractInlineStyles(markup) {
  if (typeof markup !== "string" || markup.trim() === "") {
    return { html: "", css: "" };
  }
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssParts = [];
  let match;
  while ((match = styleRegex.exec(markup)) !== null) {
    if (match[1]) {
      const trimmed = match[1].trim();
      if (trimmed) {
        cssParts.push(trimmed);
      }
    }
  }
  const cleanedHtml = markup.replace(styleRegex, "").trim();
  return {
    html: cleanedHtml,
    css: cssParts.join("\n\n")
  };
}

async function loadCompanyMarkupCache(force = false) {
  if (companyCacheLoaded && !force) return true;
  const companies = await fetchCompanies();
  if (!companies) {
    return false;
  }
  const candidates = buildCompanyMatchCandidates();
  const company = findCompanyForOperator(companies, candidates);
  if (!company) {
    return false;
  }

  activeCompanyId = typeof company.id === "string" ? company.id : "";
  companyMarkupCache = {
    bannerHtml: typeof company.bannerHtml === "string" ? company.bannerHtml : "",
    companyFooterHtml: typeof company.companyFooterHtml === "string" ? company.companyFooterHtml : ""
  };
  companyCacheLoaded = true;
  return true;
}

function getCompanyMarkupForTarget(target) {
  const markup =
    target === "banner"
      ? companyMarkupCache.bannerHtml
      : target === "footer"
        ? companyMarkupCache.companyFooterHtml
        : "";
  return extractInlineStyles(markup || "");
}

function combineCompanyMarkup(html, css) {
  const trimmedCss = typeof css === "string" ? css.trim() : "";
  const trimmedHtml = typeof html === "string" ? html.trim() : "";
  if (!trimmedCss) {
    return trimmedHtml;
  }
  return `<style>${trimmedCss}</style>\n${trimmedHtml}`;
}

function buildCompanyUpdatePayload(target, html, css) {
  const combined = combineCompanyMarkup(html, css);
  if (target === "banner") {
    return { bannerHtml: combined };
  }
  if (target === "footer") {
    return { companyFooterHtml: combined };
  }
  return null;
}

async function patchCompanyMarkup(payload) {
  if (!payload) return false;
  if (!activeCompanyId) {
    setStatus("Company match not found for this operator.", "error");
    return false;
  }
  try {
    const response = await fetch(`${giftcardMakerCompaniesUrl}/${encodeURIComponent(activeCompanyId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload),
      credentials: "include"
    });
    if (!response.ok) {
      setStatus("Company update failed.", "error");
      return false;
    }
    if (payload.bannerHtml !== undefined) {
      companyMarkupCache.bannerHtml = payload.bannerHtml;
    }
    if (payload.companyFooterHtml !== undefined) {
      companyMarkupCache.companyFooterHtml = payload.companyFooterHtml;
    }
    companyCacheLoaded = true;
    return true;
  } catch {
    setStatus("Company update failed.", "error");
    return false;
  }
}

async function loadCompanyMarkupTarget(target) {
  const loaded = await loadCompanyMarkupCache();
  if (!loaded) {
    activeCompanyId = "";
    setStatus("Could not load company HTML.", "error");
    return false;
  }

  const extracted = getCompanyMarkupForTarget(target);
  applyEditorState({
    html: extracted.html,
    css: extracted.css,
    js: ""
  });
  return true;
}

async function loadEditorTargetContent() {
  if (loadSavedState()) {
    return true;
  }

  if (activeEditorTarget === "web") {
    applyEditorState(getDefaultStateForOperator(activeOperatorId));
    return false;
  }

  const loaded = await loadCompanyMarkupTarget(activeEditorTarget);
  if (!loaded) {
    applyEditorState({ html: "", css: "", js: "" });
  }
  return loaded;
}

async function setEditorTarget(target, { announce = true } = {}) {
  const normalized = normalizeEditorTarget(target);
  if (normalized === activeEditorTarget) {
    return;
  }
  activeEditorTarget = normalized;
  setStoredEditorTarget(activeEditorTarget);
  setStorageScope(activeOperatorId);
  updateEditorTargetUI();
  await loadEditorTargetContent();
  if (announce) {
    setStatus(`Editor target set to ${activeEditorTarget}`, "info");
  }
}

async function saveProject() {
  const current = getEditorState();

  if (activeEditorTarget !== "web") {
    const payload = buildCompanyUpdatePayload(activeEditorTarget, current.html, current.css);
    const updated = await patchCompanyMarkup(payload);
    if (!updated) {
      return;
    }
  }

  const existing = getSavedState();
  if (existing) {
    const backups = getBackups();
    backups.push(existing);
    if (backups.length > 10) {
      backups.splice(0, backups.length - 10);
    }
    setBackups(backups);
  }
  setSavedState(current);
  setStatus(activeEditorTarget === "web" ? "Project saved" : "Company HTML updated", "ok");
  updateTimestamp();
}

function restoreBackup() {
  const backups = getBackups();
  if (!backups.length) {
    setStatus("No backup available", "error");
    return;
  }
  const previous = backups.pop();
  setBackups(backups);
  setSavedState(previous);
  applyEditorState(previous);
  setStatus("Restored previous save", "ok");
  updateTimestamp();
}

function loadSavedState() {
  const saved = getSavedState();
  if (saved) {
    applyEditorState(saved);
    setStatus("Loaded saved project", "info");
    updateTimestamp();
    return true;
  }
  return false;
}

function toggleWrap() {
  if (wrapToggle.checked) {
    editorPanel.classList.add("wrap-code");
  } else {
    editorPanel.classList.remove("wrap-code");
  }
}

function setPreviewSize(value) {
  if (value === "fit") {
    previewStage.style.maxWidth = "none";
  } else {
    previewStage.style.maxWidth = `${value}px`;
  }
}

function loadFileIntoInput(file, target) {
  const reader = new FileReader();
  reader.onload = () => {
    target.value = reader.result;
    setStatus(`Loaded ${file.name}`, "info");
    scheduleRender();
  };
  reader.onerror = () => {
    setStatus("File load failed", "error");
  };
  reader.readAsText(file);
}

function handleFileInput(event, target) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  loadFileIntoInput(file, target);
  event.target.value = "";
}


function updateThemeLabel() {
  if (!themeToggleBtn) return;
  const isAlt = document.body.classList.contains("light-mode");
  const language = translations[currentLanguage] || translations.en;
  themeToggleBtn.textContent = isAlt ? language.darkMode : language.lightMode;
}

async function fetchAuthStatus() {
  try {
    const response = await fetch(giftcardMakerAuthStatusUrl, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function parseOperatorIds(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\s;|]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function hasAdminAccess(status) {
  const role = typeof status?.role === "string" ? status.role.toLowerCase() : "";
  if (role === "admin") return true;
  const operatorId = normalizeOperatorId(status?.operatorId).toLowerCase();
  if (operatorId === "admin") return true;
  return parseOperatorIds(status?.operatorIds).some((id) => id.toLowerCase() === "admin");
}

function resolveOperatorScope(status) {
  if (!status) return "";
  const operatorId = typeof status.operatorId === "string" ? status.operatorId.trim() : "";
  if (operatorId) {
    return operatorId;
  }
  const operatorIds = parseOperatorIds(status.operatorIds);
  if (operatorIds.length === 1) {
    return operatorIds[0];
  }
  if (operatorIds.includes("showtic")) {
    return "showtic";
  }
  if (operatorIds.length > 0) {
    return operatorIds[0];
  }
  if (status.role && status.role.toLowerCase() === "admin") {
    return "admin";
  }
  return "";
}

function setStorageScope(scope) {
  const normalized = scope ? scope.toLowerCase() : "";
  activeOperatorId = normalized;
  const baseSaveKey =
    !normalized || normalized === "admin"
      ? defaultEditorSaveKey
      : `${defaultEditorSaveKey}:${normalized}`;
  const baseBackupKey =
    !normalized || normalized === "admin"
      ? defaultEditorBackupKey
      : `${defaultEditorBackupKey}:${normalized}`;

  if (activeEditorTarget === "web") {
    editorSaveKey = baseSaveKey;
    editorBackupKey = baseBackupKey;
  } else {
    editorSaveKey = `${baseSaveKey}:${activeEditorTarget}`;
    editorBackupKey = `${baseBackupKey}:${activeEditorTarget}`;
  }
}

function normalizeOperatorId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getAvailableOperators(status) {
  const operators = new Map();
  const operatorId = normalizeOperatorId(status?.operatorId);
  if (operatorId) {
    operators.set(operatorId.toLowerCase(), operatorId);
  }
  parseOperatorIds(status?.operatorIds).forEach((id) => {
    if (id) {
      operators.set(id.toLowerCase(), id);
    }
  });
  if (hasAdminAccess(status)) {
    placeholderOperatorIds.forEach((id) => {
      operators.set(id.toLowerCase(), id);
    });
  }
  return Array.from(operators.values());
}

function getStoredOperatorSelection() {
  try {
    return localStorage.getItem(operatorSelectionKey) || "";
  } catch {
    return "";
  }
}

function setStoredOperatorSelection(value) {
  try {
    localStorage.setItem(operatorSelectionKey, value);
  } catch {
    // Ignore storage failures.
  }
}

function setOperatorAccessState(hasAccess) {
  if (layoutMain) {
    layoutMain.hidden = !hasAccess;
  }
  operatorScopedPanels.forEach((panel) => {
    panel.hidden = !hasAccess;
  });
  if (!hasAccess && operatorSwitch) {
    operatorSwitch.hidden = true;
  }
  if (operatorEmptyState) {
    operatorEmptyState.hidden = hasAccess;
  }
}

function pickInitialOperator(status, operators) {
  if (!operators.length) {
    return resolveOperatorScope(status);
  }

  const stored = getStoredOperatorSelection();
  if (stored && operators.some((id) => id.toLowerCase() === stored.toLowerCase())) {
    return stored;
  }

  const operatorId = normalizeOperatorId(status?.operatorId);
  if (operatorId && operators.some((id) => id.toLowerCase() === operatorId.toLowerCase())) {
    return operatorId;
  }

  if (operators.includes("showtic")) {
    return "showtic";
  }

  return operators[0];
}

async function applyOperatorSelection(scope, { announce = true } = {}) {
  setStorageScope(scope);
  await loadEditorTargetContent();
  if (announce) {
    const label = scope || "default";
    setStatus(`Operator set to ${label}`, "info");
  }
}

function setupOperatorSwitch(status) {
  if (!operatorSwitch || !operatorSelect) return;

  const operators = getAvailableOperators(status);
  const hasAccess = operators.length > 0;
  setOperatorAccessState(hasAccess);
  if (!hasAccess) {
    operatorSwitch.hidden = true;
    return { handledLoad: false, hasAccess: false, scope: "" };
  }
  if (operators.length <= 1) {
    operatorSwitch.hidden = true;
    const scope = resolveOperatorScope(status);
    setStorageScope(scope);
    return { handledLoad: false, hasAccess: true, scope };
  }

  operatorSwitch.hidden = false;
  operatorSelect.innerHTML = "";
  operators.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    operatorSelect.appendChild(option);
  });

  const initial = pickInitialOperator(status, operators);
  operatorSelect.value = initial;
  setStoredOperatorSelection(initial);
  setStorageScope(initial);

  operatorSelect.addEventListener("change", (event) => {
    const selected = event.target.value;
    if (!selected) return;
    setStoredOperatorSelection(selected);
    void applyOperatorSelection(selected);
  });

  return { handledLoad: true, hasAccess: true, scope: initial };
}

function getPreferredTheme() {
  try {
    const saved = localStorage.getItem(themeStorageKey);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore storage failures and fall back to system/default.
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return "dark";
}

function applyTheme(theme) {
  const resolvedTheme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("light-mode", resolvedTheme === "light");
  updateThemeLabel();
}

function updateLanguageToggleLabel() {
  languageToggleBtn.textContent = currentLanguage === "en" ? "Svenska" : "English";
}

function getPreferredPreviewHeight() {
  try {
    const stored = localStorage.getItem(previewHeightStorageKey);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage failures.
  }
  return null;
}

function applyPreviewHeight(height) {
  const minHeight = 320;
  const maxHeight = 1400;
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
  previewFrame.style.height = `${nextHeight}px`;
  previewResizeHandle.setAttribute("aria-valuenow", String(nextHeight));
}

function setupPreviewResize() {
  if (!previewResizeHandle) return;

  previewResizeHandle.setAttribute("aria-valuemin", "320");
  previewResizeHandle.setAttribute("aria-valuemax", "1400");

  const storedHeight = getPreferredPreviewHeight();
  const initialHeight = storedHeight ?? previewFrame.getBoundingClientRect().height;
  applyPreviewHeight(initialHeight);

  previewResizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    previewResizeHandle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = previewFrame.getBoundingClientRect().height;

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientY - startY;
      applyPreviewHeight(startHeight + delta);
    };

    const onUp = () => {
      previewResizeHandle.removeEventListener("pointermove", onMove);
      previewResizeHandle.removeEventListener("pointerup", onUp);
      previewResizeHandle.removeEventListener("pointercancel", onUp);
      try {
        const finalHeight = previewFrame.getBoundingClientRect().height;
        localStorage.setItem(previewHeightStorageKey, String(Math.round(finalHeight)));
      } catch {
        // Ignore storage failures.
      }
    };

    previewResizeHandle.addEventListener("pointermove", onMove);
    previewResizeHandle.addEventListener("pointerup", onUp);
    previewResizeHandle.addEventListener("pointercancel", onUp);
  });

  previewResizeHandle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 50 : 20;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      applyPreviewHeight(previewFrame.getBoundingClientRect().height - step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      applyPreviewHeight(previewFrame.getBoundingClientRect().height + step);
    }
    try {
      const finalHeight = previewFrame.getBoundingClientRect().height;
      localStorage.setItem(previewHeightStorageKey, String(Math.round(finalHeight)));
    } catch {
      // Ignore storage failures.
    }
  });
}

function clearEditorFocus() {
  const activeSection = document.querySelector(".editor-section.is-expanded");
  if (activeSection) {
    activeSection.classList.remove("is-expanded");
    activeSection.removeAttribute("aria-expanded");
    const originalPosition = editorSectionPositions.get(activeSection);
    if (originalPosition && originalPosition.parent) {
      originalPosition.parent.insertBefore(activeSection, originalPosition.nextSibling);
    }
  }
  document.body.classList.remove("editor-focus");
  if (editorFocusOverlay) {
    editorFocusOverlay.hidden = true;
  }
}

function focusEditorSection(section) {
  if (!section) return;
  if (section.classList.contains("is-expanded") && document.body.classList.contains("editor-focus")) {
    return;
  }
  const activeSection = document.querySelector(".editor-section.is-expanded");
  if (activeSection && activeSection !== section) {
    activeSection.classList.remove("is-expanded");
    activeSection.removeAttribute("aria-expanded");
    const originalPosition = editorSectionPositions.get(activeSection);
    if (originalPosition && originalPosition.parent) {
      originalPosition.parent.insertBefore(activeSection, originalPosition.nextSibling);
    }
  }
  if (!editorSectionPositions.has(section)) {
    editorSectionPositions.set(section, { parent: section.parentNode, nextSibling: section.nextSibling });
  }
  if (section.parentNode !== document.body) {
    document.body.appendChild(section);
  }
  section.classList.add("is-expanded");
  section.setAttribute("aria-expanded", "true");
  document.body.classList.add("editor-focus");
  if (editorFocusOverlay) {
    editorFocusOverlay.hidden = false;
  }
}

function setupEditorFocus() {
  if (!editorSections.length) return;

  editorFocusButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const section = button.closest(".editor-section");
      focusEditorSection(section);
    });
  });

  if (editorFocusOverlay) {
    editorFocusOverlay.addEventListener("click", clearEditorFocus);
  }

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("editor-focus")) return;
    const activeSection = document.querySelector(".editor-section.is-expanded");
    if (!activeSection) return;
    if (activeSection.contains(event.target)) return;
    clearEditorFocus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!document.body.classList.contains("editor-focus")) return;
    event.preventDefault();
    clearEditorFocus();
  });
}

function applyTranslations() {
  const dictionary = translations[currentLanguage] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (dictionary[key]) {
      node.textContent = dictionary[key];
    }
  });
  updateThemeLabel();
  updateLanguageToggleLabel();
  updateEditorTargetUI();
}

function setupLogoutButton() {
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try {
      await fetch(giftcardMakerLogoutUrl, {
        method: "POST",
        headers: {
          accept: "application/json"
        },
        credentials: "include"
      });
    } catch {
      // Redirect regardless to avoid trapping the user in a stale session.
    } finally {
      window.location.href = "/login";
    }
  });
}

async function initializeStorageScope() {
  const status = await fetchAuthStatus();
  currentAuthStatus = status;
  if (!status) {
    setOperatorAccessState(false);
    return { hasAccess: false };
  }
  const storedTarget = normalizeEditorTarget(getStoredEditorTarget());
  activeEditorTarget = storedTarget;
  const scope = resolveOperatorScope(status);
  setStorageScope(scope);
  updateEditorTargetUI();
  const handledLoad = setupOperatorSwitch(status);
  if (!handledLoad?.hasAccess) {
    return { hasAccess: false };
  }
  void loadCompanyMarkupCache().then((loaded) => {
    if (loaded) {
      renderPreview();
    }
  });
  await loadEditorTargetContent();
  return { hasAccess: true };
}

async function initializeApp() {
  toggleWrap();
  setPreviewSize(previewSizeSelect.value);
  const scopeInfo = await initializeStorageScope();
  if (!scopeInfo?.hasAccess) {
    const storedLanguage = localStorage.getItem("giftv3-language");
    if (storedLanguage && translations[storedLanguage]) {
      currentLanguage = storedLanguage;
    }
    applyTheme(getPreferredTheme());
    applyTranslations();
    setupLogoutButton();
    return;
  }
  const storedLanguage = localStorage.getItem("giftv3-language");
  if (storedLanguage && translations[storedLanguage]) {
    currentLanguage = storedLanguage;
  }
  applyTheme(getPreferredTheme());
  applyTranslations();
  setupPreviewResize();
  setupEditorFocus();
  setupLogoutButton();
}

htmlInput.addEventListener("input", scheduleRender);
cssInput.addEventListener("input", scheduleRender);
jsInput.addEventListener("input", scheduleRender);

applyBtn.addEventListener("click", renderPreview);
if (saveProjectBtn) {
  saveProjectBtn.addEventListener("click", saveProject);
}
if (restoreBackupBtn) {
  restoreBackupBtn.addEventListener("click", restoreBackup);
}
resetBtn.addEventListener("click", resetEditors);

livePreviewToggle.addEventListener("change", () => {
  if (livePreviewToggle.checked) {
    renderPreview();
  }
});

wrapToggle.addEventListener("change", toggleWrap);
previewSizeSelect.addEventListener("change", (event) => setPreviewSize(event.target.value));

editorTargetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.editorTarget;
    void setEditorTarget(target);
  });
});

loadHtmlInput.addEventListener("change", (event) => handleFileInput(event, htmlInput));
loadCssInput.addEventListener("change", (event) => handleFileInput(event, cssInput));
loadJsInput.addEventListener("change", (event) => handleFileInput(event, jsInput));

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("light-mode") ? "dark" : "light";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // Ignore storage failures; theme still applies for the session.
    }
  });
}

languageToggleBtn.addEventListener("click", () => {
  currentLanguage = currentLanguage === "en" ? "sv" : "en";
  localStorage.setItem("giftv3-language", currentLanguage);
  applyTranslations();
});

previewFrame.addEventListener("load", handleFrameLoad);

initializeApp();

