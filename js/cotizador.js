/**
 * js/cotizador.js - Lógica principal del cotizador.
 */

// Estado global
let productosExcel = []; // Productos cargados desde /data/productos.xlsx
let filasCotizacion = []; // Estado de productos añadidos a la GUI

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    registrarEventosClient();
    establecerFechaEmision();
    agregarFilaVacia(); // al menos una fila al cargar
    
    // Botones
    document.getElementById('btn-add-product').addEventListener('click', agregarFilaVacia);
    document.getElementById('btn-export-pdf').addEventListener('click', generarPDFyGuardarBD);
    document.getElementById('btn-export-excel').addEventListener('click', generarExcel);

    // Cargar productos
    await fetchProductosExcel();
}

/** 
 * Leer data/productos.xlsx desde el servidor (fetch)
 * Usa SheetJS (xlsx)
 */
async function fetchProductosExcel() {
    const statusEl = document.getElementById('excel-status');
    try {
        const response = await fetch('data/productos.xlsx');
        if (!response.ok) {
            throw new Error("No se encontró el archivo");
        }
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Asume que la info está en la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convierte a JSON. header: 1 te da un array de arrays, pero omitimos headers usando keys predefinidos o solo raw
        const jsonRAW = XLSX.utils.sheet_to_json(worksheet);
        
        // Transformar claves a formato genérico por si vienen raras
        // Se espera que tenga NombreProducto/Producto, Precio, etc.
        productosExcel = jsonRAW.map(p => {
            const keys = Object.keys(p);
            return {
                nombre: p['Nombre'] || p['NombreProducto'] || p['Producto'] || p[keys[0]] || 'Sin nombre',
                precio: p['Precio'] || p['Costo'] || p['Valor'] || p[keys[1]] || 0,
                detalles: p['Detalle'] || p['Detalles'] || p['Descripción'] || p[keys[2]] || ''
            };
        });

        statusEl.textContent = `✅ ${productosExcel.length} proc. de Excel`;
        statusEl.className = 'status-badge success';
        
        // Actualizar dropdowns existentes
        actualizarTodosLosDatalists();

    } catch (error) {
        statusEl.textContent = '❌ Sin conexión a Excel (Modo Manual)';
        statusEl.className = 'status-badge error';
        console.warn('TriFood: Archivo data/productos.xlsx no encontrado. Trabajando en modo manual.', error);
    }
}

/**
 * Registra listeners en el input del panel izquierdo para actualizar el PDF (data binding unidireccional simple)
 */
function registrarEventosClient() {
    const map = {
        'cliente_empresa': 'pdf_cliente',
        'cliente_rut': 'pdf_rut',
        'cliente_direccion': 'pdf_direccion',
        'cliente_contacto': 'pdf_contacto',
        'cotizacion_fechas': 'pdf_fechas',
        'obs_plazo': 'pdf_obs_plazo'
    };

    for (let [inputId, pdfId] of Object.entries(map)) {
        const input = document.getElementById(inputId);
        const pdfText = document.getElementById(pdfId);
        if (input && pdfText) {
            input.addEventListener('input', () => {
                pdfText.textContent = input.value;
            });
        }
    }
}

function establecerFechaEmision() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('pdf_fecha_emision').textContent = `${day}-${month}-${year}`;
}

/**
 * Formularios Dinámicos de Productos
 */
function agregarFilaVacia() {
    const id = Date.now().toString() + Math.floor(Math.random()*1000);
    const container = document.getElementById('product-rows-container');
    
    // Crear el elemento HTML en el form
    const formRow = document.createElement('div');
    formRow.className = 'product-form-row';
    formRow.id = `form-row-${id}`;
    
    // Creamos datalist único por fila
    const datalistId = `dl-${id}`;
    
    formRow.innerHTML = `
        <div class="row-header">
            <h4>Item</h4>
            <button class="btn btn-sm btn-danger" onclick="eliminarFila('${id}')">x</button>
        </div>
        <div class="row-inputs">
            <div class="input-group sm">
                <label>Cant.</label>
                <input type="number" min="1" value="1" id="cant-${id}">
            </div>
            <div class="input-group md grow">
                <label>Producto</label>
                <input type="text" id="prod-${id}" list="${datalistId}" placeholder="Buscar en Excel...">
                <datalist id="${datalistId}"></datalist>
            </div>
            <div class="input-group md">
                <label>Precio Unit ($)</label>
                <input type="number" id="precio-${id}" value="0">
            </div>
        </div>
        <div class="input-group">
            <label>Detalles / Observaciones</label>
            <input type="text" id="detalle-${id}" placeholder="Ej: Colores Corporativos Según Cliente">
        </div>
    `;
    
    container.appendChild(formRow);

    // Poblar datalist con la BD q exista
    poblarDatalist(document.getElementById(datalistId));

    // Listeners interactivos
    const inputs = ['cant', 'prod', 'precio', 'detalle'].map(pfx => document.getElementById(`${pfx}-${id}`));
    
    // Detectar si selecciona algo de la lista de producto
    const prodInput = document.getElementById(`prod-${id}`);
    prodInput.addEventListener('change', (e) => {
        const selected = productosExcel.find(p => p.nombre === e.target.value);
        if (selected) {
            document.getElementById(`precio-${id}`).value = selected.precio || 0;
            const detInput = document.getElementById(`detalle-${id}`);
            if (!detInput.value) {
                detInput.value = selected.detalles || '';
            }
            calcularTodo();
        }
    });

    inputs.forEach(input => input.addEventListener('input', calcularTodo));
    
    filasCotizacion.push(id);
    calcularTodo();
}

function actualizarTodosLosDatalists() {
    filasCotizacion.forEach(id => {
        poblarDatalist(document.getElementById(`dl-${id}`));
    });
}

function poblarDatalist(datalist) {
    if(!datalist) return;
    datalist.innerHTML = productosExcel.map(p => `<option value="${p.nombre}"></option>`).join('');
}

window.eliminarFila = (id) => {
    document.getElementById(`form-row-${id}`).remove();
    filasCotizacion = filasCotizacion.filter(fid => fid !== id);
    calcularTodo();
}

const formatearDinero = (num) => {
    if(!num) return '$0';
    return '$' + parseInt(num).toLocaleString('es-CL');
};

/**
 * MOTOR MATEMÁTICO & PDF RENDER
 */
function calcularTodo() {
    let subtotal = 0;
    const tbody = document.getElementById('pdf-tbody');
    tbody.innerHTML = '';

    filasCotizacion.forEach(id => {
        const cant = parseFloat(document.getElementById(`cant-${id}`).value) || 0;
        const nombre = document.getElementById(`prod-${id}`).value || '';
        const precio = parseFloat(document.getElementById(`precio-${id}`).value) || 0;
        const det = document.getElementById(`detalle-${id}`).value || '';

        subtotal += (cant * precio);

        // Agregamos al render PDF si hay nombre
        // Se hace un rowspan=2 engañoso en "Cantidad" y "Precio" para poner el sub-detalle bajo nombre si se desea (siguiendo mockup), 
        // pero simplifiquémoslo con subtexto en la misma celda de Producto.
        if (nombre || cant > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="center-col">${cant || ''}</td>
                <td class="prod-col">
                    <span class="p-title">${nombre}</span><br>
                    <span class="p-sub">${det}</span>
                </td>
                <td class="money-col">${formatearDinero(precio)}</td>
                <td class="empty-col"></td> <!-- Columna de detalles original. Movimos detalle del input al nombre, pero si querian columna "Detalles" usarla -->
            `;
            // Reajuste: el usuario tiene una columna "Detalles". Pongamos el detalle alli.
            tr.innerHTML = `
                <td class="center-col">${cant || ''}</td>
                <td class="prod-col"><span class="p-title">${nombre}</span></td>
                <td class="money-col">${formatearDinero(precio)}</td>
                <td class="details-col"><span class="p-sub">${det}</span></td>
            `;
            tbody.appendChild(tr);
        }
    });

    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    document.getElementById('pdf_subtotal').textContent = formatearDinero(subtotal);
    document.getElementById('pdf_iva').textContent = formatearDinero(iva);
    document.getElementById('pdf_total').textContent = formatearDinero(total);
}

/** 
 * API: Guardar cliente silenciosamente en Node y luego exportar PDF
 */
async function generarPDFyGuardarBD() {
    const form = document.getElementById('cotizador-form');
    if (!form.reportValidity()) {
        return; // Obliga a llenar requeridos (Empresa, Email)
    }

    const clientData = {
        empresa: document.getElementById('cliente_empresa').value,
        rut: document.getElementById('cliente_rut').value,
        contacto: document.getElementById('cliente_contacto').value,
        direccion: document.getElementById('cliente_direccion').value,
        email: document.getElementById('cliente_email').value,
        telefono: document.getElementById('cliente_telefono').value,
    };

    // Manda POST al server.js
    try {
        await fetch('/api/save-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        console.log("TriFood: Database CRM actualizada exitosamente.");
    } catch(err) {
        console.warn("Fallo guardando en servidor CRM", err);
    }

    // Exportar a PDF
    const element = document.getElementById('pdf-document');
    
    // Cambiar estilos temporales para la exportación (pdf requiere dimensiones fijas exactas a A4 a veces)
    const opt = {
        margin:       [0.2, 0.2, 0.2, 0.2], // in inches
        filename:     `Cotizacion_TriFood_${clientData.empresa.replace(/[^a-z0-9]/gi, '_') || 'Nuevo'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

/**
 * Exportar a Excel
 */
function generarExcel() {
    const empresaName = document.getElementById('cliente_empresa').value || 'Generico';
    
    // Acomodar datos para Excel
    let data = [];
    
    data.push(["Empresa", empresaName]);
    data.push(["Fecha", document.getElementById('pdf_fecha_emision').textContent]);
    data.push([]); // blank row
    data.push(["Cantidad #", "Producto", "Precio Unitario", "Detalles", "Total Línea"]);

    filasCotizacion.forEach(id => {
        const cant = parseFloat(document.getElementById(`cant-${id}`).value) || 0;
        const nombre = document.getElementById(`prod-${id}`).value || '';
        const precio = parseFloat(document.getElementById(`precio-${id}`).value) || 0;
        const det = document.getElementById(`detalle-${id}`).value || '';
        
        if(nombre) {
            data.push([cant, nombre, precio, det, cant*precio]);
        }
    });

    data.push([]);
    const sub = document.getElementById('pdf_subtotal').textContent;
    data.push(["", "", "", "SUBTOTAL:", sub]);
    data.push(["", "", "", "IVA 19%:", document.getElementById('pdf_iva').textContent]);
    data.push(["", "", "", "TOTAL:", document.getElementById('pdf_total').textContent]);

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizacion");

    // Descarga
    XLSX.writeFile(wb, `Cotizacion_${empresaName.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
}
