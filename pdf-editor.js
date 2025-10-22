// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Estado da aplicação
const state = {
    mergeFiles: [],
    editFile: null,
    editPdfDoc: null,
    organizeFile: null,
    organizePdfDoc: null,
    selectedPages: new Set(),
    textAnnotations: [],
    zoomLevel: 1.0, // Nível de zoom inicial (1.0 = 100%)
    lastClickPdfCoords: null // Armazena as coordenadas do último clique no PDF para adicionar elementos
};

// Utilitários
function showAlert(message, type = 'success') {
    const alertId = type === 'success' ? 'successAlert' : 'errorAlert';
    const alert = document.getElementById(alertId);
    alert.textContent = message;
    alert.classList.add('active');
    setTimeout(() => alert.classList.remove('active'), 5000);
}

function showLoading(show = true) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('active', show);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function downloadPdf(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Sistema de abas
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// ========= FUNCIONALIDADE DE MESCLAGEM =========

const mergeUploadArea = document.getElementById('mergeUploadArea');
const mergeFileInput = document.getElementById('mergeFileInput');
const mergeFileList = document.getElementById('mergeFileList');
const mergePdfBtn = document.getElementById('mergePdfBtn');
const clearMergeBtn = document.getElementById('clearMergeBtn');

mergeUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); mergeUploadArea.classList.add('dragover'); });
mergeUploadArea.addEventListener('dragleave', () => mergeUploadArea.classList.remove('dragover'));
mergeUploadArea.addEventListener('drop', (e) => { e.preventDefault(); mergeUploadArea.classList.remove('dragover'); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); handleMergeFiles(files); });
mergeUploadArea.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') mergeFileInput.click(); });
mergeFileInput.addEventListener('change', (e) => handleMergeFiles(Array.from(e.target.files)));

function handleMergeFiles(files) {
    files.forEach(file => { if (!state.mergeFiles.find(f => f.name === file.name)) state.mergeFiles.push(file); });
    renderMergeFileList();
    mergePdfBtn.disabled = state.mergeFiles.length < 2;
}

function renderMergeFileList() {
    if (state.mergeFiles.length === 0) { mergeFileList.innerHTML = ''; return; }
    mergeFileList.innerHTML = state.mergeFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-icon">PDF</div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${formatFileSize(file.size)}</p>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn-icon" onclick="removeMergeFile(${index})" title="Remover">✖</button>
            </div>
        </div>
    `).join('');
}

function removeMergeFile(index) { state.mergeFiles.splice(index, 1); renderMergeFileList(); mergePdfBtn.disabled = state.mergeFiles.length < 2; }

clearMergeBtn.addEventListener('click', () => { state.mergeFiles = []; renderMergeFileList(); mergePdfBtn.disabled = true; mergeFileInput.value = ''; });

mergePdfBtn.addEventListener('click', async () => {
    try { showLoading(true); const { PDFDocument } = PDFLib; const mergedPdf = await PDFDocument.create(); for (const file of state.mergeFiles) { const arrayBuffer = await file.arrayBuffer(); const pdf = await PDFDocument.load(arrayBuffer); const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices()); copiedPages.forEach(p => mergedPdf.addPage(p)); } const pdfBytes = await mergedPdf.save(); await downloadPdf(pdfBytes, 'documento_mesclado.pdf'); showAlert('PDFs mesclados com sucesso!'); } catch (err) { console.error(err); showAlert('Erro ao mesclar PDFs.', 'error'); } finally { showLoading(false); }
});

// ========= FUNCIONALIDADE DE EDIÇÃO =========

const editUploadArea = document.getElementById('editUploadArea');
const editFileInput = document.getElementById('editFileInput');
const editPreview = document.getElementById('editPreview');
const editTools = document.getElementById('editTools');
const editActions = document.getElementById('editActions');
const addTextBtn = document.getElementById('addTextBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const clearEditBtn = document.getElementById('clearEditBtn');

editUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); editUploadArea.classList.add('dragover'); });
editUploadArea.addEventListener('dragleave', () => editUploadArea.classList.remove('dragover'));
editUploadArea.addEventListener('drop', (e) => { e.preventDefault(); editUploadArea.classList.remove('dragover'); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (files.length) handleEditFile(files[0]); });
editUploadArea.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') editFileInput.click(); });
editFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleEditFile(e.target.files[0]); });

async function handleEditFile(file) {
    try { showLoading(true); state.editFile = file; state.textAnnotations = []; const arrayBuffer = await file.arrayBuffer(); const { PDFDocument } = PDFLib; state.editPdfDoc = await PDFDocument.load(arrayBuffer); editUploadArea.style.display = 'none'; editTools.style.display = 'flex'; editActions.style.display = 'flex'; await renderEditPreview(); showAlert('PDF carregado! Adicione texto.'); } catch (err) { console.error(err); showAlert('Erro ao carregar PDF.', 'error'); } finally { showLoading(false); }
}

async function renderEditPreview() {
    editPreview.innerHTML = '';
    if (!state.editPdfDoc) return;
    const numPages = state.editPdfDoc.getPageCount();
    // Save once and load into pdf.js
    const pdfBytes = await state.editPdfDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    for (let i = 0; i < numPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        pageDiv.innerHTML = `<canvas id="edit-canvas-${i}"></canvas><div class="page-number">Página ${i+1}</div>`;
        editPreview.appendChild(pageDiv);

        const page = await pdf.getPage(i+1);
        const canvas = document.getElementById(`edit-canvas-${i}`);
        const ctx = canvas.getContext('2d');

        // Compute responsive scale based on container width
        const containerWidth = Math.max(150, pageDiv.clientWidth || editPreview.clientWidth || 300);
    const origViewport = page.getViewport({ scale: 1 });
    // Compute base scale from container and apply user zoom
    const baseScale = Math.min(2.0, Math.max(0.2, containerWidth / origViewport.width));
    const appliedScale = baseScale * (state.zoomLevel || 1.0);
    const viewport = page.getViewport({ scale: appliedScale });

        // Set canvas internal pixel size and make it responsive in layout
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({ canvasContext: ctx, viewport }).promise;
    }
}

addTextBtn.addEventListener('click', async () => {
    const text = document.getElementById('textInput').value; const size = parseInt(document.getElementById('textSize').value) || 14; const color = document.getElementById('textColor').value || '#000000'; if (!text) { showAlert('Digite um texto para adicionar.', 'error'); return; }
    try { showLoading(true); const pages = state.editPdfDoc.getPages(); const first = pages[0]; const { width, height } = first.getSize(); const r = parseInt(color.substr(1,2),16)/255; const g = parseInt(color.substr(3,2),16)/255; const b = parseInt(color.substr(5,2),16)/255; first.drawText(text, { x: 50, y: height - 50 - (state.textAnnotations.length * (size+6)), size, color: PDFLib.rgb(r,g,b) }); state.textAnnotations.push({ text, size, color }); await renderEditPreview(); document.getElementById('textInput').value = ''; showAlert('Texto adicionado com sucesso!'); } catch (err) { console.error(err); showAlert('Erro ao adicionar texto.', 'error'); } finally { showLoading(false); }
});

saveEditBtn.addEventListener('click', async () => { try { showLoading(true); const pdfBytes = await state.editPdfDoc.save(); await downloadPdf(pdfBytes, 'documento_editado.pdf'); showAlert('PDF editado salvo com sucesso!'); } catch (err) { console.error(err); showAlert('Erro ao salvar PDF.', 'error'); } finally { showLoading(false); } });

clearEditBtn.addEventListener('click', () => { state.editFile = null; state.editPdfDoc = null; state.textAnnotations = []; editPreview.innerHTML = ''; editUploadArea.style.display = 'block'; editTools.style.display = 'none'; editActions.style.display = 'none'; editFileInput.value = ''; });

// ========= FUNCIONALIDADE DE ORGANIZAÇÃO =========
// Substitui a aba de organizar por uma funcionalidade de tradução de PDF

const translateUploadArea = document.getElementById('translateUploadArea');
const translateFileInput = document.getElementById('translateFileInput');
const translatePreview = document.getElementById('translatePreview');
const translateTools = document.getElementById('translateTools');
const translateBtn = document.getElementById('translateBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadTranslatedPdfBtn = document.getElementById('downloadTranslatedPdfBtn');
const clearTranslateBtn = document.getElementById('clearTranslateBtn');

// Endpoint de tradução (configurável)
const TRANSLATE_ENDPOINT = 'https://libretranslate.de/translate';

translateUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); translateUploadArea.classList.add('dragover'); });
translateUploadArea.addEventListener('dragleave', () => translateUploadArea.classList.remove('dragover'));
translateUploadArea.addEventListener('drop', (e) => { e.preventDefault(); translateUploadArea.classList.remove('dragover'); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (files.length) handleTranslateFile(files[0]); });
translateUploadArea.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') translateFileInput.click(); });
translateFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleTranslateFile(e.target.files[0]); });

async function handleTranslateFile(file) {
    try {
        showLoading(true);
        state.translateFile = file;
        const arrayBuffer = await file.arrayBuffer();
        state.translatePdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        translateUploadArea.style.display = 'none';
        translateTools.style.display = 'flex';
        translatePreview.innerHTML = '';
        showAlert('PDF carregado! Clique em Traduzir para iniciar.');
    } catch (err) {
        console.error(err);
        showAlert('Erro ao carregar PDF para traduzir.', 'error');
    } finally {
        showLoading(false);
    }
}

async function extractTextFromPdf(pdfBytes) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const texts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const txtContent = await page.getTextContent();
        const pageText = txtContent.items.map(it => it.str).join(' ');
        texts.push(pageText.trim());
    }
    return texts;
}

async function translateTextBatch(texts, source, target) {
    const translated = [];
    for (const t of texts) {
        if (!t) { translated.push(''); continue; }
        try {
            const res = await fetch(TRANSLATE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: t, source: source === 'auto' ? 'auto' : source, target: target, format: 'text' })
            });
            if (!res.ok) throw new Error('Erro na API de tradução');
            const j = await res.json();
            translated.push(j.translatedText || j.result || '');
        } catch (err) {
            console.error('translation error', err);
            translated.push('');
        }
    }
    return translated;
}

async function renderTranslatePreview(translatedTexts) {
    translatePreview.innerHTML = '';
    if (!translatedTexts || translatedTexts.length === 0) return;
    translatedTexts.forEach((txt, idx) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        pageDiv.innerHTML = `<div style="padding:12px; max-height:260px; overflow:auto;"><strong>Página ${idx+1}</strong><p style='white-space:pre-wrap; margin-top:8px;'>${escapeHtml(txt || '(sem texto)')}</p></div>`;
        translatePreview.appendChild(pageDiv);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

translateBtn.addEventListener('click', async () => {
    if (!state.translatePdfDoc) { showAlert('Carregue um PDF primeiro.', 'error'); return; }
    try {
        showLoading(true);
        const pdfBytes = await state.translatePdfDoc.save();
        const texts = await extractTextFromPdf(pdfBytes);
        const source = document.getElementById('sourceLang').value;
        const target = document.getElementById('targetLang').value;
        const translated = await translateTextBatch(texts, source, target);
        state.translatedTexts = translated;
        await renderTranslatePreview(translated);
        downloadTxtBtn.style.display = 'inline-flex';
        downloadTranslatedPdfBtn.style.display = 'inline-flex';
        showAlert('Tradução concluída. Revise e baixe o resultado.');
    } catch (err) {
        console.error(err);
        showAlert('Erro durante a tradução.', 'error');
    } finally {
        showLoading(false);
    }
});

downloadTxtBtn.addEventListener('click', () => {
    if (!state.translatedTexts) return;
    const txt = state.translatedTexts.map((t, i) => `--- Página ${i+1} ---\n${t}\n\n`).join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'traducao.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

downloadTranslatedPdfBtn.addEventListener('click', async () => {
    if (!state.translatedTexts) return;
    try {
        showLoading(true);
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        const newPdf = await PDFDocument.create();
        const font = await newPdf.embedFont(StandardFonts.Helvetica);
        for (let i = 0; i < state.translatedTexts.length; i++) {
            let page = newPdf.addPage([595, 842]); // A4 portrait
            const text = state.translatedTexts[i] || '(sem texto)';
            const fontSize = 12;
            const lines = splitTextIntoLines(text, 80);
            let y = 820;
            for (const line of lines) {
                if (y < 40) { // add new page when overflow
                    y = 820;
                    page = newPdf.addPage([595, 842]);
                }
                page.drawText(line, { x: 40, y: y, size: fontSize, font, color: rgb(0,0,0) });
                y -= fontSize + 6;
            }
        }
        const bytes = await newPdf.save();
        await downloadPdf(bytes, 'documento_traduzido.pdf');
    } catch (err) {
        console.error(err);
        showAlert('Erro ao gerar PDF traduzido.', 'error');
    } finally {
        showLoading(false);
    }
});

function splitTextIntoLines(text, maxChars) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else { cur += ' ' + w; }
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
}

clearTranslateBtn.addEventListener('click', () => {
    state.translateFile = null;
    state.translatePdfDoc = null;
    state.translatedTexts = null;
    translatePreview.innerHTML = '';
    translateUploadArea.style.display = 'block';
    translateTools.style.display = 'none';
    downloadTxtBtn.style.display = 'none';
    downloadTranslatedPdfBtn.style.display = 'none';
    translateFileInput.value = '';
});

// Re-render previews on resize (debounced)
function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

const handleResize = debounce(() => {
    if (state.editPdfDoc) renderEditPreview();
    if (state.organizePdfDoc) renderOrganizePreview();
}, 250);

window.addEventListener('resize', handleResize);

// Zoom controls
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        state.zoomLevel = Math.min(3.0, state.zoomLevel + 0.1);
        if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        if (state.editPdfDoc) renderEditPreview();
    });
}
if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        state.zoomLevel = Math.max(0.3, state.zoomLevel - 0.1);
        if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        if (state.editPdfDoc) renderEditPreview();
    });
}

saveOrganizeBtn.addEventListener('click', async () => { try { if (state.selectedPages.size === 0) { showAlert('Selecione pelo menos uma página para salvar.','error'); return; } showLoading(true); const { PDFDocument } = PDFLib; const newPdf = await PDFDocument.create(); const selectedPagesArray = Array.from(state.selectedPages).sort((a,b)=>a-b); for (const pageIndex of selectedPagesArray) { const [copiedPage] = await newPdf.copyPages(state.organizePdfDoc, [pageIndex]); newPdf.addPage(copiedPage); } const pdfBytes = await newPdf.save(); await downloadPdf(pdfBytes, 'documento_organizado.pdf'); showAlert('PDF organizado salvo com sucesso!'); } catch (err) { console.error(err); showAlert('Erro ao salvar PDF.','error'); } finally { showLoading(false); } });

clearOrganizeBtn.addEventListener('click', () => { state.organizeFile=null; state.organizePdfDoc=null; state.selectedPages.clear(); organizePreview.innerHTML=''; organizeUploadArea.style.display='block'; organizeTools.style.display='none'; organizeActions.style.display='none'; organizeFileInput.value=''; });