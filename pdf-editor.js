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

const organizeUploadArea = document.getElementById('organizeUploadArea');
const organizeFileInput = document.getElementById('organizeFileInput');
const organizePreview = document.getElementById('organizePreview');
const organizeTools = document.getElementById('organizeTools');
const organizeActions = document.getElementById('organizeActions');
const saveOrganizeBtn = document.getElementById('saveOrganizeBtn');
const clearOrganizeBtn = document.getElementById('clearOrganizeBtn');
const selectedCountEl = document.getElementById('selectedCount');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLevelEl = document.getElementById('zoomLevel');

// Desativa o botão de salvar enquanto não houver seleção
if (saveOrganizeBtn) saveOrganizeBtn.disabled = true;

function updateOrganizeActionsState() {
    if (!saveOrganizeBtn) return;
    saveOrganizeBtn.disabled = state.selectedPages.size === 0;
    if (selectedCountEl) selectedCountEl.textContent = state.selectedPages.size;
}

organizeUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); organizeUploadArea.classList.add('dragover'); });
organizeUploadArea.addEventListener('dragleave', () => organizeUploadArea.classList.remove('dragover'));
organizeUploadArea.addEventListener('drop', (e) => { e.preventDefault(); organizeUploadArea.classList.remove('dragover'); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (files.length) handleOrganizeFile(files[0]); });
organizeUploadArea.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') organizeFileInput.click(); });
organizeFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleOrganizeFile(e.target.files[0]); });

async function handleOrganizeFile(file) {
    try { showLoading(true); state.organizeFile = file; state.selectedPages.clear(); const arrayBuffer = await file.arrayBuffer(); const { PDFDocument } = PDFLib; state.organizePdfDoc = await PDFDocument.load(arrayBuffer); const numPages = state.organizePdfDoc.getPageCount(); for (let i=0;i<numPages;i++) state.selectedPages.add(i); organizeUploadArea.style.display = 'none'; organizeTools.style.display = 'flex'; organizeActions.style.display = 'flex'; await renderOrganizePreview(); showAlert('PDF carregado! Clique nas páginas para removê-las da seleção.'); } catch (err) { console.error(err); showAlert('Erro ao carregar PDF.','error'); } finally { showLoading(false); }
}

// Após carregar arquivo, atualizar estado do botão salvar
// (iniciado com todas as páginas selecionadas por padrão)
updateOrganizeActionsState();

async function renderOrganizePreview() {
    organizePreview.innerHTML = '';
    if (!state.organizePdfDoc) return;
    const numPages = state.organizePdfDoc.getPageCount();
    const pdfBytes = await state.organizePdfDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    for (let i = 0; i < numPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page' + (state.selectedPages.has(i) ? ' selected' : '');
        pageDiv.dataset.pageIndex = i;
        pageDiv.innerHTML = `<canvas id="organize-canvas-${i}"></canvas><div class="page-number">Página ${i+1}</div>`;
        organizePreview.appendChild(pageDiv);

        const page = await pdf.getPage(i+1);
        const canvas = document.getElementById(`organize-canvas-${i}`);
        const ctx = canvas.getContext('2d');

        // Responsive scale
        const containerWidth = Math.max(150, pageDiv.clientWidth || organizePreview.clientWidth || 300);
        const origViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2.0, Math.max(0.2, containerWidth / origViewport.width));
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({ canvasContext: ctx, viewport }).promise;

        pageDiv.addEventListener('click', () => {
            if (state.selectedPages.has(i)) { state.selectedPages.delete(i); pageDiv.classList.remove('selected'); }
            else { state.selectedPages.add(i); pageDiv.classList.add('selected'); }
            updateOrganizeActionsState();
        });

        // Enable drag and drop reordering
        pageDiv.draggable = true;
        pageDiv.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', i); ev.dataTransfer.effectAllowed = 'move'; pageDiv.classList.add('dragging'); });
        pageDiv.addEventListener('dragend', () => { pageDiv.classList.remove('dragging'); });
        pageDiv.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; pageDiv.classList.add('drag-over'); });
        pageDiv.addEventListener('dragleave', () => { pageDiv.classList.remove('drag-over'); });
        pageDiv.addEventListener('drop', (ev) => {
            ev.preventDefault();
            pageDiv.classList.remove('drag-over');
            const fromIndex = parseInt(ev.dataTransfer.getData('text/plain'), 10);
            const toIndex = i;
            if (isNaN(fromIndex)) return;
            // reorder DOM
            const fromEl = document.getElementById(`organize-canvas-${fromIndex}`).parentElement;
            const toEl = pageDiv;
            if (fromEl && toEl && fromEl !== toEl) {
                const parent = toEl.parentElement;
                parent.insertBefore(fromEl, toEl.nextSibling);
                // Update selectedPages order by reconstructing order from DOM
                const newOrder = Array.from(parent.children).map(child => parseInt(child.dataset.pageIndex, 10));
                // rebuild selectedPages using new order (keep only selected indices)
                const newSelected = new Set();
                newOrder.forEach(idx => { if (state.selectedPages.has(idx)) newSelected.add(idx); });
                state.selectedPages = newSelected;
                updateOrganizeActionsState();
            }
        });

        canvas.addEventListener('click', (ev) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = ev.clientX - rect.left;
            const clientY = rect.bottom - ev.clientY;
            const pdfX = (clientX / canvas.width) * viewport.width;
            const pdfY = (clientY / canvas.height) * viewport.height;
            state.lastClickPdfCoords = { x: pdfX, y: pdfY, pageIndex: i };
            showAlert(`Coordenadas: X=${Math.round(pdfX)}, Y=${Math.round(pdfY)} na Página ${i+1}`);
        });
    }
}

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