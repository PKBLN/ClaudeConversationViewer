// Hilfsfunktion: Script dynamisch laden (z.B. marked.js)
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function safe(val) { return val == null ? '' : String(val); }
function parseDate(d) { const t = Date.parse(d || ''); return isNaN(t) ? 0 : t; }
function formatIsoLike(s) {
  const str = safe(s);
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  const t = parseDate(str);
  if (!t) return '';
  const d = new Date(t);
  const pad = n => String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth()+1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

// I18n
let gLang = 'de';
const I18N = {
  de: {
    title: 'Conversations Export',
    pickFile: 'JSON-Datei auswählen:',
    pleasePick: 'Bitte JSON-Datei auswählen.',
    sortBy: 'Sortieren nach:',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    asc: 'aufsteigend',
    desc: 'absteigend',
    toc: 'Inhaltsverzeichnis',
    chatMessages: 'ChatMessages',
    contentBlocks: 'Content Blocks',
    toolInput: 'Tool Input',
    toolInputContent: 'Tool Input Content',
    moreToolFields: 'Weitere Tool-Input-Felder',
    citations: 'Citations',
    displayContentItems: 'Display Content Items',
    innerContent: 'Inner Content',
    blockDetails: 'Block-Details',
    displayContent: 'Display Content',
    copyAnswer: 'Antwort kopieren',
    copyTool: 'Tool-Content kopieren',
    copied: 'Kopiert!',
    copyFailed: 'Kopieren fehlgeschlagen.',
    openHtml: 'HTML in neuem Fenster öffnen',
    runJs: 'JavaScript in neuem Fenster ausführen',
    fileReadError: 'Fehler beim Lesen der Datei.',
    fileParseError: 'Fehler beim Einlesen der lokalen Datei: ',
    languageLabel: 'Sprache:',
    references: 'Referenzen',
    hasArtifacts: 'Artifacts vorhanden',
    codeViewerTitle: 'Code-Ansicht',
    preview: 'Vorschau',
    showCode: 'Code anzeigen',
    copyCode: 'Code kopieren',
    previewNotAvailable: 'Vorschau für diesen Inhaltstyp nicht verfügbar.'
  },
  en: {
    title: 'Conversations Export',
    pickFile: 'Select JSON file:',
    pleasePick: 'Please select a JSON file.',
    sortBy: 'Sort by:',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    asc: 'ascending',
    desc: 'descending',
    toc: 'Table of Contents',
    chatMessages: 'ChatMessages',
    contentBlocks: 'Content Blocks',
    toolInput: 'Tool Input',
    toolInputContent: 'Tool Input Content',
    moreToolFields: 'Additional tool input fields',
    citations: 'Citations',
    displayContentItems: 'Display Content Items',
    innerContent: 'Inner Content',
    blockDetails: 'Block details',
    displayContent: 'Display Content',
    copyAnswer: 'Copy answer',
    copyTool: 'Copy tool content',
    copied: 'Copied!',
    copyFailed: 'Copy failed.',
    openHtml: 'Open HTML in a new window',
    runJs: 'Run JavaScript in a new window',
    fileReadError: 'Error reading the file.',
    fileParseError: 'Error parsing local file: ',
    languageLabel: 'Language:',
    references: 'References',
    hasArtifacts: 'Artifacts present',
    codeViewerTitle: 'Code Viewer',
    preview: 'Preview',
    showCode: 'Show code',
    copyCode: 'Copy code',
    previewNotAvailable: 'Preview not available for this content type.'
  }
};
function t(key){ const dict = I18N[gLang]||I18N.de; return dict[key] || key; }

// Sortierzustand global
let gData = [];
let gSortField = 'created_at'; // 'created_at' | 'updated_at'
let gSortDir = 'desc'; // 'asc' | 'desc'

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

// Leichtes Syntax-Highlighting (HTML & JS) auch für Inline-Anzeige
function highlightHtml(src) {
  try {
    let s = escapeHtml(String(src || ''));
    // Tags mit Attributen hervorheben
    s = s.replace(/(&lt;\/?)([a-zA-Z0-9:-]+)([^&]*?)(\/?&gt;)/g, (m, a, tag, rest, b) => {
      const restHl = rest
        .replace(/(\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*)/g, '<span class="attr">$1</span>')
        .replace(/(=)("[^"]*"|'[^']*')/g, '$1<span class="str">$2</span>');
      return `<span class="punc">${a}</span><span class="tag">${tag}</span>${restHl}<span class="punc">${b}</span>`;
    });
    // Kommentare
    s = s.replace(/&lt;!--([\s\S]*?)--&gt;/g, '<span class="com">&lt;!--$1--&gt;</span>');
    return s;
  } catch (_) { return escapeHtml(String(src||'')); }
}
function highlightJs(src) {
  try {
    let s = escapeHtml(String(src || ''));
    s = s.replace(/(\/\/.*?$)/gm, '<span class="com">$1</span>');
    s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="com">$1</span>');
    s = s.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '<span class="str">$&</span>');
    s = s.replace(/\b(const|let|var|function|return|if|else|for|while|break|continue|switch|case|default|try|catch|finally|new|class|extends|super|this|throw|import|from|export|async|await)\b/g, '<span class="kw">$1</span>');
    s = s.replace(/\b(true|false|null|undefined)\b/g, '<span class="lit">$1</span>');
    return s;
  } catch (_) { return escapeHtml(String(src||'')); }
}

// Öffnet einen Code-Viewer in neuem Fenster mit Syntax-Highlighting und optionaler Vorschau
function openCodeViewer(code, opts = {}) {
  try {
    const c = typeof code === 'string' ? code : String(code || '');
    const type = (opts.type || 'auto').toLowerCase();
    const isProbablyHtml = type === 'html' || (type === 'auto' && /<\s*([a-z!][^\s>\/]*)/i.test(c));
    const isJs = !isProbablyHtml; // bei auto als JS behandeln, wenn es nicht wie HTML aussieht

    const W = window.open('', '_blank', 'noopener,noreferrer');
    if (!W) {
      alert('Popup wurde blockiert.');
      return;
    }


    const title = t('codeViewerTitle');
    const lblPreview = t('preview');
    const lblShowCode = t('showCode');
    const lblCopy = t('copyCode');
    const lblNoPrev = t('previewNotAvailable');

    const codeHtml = isProbablyHtml ? highlightHtml(c) : highlightJs(c);
    const canPreview = true; // wir erlauben Preview, für JS wird in eine HTML-Hülle gelegt

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--bg:#0f172a;--text:#e5e7eb;--panel:#0b1020;--border:#1f2937;--accent:#38bdf8;--muted:#94a3b8}
    html,body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,Segoe UI,Roboto,Arial}
    header{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(15,23,42,.9);backdrop-filter: blur(4px)}
    button{background:#1f2937;color:#e5e7eb;border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer}
    button:hover{background:#263243}
    .wrap{padding:10px}
    pre{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px;overflow:auto;font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "JetBrains Mono", monospace;font-size:14px}
    .tag{color:#93c5fd}
    .attr{color:#f59e0b}
    .str{color:#86efac}
    .punc{color:#cbd5e1}
    .com{color:#94a3b8}
    .kw{color:#a78bfa}
    .lit{color:#fca5a5}
    iframe{width:100%;height:80vh;border:1px solid var(--border);border-radius:8px;background:white}
    .hint{color:var(--muted);font-size:.9rem;margin-left:8px}
  </style>
</head>
<body>
  <header>
    <strong>${escapeHtml(title)}</strong>
    <span style="flex:1"></span>
    <button id="btnShowCode">${escapeHtml(lblShowCode)}</button>
    <button id="btnPreview">${escapeHtml(lblPreview)}</button>
    <button id="btnCopy">${escapeHtml(lblCopy)}</button>
  </header>
  <div class="wrap">
    <pre id="code"><code>${codeHtml}</code></pre>
    <div id="preview" style="display:none">
      <iframe id="pv"></iframe>
      <div class="hint" id="pvHint"></div>
    </div>
  </div>
  <script>
    const RAW = ${JSON.stringify(c)};
    const isHtml = ${JSON.stringify(isProbablyHtml)};
    const noPrevMsg = ${JSON.stringify(lblNoPrev)};
    const pvWrap = document.getElementById('preview');
    const codeWrap = document.getElementById('code');
    const pv = document.getElementById('pv');
    const pvHint = document.getElementById('pvHint');
    function showCode(){ codeWrap.style.display='block'; pvWrap.style.display='none'; }
    function showPreview(){
      pvWrap.style.display='block'; codeWrap.style.display='none';
      try{
        const doc = pv.contentDocument;
        doc.open();
        if(isHtml){
          doc.write(RAW);
        } else {
          doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body><script>'+RAW.replace(/<\\/script>/g,'<\\/script>')+'<\\/script></body></html>');
        }
        doc.close();
        pvHint.textContent = '';
      }catch(e){ pvHint.textContent = noPrevMsg; }
    }
    document.getElementById('btnShowCode').onclick = showCode;
    document.getElementById('btnPreview').onclick = showPreview;
    document.getElementById('btnCopy').onclick = async ()=>{
      try{ await navigator.clipboard.writeText(RAW); }
      catch(e){ /* ignore */ }
    };
  </script>
</body>
</html>`;

    W.document.open();
    W.document.write(html);
    W.document.close();
  } catch (e) {
    alert('Konnte Code-Viewer nicht öffnen: ' + (e && e.message ? e.message : e));
  }
}

// Erkennung von potentiell ausführbarem Code (HTML/JS)
function isExecutableContentType(t) {
  const type = (t || '').toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml' || type === 'application/javascript' || type === 'text/javascript' || type === 'application/ecmascript' || type === 'text/ecmascript';
}
function looksLikeHtmlOrJs(s) {
  if (!s || typeof s !== 'string') return false;
  const snippet = s.slice(0, 500).toLowerCase();
  return snippet.includes('<script') || snippet.includes('<html') || snippet.includes('<!doctype html') || snippet.includes('</') || /\b(function|=>)\b/.test(snippet) && snippet.includes('(');
}

function kvTable(pairs) {
  const tbl = document.createElement('table');
  tbl.className = 'kv';
  pairs.forEach(([k,v]) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = k;
    const td = document.createElement('td'); td.innerHTML = v;
    tr.appendChild(th); tr.appendChild(td);
    tbl.appendChild(tr);
  });
  return tbl;
}

// Alle Links sicher in neuem Fenster öffnen
function setExternalLinkAttrs(root) {
  if (!root) return;
  try {
    const links = root.querySelectorAll('a[href]');
    links.forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  } catch (_) {}
}

// Zitat-Integration für Tool-Content
function annotateWithCitations(rawText, citations) {
  try {
    var text = String(rawText || '');
    var cits = Array.isArray(citations) ? citations
      .filter(function(c){ return typeof c.start_index === 'number' && typeof c.end_index === 'number' && c.end_index > c.start_index; })
      .sort(function(a,b){ return (a.start_index - b.start_index) || (a.end_index - b.end_index); }) : [];
    if (!cits.length) return { md: text, plain: text };
    var out = '';
    var last = 0;
    var refs = [];
    cits.forEach(function(c, i){
      var n = i + 1;
      var start = Math.max(0, Math.min(text.length, c.start_index));
      var end = Math.max(0, Math.min(text.length, c.end_index));
      if (end < last) return; // Überschneidung ignorieren
      out += text.slice(last, end);
      var url = c.url || (c.metadata && c.metadata.url) || '';
      var title = c.title || (c.metadata && (c.metadata.preview_title || c.metadata.source)) || url;
      var ttip = String(title || '').replace(/"/g,'\\"');
      if (url) {
        out += ' [🔗](' + url + ' "' + ttip + '")<sup>' + n + '</sup>';
      } else {
        out += ' <sup>' + n + '</sup>';
      }
      refs.push({ n: n, title: (title || url || ('Citation ' + n)), url: url });
      last = end;
    });
    out += text.slice(last);
    var refsList = refs.map(function(r){ return '- [' + r.n + '] ' + r.title + (r.url ? (' (' + r.url + ')') : ''); }).join('\n');
    var refsTitle = t('references');
    var refsMd = '\n\n' + refsTitle + '\n' + refsList;
    var refsPlain = '\n\n' + refsTitle + '\n' + refsList;
    return { md: out + refsMd, plain: text + refsPlain };
  } catch (e) {
    return { md: String(rawText||''), plain: String(rawText||'') };
  }
}

function addAttachmentIcon(summaryEl, titleText) {
  try {
    if (!summaryEl) return;
    const span = document.createElement('span');
    span.className = 'attach-icon';
    span.textContent = '📎';
    if (titleText) span.title = titleText;
    summaryEl.appendChild(span);
  } catch (_) {}
}

function md(htmlOrMd) {
  try {
    const src = safe(htmlOrMd);
    let html = src;
    if (window.marked) {
      html = window.marked.parse(src);
    } else {
      return `<pre>${escapeHtml(src)}</pre>`;
    }
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      return window.DOMPurify.sanitize(html, {USE_PROFILES: {html: true}});
    }
    return `<pre>${escapeHtml(src)}</pre>`;
  } catch (e) {
    return `<pre>${escapeHtml(htmlOrMd)}</pre>`;
  }
}

function renderInnerContent(innerArr) {
  const frag = document.createDocumentFragment();
  (innerArr||[]).forEach((it) => {
    const det = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${safe(it.type)||'item'}${it.title ? ': ' + safe(it.title) : ''}`;
    det.appendChild(summary);
    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.appendChild(kvTable([
      ['Type', safe(it.type)],
      ['Title', safe(it.title)],
      ['Text', `<div class="markdown">${md(it.text)}</div>`],
      ['Url', it.url ? `<a href="${it.url}" target="_blank">${safe(it.url)}</a>` : ''],
      ['UUID', safe(it.uuid)],
      ['IsCitable', String(it.is_citable)],
      ['IsMissing', String(it.is_missing)]
    ]));
    if (it.metadata) {
      inner.appendChild(kvTable([
        ['Meta.SiteName', safe(it.metadata.site_name)],
        ['Meta.SiteDomain', safe(it.metadata.site_domain)],
        ['Meta.Type', safe(it.metadata.type)],
        ['Meta.Favicon', it.metadata.favicon_url ? `<img alt="favicon" src="${it.metadata.favicon_url}" style="height:16px"/>` : '']
      ]));
    }
    if (it.prompt_context_metadata) {
      const pcm = it.prompt_context_metadata;
      inner.appendChild(kvTable([
        ['Prompt.ContentType', safe(pcm.content_type)],
        ['Prompt.Url', pcm.url ? `<a href="${pcm.url}" target="_blank">${safe(pcm.url)}</a>` : ''],
        ['Prompt.DestinationUrl', pcm.destination_url ? `<a href="${pcm.destination_url}" target="_blank">${safe(pcm.destination_url)}</a>` : ''],
        ['Prompt.MimeType', safe(pcm.mime_type)],
        ['Prompt.Age', safe(pcm.age)]
      ]));
    }
    det.appendChild(inner);
    frag.appendChild(det);
  });
  return frag;
}

function renderMessage(msg, idx) {
  const box = document.createElement('details');
  box.className = 'msg chatmsg';
  box.open = false;
  const sum = document.createElement('summary');
  const dateShort = formatIsoLike(msg.created_at);
  sum.textContent = `Message #${idx+1} — ${safe(msg.sender || '')}${dateShort ? ' ' + dateShort : ''}`;
  box.appendChild(sum);

  const inner = document.createElement('div');
  inner.className = 'inner';
  if (msg.text) {
    const textWrap = document.createElement('div');
    textWrap.className = 'markdown';
    textWrap.innerHTML = md(msg.text);
    setExternalLinkAttrs(textWrap);
    inner.appendChild(textWrap);
    const isAssistant = String(msg.sender || '').toLowerCase() === 'assistant';
    if (isAssistant && safe(msg.text).length > 200) {
      const copyBtn = document.createElement('button');
      copyBtn.textContent = t('copyAnswer');
      copyBtn.style.marginTop = '8px';
      copyBtn.addEventListener('click', async () => {
        try {
          await copyRich(textWrap.innerHTML, safe(msg.text));
          copyBtn.textContent = t('copied');
          setTimeout(()=>copyBtn.textContent=t('copyAnswer'),1200);
        } catch(e) {
          alert(t('copyFailed'));
        }
      });
      inner.appendChild(copyBtn);
    }
  }

  if (msg.files && msg.files.length) {
    const files = msg.files.map(f => safe(f.file_name)).join('<br/>');
    inner.appendChild(kvTable([[ 'Files', files ]]));
  }

  if (msg.attachments && msg.attachments.length) {
    const list = msg.attachments.map(a => `File: ${safe(a.file_name)} — ${safe(a.file_type)} (${safe(a.file_size)})`).join('<br/>');
    inner.appendChild(kvTable([[ 'Attachments', list ]]));
  }

  if (msg.content && msg.content.length) {
    const cbDet = document.createElement('details');
    cbDet.open = false;
    const cbSum = document.createElement('summary');
    cbSum.textContent = t('contentBlocks');
    cbDet.appendChild(cbSum);
    const cbInner = document.createElement('div');
    cbInner.className = 'inner';

    const blockDets = [];
    const toolBlockDets = [];
    let hasToolInputContentAnywhere = false;

    msg.content.forEach((block, bi) => {
      const det = document.createElement('details');
      det.open = false;
      const sumBlock = document.createElement('summary');
      const namePart = block && block.name ? ` (${safe(block.name)})` : '';
      sumBlock.textContent = `Block #${bi+1} — ${safe(block.type || '')}${namePart}`;
      det.appendChild(sumBlock);
      const blockInner = document.createElement('div');
      blockInner.className = 'inner';
      const bd = document.createElement('details');
      bd.open = false;
      const bdSum = document.createElement('summary');
      bdSum.textContent = t('blockDetails');
      bd.appendChild(bdSum);
      const bdInner = document.createElement('div');
      bdInner.className = 'inner';
      bdInner.appendChild(kvTable([
        ['Type', safe(block.type)],
        ['Message', safe(block.message)],
        ['Name', safe(block.name)],
        ['Start', safe(block.start_timestamp)],
        ['Stop', safe(block.stop_timestamp)],
        ['Flags', safe(block.flags)],
        ['IsError', String(block.is_error)],
        ['CutOff', String(block.cut_off)],
        ['Thinking', `<pre>${(safe(block.thinking)).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`],
        ['Text', `<div class="markdown">${md(block.text)}</div>`]
      ]));
      bd.appendChild(bdInner);
      blockInner.appendChild(bd);

      if (block.input) {
        const inp = block.input;
        const ti = document.createElement('details');
        ti.open = false;
        const tiSum = document.createElement('summary');
        tiSum.textContent = t('toolInput');
        ti.appendChild(tiSum);
        const tiInner = document.createElement('div');
        tiInner.className = 'inner';
        tiInner.appendChild(kvTable([
          ['Command', safe(inp.command)],
          ['Id', safe(inp.id)],
          ['Type', safe(inp.type)],
          ['Title', safe(inp.title)],
          ['Source', safe(inp.source)],
          ['Language', safe(inp.language)]
        ]));
        ti.appendChild(tiInner);
        blockInner.appendChild(ti);

        if (inp.content !== undefined && inp.content !== null) {
          const tic = document.createElement('details');
          tic.open = true;
          const ticSum = document.createElement('summary');
          ticSum.textContent = t('toolInputContent');
          tic.appendChild(ticSum);
          const ticInner = document.createElement('div');
          ticInner.className = 'inner toolcontent';
          const contentBox = document.createElement('div');
          contentBox.className = 'markdown';
          let rawCopyText = '';
          let htmlForCopy = '';
          if (typeof inp.content === 'string') {
            const ctype = inp.type || '';
            const treatAsExecutable = isExecutableContentType(ctype) || looksLikeHtmlOrJs(inp.content);
            if (treatAsExecutable) {
              const pre = document.createElement('pre');
              const isHtml = (isExecutableContentType(ctype) && !ctype.includes('javascript')) || /<\s*([a-z!][^\s>\/]*)/i.test(inp.content);
              const codeHtml = isHtml ? highlightHtml(inp.content) : highlightJs(inp.content);
              pre.innerHTML = `<code>${codeHtml}</code>`;
              contentBox.appendChild(pre);
              rawCopyText = inp.content;
              htmlForCopy = contentBox.innerHTML;
              const btn = document.createElement('button');
              btn.textContent = isExecutableContentType(ctype) && ctype.includes('javascript') ? t('runJs') : t('openHtml');
              btn.style.marginTop = '8px';
              btn.addEventListener('click', () => {
                const typeHint = (isExecutableContentType(ctype) && ctype.includes('javascript')) ? 'js' : 'html';
                openCodeViewer(inp.content, { type: typeHint });
              });
              contentBox.appendChild(btn);
            } else {
              let annotated = { md: inp.content, plain: inp.content };
              if (Array.isArray(inp.md_citations) && inp.md_citations.length) {
                annotated = annotateWithCitations(inp.content, inp.md_citations);
              }
              contentBox.innerHTML = md(annotated.md);
              rawCopyText = annotated.plain;
              htmlForCopy = contentBox.innerHTML;
            }
          } else if (typeof inp.content === 'object') {
            const possible = inp.content.text || inp.content.content || null;
            if (typeof possible === 'string') {
              const ctype2 = inp.type || inp.content.type || '';
              const treatAsExecutable = isExecutableContentType(ctype2) || looksLikeHtmlOrJs(possible);
              if (treatAsExecutable) {
                const pre = document.createElement('pre');
                const isHtml2 = (isExecutableContentType(ctype2) && !ctype2.includes('javascript')) || /<\s*([a-z!][^\s>\/]*)/i.test(possible);
                const codeHtml2 = isHtml2 ? highlightHtml(possible) : highlightJs(possible);
                pre.innerHTML = `<code>${codeHtml2}</code>`;
                contentBox.appendChild(pre);
                rawCopyText = possible;
                htmlForCopy = contentBox.innerHTML;
                const btn = document.createElement('button');
                btn.textContent = isExecutableContentType(ctype2) && ctype2.includes('javascript') ? t('runJs') : t('openHtml');
                btn.style.marginTop = '8px';
                btn.addEventListener('click', () => {
                  const typeHint = (isExecutableContentType(ctype2) && ctype2.includes('javascript')) ? 'js' : 'html';
                  openCodeViewer(possible, { type: typeHint });
                });
                contentBox.appendChild(btn);
              } else {
                let annotated2 = { md: possible, plain: possible };
                if (Array.isArray(inp.md_citations) && inp.md_citations.length) {
                  annotated2 = annotateWithCitations(possible, inp.md_citations);
                }
                contentBox.innerHTML = md(annotated2.md);
                rawCopyText = annotated2.plain;
                htmlForCopy = contentBox.innerHTML;
              }
            } else {
              const jsonStr = JSON.stringify(inp.content, null, 2);
              contentBox.innerHTML = `<pre>${(jsonStr).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
              rawCopyText = jsonStr;
              htmlForCopy = contentBox.innerHTML;
            }
          } else {
            const s = safe(String(inp.content));
            contentBox.innerHTML = `<pre>${s}</pre>`;
            rawCopyText = s;
            htmlForCopy = contentBox.innerHTML;
          }
          ticInner.appendChild(contentBox);
          setExternalLinkAttrs(contentBox);
          if (rawCopyText && rawCopyText.length > 100) {
            const copyBtn2 = document.createElement('button');
            copyBtn2.textContent = t('copyTool');
            copyBtn2.style.marginTop = '8px';
            copyBtn2.addEventListener('click', async () => {
              try {
                await copyRich(htmlForCopy, rawCopyText);
                copyBtn2.textContent = t('copied');
                setTimeout(()=>copyBtn2.textContent=t('copyTool'),1200);
              } catch(e) {
                alert(t('copyFailed'));
              }
            });
            ticInner.appendChild(copyBtn2);
          }
          tic.appendChild(ticInner);
          blockInner.appendChild(tic);

          const isToolUse = String(block.type||'').toLowerCase() === 'tool_use' || String(block.name||'').toLowerCase() === 'artifacts';
          if (isToolUse) {
            hasToolInputContentAnywhere = true;
            toolBlockDets.push(det);
            addAttachmentIcon(sumBlock, 'Artifacts / Tool Input Content');
          }
        }

        const otherKeys = ['version_uuid','new_str','old_str','url','query','description','file_text','path','code'];
        const extraRows = [];
        otherKeys.forEach(k => {
          if (k in inp && inp[k] != null && inp[k] !== '') {
            const val = typeof inp[k] === 'string' ? inp[k] : JSON.stringify(inp[k], null, 2);
            const isCode = (k === 'code' || k === 'file_text' || k === 'path');
            extraRows.push([k, isCode ? `<pre>${(safe(val)).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>` : safe(val)]);
          }
        });
        if (Array.isArray(inp.edits) && inp.edits.length) {
          extraRows.push(['edits', `<pre>${(safe(JSON.stringify(inp.edits, null, 2))).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`]);
        }
        if (extraRows.length) {
          const moreDet = document.createElement('details');
          moreDet.open = false;
          const moreSum = document.createElement('summary');
          moreSum.textContent = t('moreToolFields');
          moreDet.appendChild(moreSum);
          const moreInner = document.createElement('div');
          moreInner.className = 'inner';
          moreInner.appendChild(kvTable(extraRows));
          moreDet.appendChild(moreInner);
          blockInner.appendChild(moreDet);
        }

        if (Array.isArray(inp.md_citations) && inp.md_citations.length) {
          const citDetails = document.createElement('details');
          citDetails.open = false;
          const citSummary = document.createElement('summary');
          citSummary.textContent = `${t('citations')} (${inp.md_citations.length})`;
          citDetails.appendChild(citSummary);
          const citInner = document.createElement('div');
          citInner.className = 'inner';

          inp.md_citations.forEach((c) => {
            const wrap = document.createElement('div');
            wrap.className = 'msg';
            const link = c.url ? `<a href="${c.url}" target="_blank">${safe(c.title || c.url)}</a>` : safe(c.title);
            const icon = c.metadata && c.metadata.icon_url ? `<img alt="icon" src="${c.metadata.icon_url}" style="height:16px" />` : '';
            const source = c.metadata && c.metadata.source ? safe(c.metadata.source) : '';
            wrap.appendChild(kvTable([
              ['Title/URL', link],
              ['Icon', icon],
              ['Source', source],
              ['Origin Tool', safe(c.origin_tool_name)],
              ['Start Index', safe(c.start_index)],
              ['End Index', safe(c.end_index)]
            ]));

            if (Array.isArray(c.sources) && c.sources.length) {
              const srcTbl = document.createElement('div');
              srcTbl.className = 'section-title';
              srcTbl.textContent = 'Sources';
              wrap.appendChild(srcTbl);
              c.sources.forEach(s => {
                wrap.appendChild(kvTable([
                  ['Title', safe(s.title)],
                  ['URL', s.url ? `<a href="${s.url}" target="_blank">${safe(s.url)}</a>` : ''],
                  ['Source', safe(s.source)],
                  ['Icon', s.icon_url ? `<img alt="icon" src="${s.icon_url}" style="height:16px" />` : '']
                ]));
              });
            }

            citInner.appendChild(wrap);
          });
          citDetails.appendChild(citInner);
          setExternalLinkAttrs(citInner);
          blockInner.appendChild(citDetails);
        }
      }

      if (block.display_content) {
        const dc = block.display_content;
        const dcd = document.createElement('details');
        dcd.open = false;
        const dcdSum = document.createElement('summary');
        dcdSum.textContent = t('displayContent');
        dcd.appendChild(dcdSum);
        const dcdInner = document.createElement('div');
        dcdInner.className = 'inner';
        dcdInner.appendChild(kvTable([
          ['Display.Type', safe(dc.type)],
          ['Display.Text', `<div class="markdown">${md(dc.text)}</div>`],
          ['Display.JsonBlock', dc.json_block ? `<pre>${(safe(dc.json_block)).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>` : ''],
          ['Display.IsTrusted', String(dc.is_trusted)]
        ]));
        const lastTbl = dcdInner.lastElementChild;
        if (lastTbl) setExternalLinkAttrs(lastTbl);
        if (dc.table && dc.table.length) {
          const tbl = document.createElement('table');
          tbl.className = 'kv';
          dc.table.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
              const el = document.createElement(i === 0 ? 'th' : 'td');
              el.textContent = safe(cell);
              tr.appendChild(el);
            });
            tbl.appendChild(tr);
          });
          dcdInner.appendChild(tbl);
        }
        if (dc.link) {
          dcdInner.appendChild(kvTable([
            ['Link.Title', safe(dc.link.title)],
            ['Link.Url', dc.link.url ? `<a href="${dc.link.url}" target="_blank">${safe(dc.link.url)}</a>` : ''],
            ['Link.Source', safe(dc.link.source)],
            ['Link.Icon', dc.link.icon_url ? `<img alt="icon" src="${dc.link.icon_url}" style="height:16px"/>` : '']
          ]));
        }
        if (dc.content && dc.content.length) {
          const sub = document.createElement('div');
          sub.className = 'section-title';
          sub.textContent = t('displayContentItems');
          dcdInner.appendChild(sub);
          dc.content.forEach(ci => {
            const it = document.createElement('div');
            it.className = 'msg';
            it.appendChild(kvTable([
              ['Title', safe(ci.title)],
              ['ResourceType', safe(ci.resource_type)],
              ['Source', safe(ci.source)],
              ['Subtitles', (ci.subtitles||[]).map(s=>safe(s)).join('<br/>')],
              ['Url', ci.url ? `<a href="${ci.url}" target="_blank">${safe(ci.url)}</a>` : '']
            ]));
            dcdInner.appendChild(it);
          });
        }
        dcd.appendChild(dcdInner);
        blockInner.appendChild(dcd);
      }

      if (block.content && block.content.length) {
        const icTitle = document.createElement('div');
        icTitle.className = 'section-title';
        icTitle.textContent = t('innerContent');
        blockInner.appendChild(icTitle);
        blockInner.appendChild(renderInnerContent(block.content));
      }

      det.appendChild(blockInner);
      cbInner.appendChild(det);
      blockDets.push(det);
    });
    cbDet.appendChild(cbInner);

    cbDet.addEventListener('toggle', () => {
      if (cbDet.open) {
        blockDets.forEach(d => { d.open = false; });
        toolBlockDets.forEach(d => { d.open = true; });
      }
    });

    if (hasToolInputContentAnywhere) {
      cbDet.classList.add('has-tool');
      box.classList.add('has-tool');
      addAttachmentIcon(cbSum, t('hasArtifacts'));
      addAttachmentIcon(sum, t('hasArtifacts'));
    }

    inner.appendChild(cbDet);
  }
  box.appendChild(inner);
  return box;
}

function render(conversations) {
  const app = document.getElementById('app');
  app.textContent = '';
  document.documentElement.lang = gLang;
  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.alignItems = 'center';
  controls.style.margin = '8px 0 8px';
  const sortLabel = document.createElement('span'); sortLabel.textContent = t('sortBy'); sortLabel.className='hint';
  const fieldSel = document.createElement('select');
  fieldSel.innerHTML = `<option value="created_at">${t('createdAt')}</option><option value="updated_at">${t('updatedAt')}</option>`;
  fieldSel.value = gSortField;
  const dirSel = document.createElement('select');
  dirSel.innerHTML = `<option value="asc">${t('asc')}</option><option value="desc">${t('desc')}</option>`;
  dirSel.value = gSortDir;
  const apply = () => {
    gSortField = fieldSel.value;
    gSortDir = dirSel.value;
    const arr = [...gData];
    arr.sort((a,b)=>{
      const av = parseDate(a && a[gSortField]);
      const bv = parseDate(b && b[gSortField]);
      return gSortDir === 'asc' ? (av - bv) : (bv - av);
    });
    render(arr);
  };
  fieldSel.addEventListener('change', apply);
  dirSel.addEventListener('change', apply);
  controls.appendChild(sortLabel);
  controls.appendChild(fieldSel);
  controls.appendChild(dirSel);

  app.appendChild(controls);
  const toc = document.createElement('nav');
  toc.setAttribute('aria-label', t('toc'));
  toc.style.border = '1px solid var(--border)';
  toc.style.borderRadius = '8px';
  toc.style.padding = '12px';
  toc.style.background = 'rgba(255,255,255,.02)';
  toc.style.margin = '8px 0 16px';
  const tocTitle = document.createElement('div');
  tocTitle.className = 'section-title';
  tocTitle.textContent = t('toc');
  toc.appendChild(tocTitle);
  const tocList = document.createElement('ul');
  tocList.style.margin = '8px 0 0 18px';
  tocList.style.padding = '0';
  toc.appendChild(tocList);
  app.appendChild(toc);

  // Hilfsfunktion: Öffnet das <details>-Element zum aktuellen Hash (falls vorhanden)
  function openTargetFromHash(opts={scroll:true}) {
    try {
      const raw = (location.hash || '').replace(/^#/, '');
      if (!raw) return;
      const id = decodeURIComponent(raw);
      const el = document.getElementById(id);
      if (!el) return;
      // Falls die ID nicht direkt auf <details> liegt, versuche den nächsten <details>-Vorfahren
      const details = el.tagName && el.tagName.toLowerCase() === 'details' ? el : (el.closest ? el.closest('details') : null);
      if (details) {
        details.open = true;
        if (opts.scroll) {
          details.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (opts.scroll) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (_) { /* noop */ }
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
  function conversationHasArtifacts(conv) {
    try {
      const msgs = (conv && conv.chat_messages) || [];
      for (const m of msgs) {
        const blocks = (m && m.content) || [];
        for (const b of blocks) {
          const isTool = String(b && b.type || '').toLowerCase() === 'tool_use' || String(b && b.name || '').toLowerCase() === 'artifacts';
          if (isTool && b.input && b.input.content != null) return true;
        }
      }
      return false;
    } catch (_) { return false; }
  }
  conversations.forEach((conv, idx) => {
    const card = document.createElement('section');
    card.className = 'conv';
    const convId = `conv-${idx+1}-${slugify(conv && conv.name) || 'conversation'}`;
    const convDetails = document.createElement('details');
    convDetails.id = convId;
    convDetails.open = false;
    const convSummary = document.createElement('summary');
    const dateForToc = formatIsoLike(conv && conv[gSortField]);
    convSummary.textContent = `Conversation #${idx+1}: ${safe(conv.name || '')}`;
    convDetails.appendChild(convSummary);
    const convInner = document.createElement('div');
    convInner.className = 'inner';

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${convId}`;
    a.textContent = `${dateForToc ? '['+dateForToc+'] ' : ''}Conversation #${idx+1}: ${safe(conv.name || '')}`;
    // Beim Klick den Ziel-Abschnitt (details) automatisch öffnen und hinscrollen
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const target = document.getElementById(convId);
      if (target) {
        // Öffnen (falls <details>)
        if (target.tagName && target.tagName.toLowerCase() === 'details') {
          target.open = true;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const d = target.closest ? target.closest('details') : null;
          if (d) {
            d.open = true;
            d.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        // Hash in URL aktualisieren, ohne Seitenreload
        history.pushState(null, '', `#${convId}`);
      }
    });
    li.appendChild(a);
    if (conversationHasArtifacts(conv)) {
      const span = document.createElement('span');
      span.className = 'attach-icon';
      span.textContent = '📎';
      span.title = t('hasArtifacts');
      li.appendChild(span);
    }
    tocList.appendChild(li);

    const meta = [
      ['Name', safe(conv.name)],
      ['Summary', `<div class="markdown">${md(conv.summary)}</div>`],
      ['Created At', safe(conv.created_at)],
      ['Updated At', safe(conv.updated_at)],
      ['Account UUID', conv.account && conv.account.uuid ? safe(conv.account.uuid) : '']
    ];
    convInner.appendChild(kvTable(meta));

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = t('chatMessages');
    convInner.appendChild(title);

    (conv.chat_messages||[]).forEach((m, i) => {
      convInner.appendChild(renderMessage(m, i));
    });

    convDetails.appendChild(convInner);
    card.appendChild(convDetails);
    app.appendChild(card);
  });

  // Hash-Navigation unterstützen (direkt aufrufen und auf Änderungen reagieren)
  window.onhashchange = () => openTargetFromHash({scroll:true});
  // Falls beim Rendern bereits ein Hash vorhanden ist, direkt öffnen (nach Layout)
  setTimeout(() => openTargetFromHash({scroll:false}), 0);
}

// Datei aus dem File-Input einlesen und rendern
function handleLocalFile(file) {
  const app = document.getElementById('app');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : (data && data.conversations ? data.conversations : []);
      gData = arr;
      const sorted = [...gData];
      sorted.sort((a,b)=>{
        const av = parseDate(a && a[gSortField]);
        const bv = parseDate(b && b[gSortField]);
        return gSortDir === 'asc' ? (av - bv) : (bv - av);
      });
      render(sorted);
    } catch(e) {
      app.innerHTML = `<div style="color:#ef4444">${t('fileParseError')}${safe(e && e.message || e)}</div>`;
    }
  };
  reader.onerror = () => {
    app.innerHTML = `<div style="color:#ef4444">${t('fileReadError')}</div>`;
  };
  reader.readAsText(file, 'utf-8');
}

function onFileInputChange(ev) {
  const input = ev.target;
  const file = input && input.files && input.files[0];
  handleLocalFile(file);
}

async function init() {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
    if (window.marked && window.marked.setOptions) {
      window.marked.setOptions({ mangle: false, headerIds: false });
    }
  } catch(e) {
    console.warn('Markdown-Renderer konnte nicht geladen werden:', e);
  }
  const fin = document.getElementById('fileInput');
  if (fin) fin.addEventListener('change', onFileInputChange);

  const titleH1 = document.getElementById('titleH1');
  const fileLabel = document.getElementById('fileLabel');
  const appDiv = document.getElementById('app');
  const sel = document.getElementById('langSelect');
  const langLabel = document.querySelector('label[for="langSelect"]');
  const applyLang = () => {
    if (titleH1) titleH1.textContent = t('title');
    if (fileLabel) fileLabel.textContent = t('pickFile');
    if (langLabel) langLabel.textContent = t('languageLabel');
    if (!gData || gData.length === 0) appDiv.textContent = t('pleasePick');
    document.documentElement.lang = gLang;
    if (gData && gData.length) {
      const arr = [...gData];
      arr.sort((a,b)=>{
        const av = parseDate(a && a[gSortField]);
        const bv = parseDate(b && b[gSortField]);
        return gSortDir === 'asc' ? (av - bv) : (bv - av);
      });
      render(arr);
    }
  };
  if (sel) {
    sel.value = gLang;
    sel.addEventListener('change', () => { gLang = sel.value; applyLang(); });
  }
  applyLang();
}
document.addEventListener('DOMContentLoaded', init);

// Copy helper: HTML + Plain fallback
async function copyRich(htmlString, plainText) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const data = {};
      if (htmlString) data['text/html'] = new Blob([htmlString], { type: 'text/html' });
      data['text/plain'] = new Blob([plainText || ''], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem(data)]);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText || '');
    } else {
      const ta = document.createElement('textarea');
      ta.value = plainText || '';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch (e) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText || '');
    } else {
      throw e;
    }
  }
}
