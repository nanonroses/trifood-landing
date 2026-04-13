/**
 * TRIFOOD — Catálogo de Productos
 * Filtros, búsqueda, cotización WhatsApp, exportación PDF/Excel
 */

(function () {
    'use strict';

    // ==================== STATE ====================
    let productos = [];
    let categorias = [];
    let activeCategory = 'todos';
    let searchQuery = '';
    let viewMode = 'grid'; // 'grid' | 'table'
    let quotation = []; // Array of { product, qty }

    // ==================== DOM REFS ====================
    const gridContainer = document.getElementById('catalog-grid');
    const tableContainer = document.getElementById('catalog-table');
    const tableBody = document.getElementById('catalog-table-body');
    const filtersContainer = document.getElementById('category-filters');
    const searchInput = document.getElementById('search-input');
    const resultsCount = document.getElementById('results-count');
    const quoteBar = document.getElementById('quote-bar');
    const quoteCount = document.getElementById('quote-count');
    const quoteTotal = document.getElementById('quote-total');
    const quoteTotalValue = document.getElementById('quote-total-value');

    // ==================== LOAD DATA ====================
    async function loadProducts() {
        try {
            const res = await fetch('data/productos.json');
            const data = await res.json();
            categorias = data.categorias;
            productos = [];
            categorias.forEach(cat => {
                cat.productos.forEach(prod => {
                    productos.push({ ...prod, categoriaId: cat.id, categoriaNombre: cat.nombre, categoriaIcono: cat.icono });
                });
            });
            renderFilters();
            renderProducts();
        } catch (err) {
            console.error('Error cargando productos:', err);
            gridContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar productos</h3><p>No se pudo cargar el catálogo. Intente recargar la página.</p></div>';
        }
    }

    // ==================== FILTERS ====================
    function renderFilters() {
        let html = '<button class="filter-btn active" data-cat="todos"><i class="fas fa-th"></i> Todos</button>';
        categorias.forEach(cat => {
            html += `<button class="filter-btn" data-cat="${cat.id}"><i class="${cat.icono}"></i> ${cat.nombre}</button>`;
        });
        filtersContainer.innerHTML = html;

        filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeCategory = btn.dataset.cat;
                renderProducts();
            });
        });
    }

    // ==================== SEARCH ====================
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderProducts();
    });

    // ==================== VIEW TOGGLE ====================
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            viewMode = btn.dataset.view;
            if (viewMode === 'grid') {
                gridContainer.style.display = 'grid';
                tableContainer.style.display = 'none';
            } else {
                gridContainer.style.display = 'none';
                tableContainer.style.display = 'block';
            }
            renderProducts();
        });
    });

    // ==================== RENDER PRODUCTS ====================
    function getFilteredProducts() {
        return productos.filter(p => {
            const matchCat = activeCategory === 'todos' || p.categoriaId === activeCategory;
            const matchSearch = !searchQuery || p.nombre.toLowerCase().includes(searchQuery) || p.descripcion.toLowerCase().includes(searchQuery) || p.categoriaNombre.toLowerCase().includes(searchQuery);
            return matchCat && matchSearch;
        });
    }

    function formatPrice(price) {
        if (price == null) return '—';
        return '$' + price.toLocaleString('es-CL');
    }

    function getDiscount(unit, wholesale) {
        if (!wholesale || !unit) return 0;
        return Math.round(((unit - wholesale) / unit) * 100);
    }

    function getBadgeClass(badge) {
        if (!badge) return '';
        const map = {
            'TOP VENTAS': 'badge-top-ventas',
            'PREMIUM': 'badge-premium',
            'FORMATO PRO': 'badge-formato-pro',
            'PRECIO ÚNICO': 'badge-precio-unico',
            'STARTER': 'badge-pack',
            'MÁS VENDIDO': 'badge-pack-best',
            'GOURMET': 'badge-pack',
            'TEMPORADA': 'badge-pack',
            'COLECCIÓN': 'badge-pack'
        };
        return map[badge] || 'badge-default';
    }

    function isInQuote(productId) {
        return quotation.find(q => q.product.id === productId);
    }

    function renderProducts() {
        const filtered = getFilteredProducts();
        resultsCount.innerHTML = `Mostrando <span>${filtered.length}</span> producto${filtered.length !== 1 ? 's' : ''}`;

        // Grid View
        if (filtered.length === 0) {
            gridContainer.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>Sin resultados</h3><p>No se encontraron productos con esos criterios.</p></div>';
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No se encontraron productos.</td></tr>';
            return;
        }

        let gridHtml = '';
        let tableHtml = '';

        filtered.forEach((p, i) => {
            const discount = getDiscount(p.precioUnitario, p.precioMayorista);
            const inQuote = isInQuote(p.id);
            const btnLabel = inQuote ? '<i class="fas fa-check"></i> Agregado' : '<i class="fas fa-plus"></i> Cotizar';
            const btnClass = inQuote ? 'btn-cotizar btn-add-quote added' : 'btn-cotizar btn-add-quote';

            // Image or placeholder
            let imgHtml;
            if (p.esPack) {
                imgHtml = `<div class="card-img-placeholder pack-placeholder"><i class="fas fa-box-open"></i></div>`;
            } else if (p.imagen) {
                imgHtml = `<div class="card-img" style="background-image: url('${p.imagen}');"></div>`;
            } else {
                imgHtml = `<div class="card-img-placeholder"><i class="${p.categoriaIcono}"></i></div>`;
            }

            // Badge
            let badgeHtml = '';
            if (p.badge) {
                badgeHtml = `<span class="card-badge ${getBadgeClass(p.badge)}">${p.badge}</span>`;
            }

            // Pricing HTML
            let pricingHtml = '';
            if (p.esPack) {
                // Pack-specific pricing: strikethrough + savings
                pricingHtml = `
                    <div class="pricing-row pack-original">
                        <span class="pricing-label">Por separado</span>
                        <span class="pricing-value pack-strikethrough">${formatPrice(p.precioSinPack)}</span>
                    </div>
                    <div class="pricing-row pack-price">
                        <span class="pricing-label">Precio Pack <span class="pack-savings-badge">Ahorra ${p.ahorro}%</span></span>
                        <span class="pricing-value">${formatPrice(p.precioUnitario)}</span>
                    </div>`;
            } else if (p.precioMayorista) {
                pricingHtml = `
                    <div class="pricing-row">
                        <span class="pricing-label">Unitario</span>
                        <span class="pricing-value">${formatPrice(p.precioUnitario)}</span>
                    </div>
                    <div class="pricing-row mayorista">
                        <span class="pricing-label">${p.umbralMayorista}+ uds. <span class="discount-badge">-${discount}%</span></span>
                        <span class="pricing-value">${formatPrice(p.precioMayorista)}</span>
                    </div>`;
            } else {
                pricingHtml = `
                    <div class="pricing-row pricing-single">
                        <span class="pricing-label">Precio único</span>
                        <span class="pricing-value">${formatPrice(p.precioUnitario)}</span>
                    </div>`;
            }

            // Pack contents list
            let contenidoHtml = '';
            if (p.esPack && p.contenido) {
                contenidoHtml = `<ul class="pack-contents">${p.contenido.map(item => `<li><i class="fas fa-check"></i> ${item}</li>`).join('')}</ul>`;
            }

            // Grid Card
            const cardClass = p.esPack ? 'catalog-card pack-card' : 'catalog-card';
            gridHtml += `
                <div class="${cardClass}" style="animation-delay: ${i * 0.05}s;" data-id="${p.id}">
                    ${badgeHtml}
                    ${imgHtml}
                    <div class="card-body">
                        <span class="card-category">${p.categoriaNombre}</span>
                        <h3 class="card-title">${p.nombre}</h3>
                        <p class="card-desc">${p.descripcion}</p>
                        ${contenidoHtml}
                        <span class="card-format"><i class="fas fa-${p.esPack ? 'cubes' : 'box'}"></i> ${p.formato}</span>
                        <div class="card-pricing">
                            ${pricingHtml}
                        </div>
                        <div class="card-actions">
                            <button class="${btnClass}" onclick="catalogo.toggleQuote('${p.id}')">${btnLabel}</button>
                            <a href="https://wa.me/56995052096?text=${encodeURIComponent('Hola, me interesa el ' + p.nombre + ' (' + p.formato + ')')}" target="_blank" class="btn-cotizar btn-whatsapp"><i class="fab fa-whatsapp"></i></a>
                        </div>
                    </div>
                </div>`;

            // Table Row
            let tableImgHtml = p.imagen
                ? `<div class="table-thumb" style="background-image: url('${p.imagen}');"></div>`
                : `<div class="table-thumb-placeholder"><i class="${p.categoriaIcono}"></i></div>`;

            let tableBadgeHtml = p.badge ? `<span class="table-badge ${getBadgeClass(p.badge)}">${p.badge}</span>` : '';

            tableHtml += `
                <tr>
                    <td><div class="table-product-name">${tableImgHtml}<div><strong>${p.nombre}</strong>${tableBadgeHtml ? '<br>' + tableBadgeHtml : ''}</div></div></td>
                    <td>${p.formato}</td>
                    <td><span class="table-price">${formatPrice(p.precioUnitario)}</span></td>
                    <td>${p.precioMayorista ? `<span class="table-price-mayorista">${formatPrice(p.precioMayorista)}</span>` : '—'}</td>
                    <td>${discount > 0 ? `<span class="table-discount">-${discount}%</span>` : '—'}</td>
                    <td>${p.umbralMayorista ? p.umbralMayorista + '+ uds.' : '—'}</td>
                    <td><button class="${inQuote ? 'table-btn added' : 'table-btn'}" onclick="catalogo.toggleQuote('${p.id}')">${inQuote ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}</button></td>
                </tr>`;
        });

        gridContainer.innerHTML = gridHtml;
        tableBody.innerHTML = tableHtml;
    }

    // ==================== QUOTATION ====================
    function toggleQuote(productId) {
        const existing = quotation.findIndex(q => q.product.id === productId);
        if (existing >= 0) {
            quotation.splice(existing, 1);
        } else {
            const product = productos.find(p => p.id === productId);
            if (product) {
                quotation.push({ product, qty: 1 });
            }
        }
        updateQuoteBar();
        renderProducts();
    }

    function updateQuoteBar() {
        if (quotation.length === 0) {
            quoteBar.classList.remove('visible');
            return;
        }

        quoteBar.classList.add('visible');

        const totalItems = quotation.length;
        let totalValue = 0;
        quotation.forEach(q => {
            totalValue += q.product.precioUnitario * q.qty;
        });

        quoteCount.textContent = `${totalItems} producto${totalItems !== 1 ? 's' : ''} seleccionado${totalItems !== 1 ? 's' : ''}`;
        quoteTotalValue.textContent = formatPrice(totalValue);
    }

    function clearQuote() {
        quotation = [];
        updateQuoteBar();
        renderProducts();
    }

    function sendWhatsApp() {
        if (quotation.length === 0) return;

        let msg = '🛒 *Cotización TRIFOOD*\n\n';
        quotation.forEach(q => {
            msg += `• ${q.product.nombre} (${q.product.formato}) — ${formatPrice(q.product.precioUnitario)}\n`;
        });
        msg += '\nSolicito cotización formal para estos productos. ¡Gracias!';

        const url = `https://wa.me/56995052096?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    // ==================== EXPORT PDF ====================
    async function exportPDF() {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const filtered = getFilteredProducts();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header Background (Pure Black to match web logo integration)
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, 50, 'F'); // Increased height

        // Logo
        try {
            const logoImg = document.querySelector('.hero-logo');
            if (logoImg) {
                const canvas = document.createElement('canvas');
                canvas.width = logoImg.naturalWidth;
                canvas.height = logoImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(logoImg, 0, 0);
                const logoData = canvas.toDataURL('image/png');
                // Larger logo and adjusted position
                doc.addImage(logoData, 'PNG', 15, 7, 35, 35);
            }
        } catch (e) {
            console.warn('No se pudo cargar el logo para el PDF', e);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        // Consistent offset for all text lines for perfect alignment
        const textOffset = 20; 
        doc.text('TRIFOOD', (pageWidth / 2) + textOffset, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Catálogo de Productos — Precios Unitarios y Mayoristas', (pageWidth / 2) + textOffset, 28, { align: 'center' });

        const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.setFontSize(8);
        doc.text(`Generado: ${today}`, (pageWidth / 2) + textOffset, 36, { align: 'center' });
        
        // Add validity date (requested to be easy to change)
        doc.setFont('helvetica', 'bold');
        doc.text('Valores válidos hasta el 31 de mayo del 2026', (pageWidth / 2) + textOffset, 42, { align: 'center' });

        // Table
        const headers = [['Producto', 'Formato', 'P. Unitario', 'P. Mayorista', 'Ahorro', 'Mín.']];
        const rows = filtered.map(p => {
            const discount = getDiscount(p.precioUnitario, p.precioMayorista);
            return [
                p.nombre,
                p.formato,
                formatPrice(p.precioUnitario),
                p.precioMayorista ? formatPrice(p.precioMayorista) : '—',
                discount > 0 ? `-${discount}%` : '—',
                p.umbralMayorista ? `${p.umbralMayorista}+ uds.` : '—'
            ];
        });

        doc.autoTable({
            head: headers,
            body: rows,
            startY: 58, // Adjusted to compensate for higher header
            styles: {
                fontSize: 9,
                cellPadding: 4,
                font: 'helvetica'
            },
            headStyles: {
                fillColor: [94, 139, 77],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5
            },
            alternateRowStyles: {
                fillColor: [248, 248, 248]
            },
            columnStyles: {
                0: { cellWidth: 55 },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right', textColor: [94, 139, 77], fontStyle: 'bold' },
                4: { halign: 'center' },
                5: { halign: 'center' }
            },
            margin: { left: 15, right: 15 }
        });

        // Footer
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('TRIFOOD — Experiencias Premium en Café y Chocolates Artesanales', pageWidth / 2, finalY, { align: 'center' });
        doc.text('WhatsApp: +56 9 9505 2096 | www.trifood.cl', pageWidth / 2, finalY + 5, { align: 'center' });
        doc.text('Precios en CLP. Sujetos a disponibilidad y cambios sin previo aviso.', pageWidth / 2, finalY + 10, { align: 'center' });

        doc.save('Catalogo_TRIFOOD.pdf');
      } catch (err) {
        console.error('Error exportando PDF:', err);
        alert('Error al generar PDF: ' + err.message);
      }
    }

    // ==================== EXPORT EXCEL ====================
    function exportExcel() {
      try {
        const filtered = getFilteredProducts();
        const data = filtered.map(p => {
            const discount = getDiscount(p.precioUnitario, p.precioMayorista);
            return {
                'Categoría': p.categoriaNombre,
                'Producto': p.nombre,
                'Formato': p.formato,
                'Precio Unitario': p.precioUnitario,
                'Precio Mayorista': p.precioMayorista || '',
                'Ahorro (%)': discount > 0 ? `${discount}%` : '',
                'Mínimo Mayorista': p.umbralMayorista ? `${p.umbralMayorista} unidades` : ''
            };
        });

        // Add header row
        const worksheet = XLSX.utils.json_to_sheet(data, { origin: 'A2' });
        XLSX.utils.sheet_add_aoa(worksheet, [['TRIFOOD — CATÁLOGO DE PRODUCTOS']], { origin: 'A1' });

        // Column widths
        worksheet['!cols'] = [
            { wch: 22 }, { wch: 35 }, { wch: 20 },
            { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 18 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, 'Catálogo TRIFOOD');
        XLSX.writeFile(wb, 'Catalogo_TRIFOOD.xlsx');
      } catch (err) {
        console.error('Error exportando Excel:', err);
        alert('Error al generar Excel: ' + err.message);
      }
    }

    // ==================== EVENT LISTENERS ====================
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
    document.getElementById('btn-clear-quote').addEventListener('click', clearQuote);
    document.getElementById('btn-send-whatsapp').addEventListener('click', sendWhatsApp);

    // ==================== PUBLIC API ====================
    window.catalogo = {
        toggleQuote
    };

    // ==================== INIT ====================
    loadProducts();

})();
