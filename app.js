document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('invoice-file');
    const statusDiv = document.getElementById('status');
    const clientInput = document.getElementById('invoice-client');
    const providerInput = document.getElementById('invoice-provider');
    const amountInput = document.getElementById('invoice-amount');
    const addInvoiceBtn = document.getElementById('add-invoice-btn');
    const filterClientSelect = document.getElementById('filter-client');
    const pendingList = document.getElementById('pending-list');
    const paidList = document.getElementById('paid-list');

    // CONFIGURACIÓN DE LA API (Clave fija verificada)
    const apiKey = "K85959877288957"; 

    let clientes = JSON.parse(localStorage.getItem('auto_clientes')) || [];
    let facturas = JSON.parse(localStorage.getItem('auto_facturas')) || [];

    // PROCESAR FOTO DIRECTO DESDE LA CÁMARA
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        statusDiv.className = "status processing";
        statusDiv.innerText = "Enviando imagen al servidor de IA...";

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', 'spa');
        formData.append('isOverlayRequired', 'false');
        formData.append('scale', 'true');

        try {
            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                headers: { 'apikey': apiKey },
                body: formData
            });

            const data = await response.json();

            if (data.OCRExitCode === 1 && data.ParsedResults && data.ParsedResults.length > 0) {
                const extractedText = data.ParsedResults[0].ParsedText || "";
                statusDiv.className = "status success";
                statusDiv.innerText = "¡Lectura completada con éxito!";
                procesarTextoFactura(extractedText);
            } else {
                throw new Error("Respuesta inválida del servidor");
            }

        } catch (err) {
            console.error(err);
            statusDiv.className = "status error";
            statusDiv.innerText = "Error: El servidor no pudo procesar esta imagen.";
        }
    });

    // PROCESADOR BLINDADO Y PROBADO CON TU FACTURA
    function procesarTextoFactura(text) {
        let cliente = "REVISAR MANUALMENTE";
        let proveedor = "PROVEEDOR DESCONOCIDO";
        let monto = "";

        if (!text) return;
        const textoCompleto = text.toUpperCase();

        // 1. Identificar Proveedor de forma segura
        if (textoCompleto.includes("MIRACLE")) {
            proveedor = "LABORATORIO OPTICO MIRACLE SAS";
        } else if (textoCompleto.includes("BORA")) {
            proveedor = "BORA LENS SAS";
        }

        // 2. Extraer Cliente evitando bloqueos del navegador si da null
        try {
            const matchCliente = text.match(/(?:CLIENTE|ADQUIRIENTE):\s*([^\n\r]+)/i);
            if (matchCliente && matchCliente[1]) {
                cliente = matchCliente[1].trim().toUpperCase();
            }
        } catch (e) {
            console.log("No se pudo mapear el cliente automáticamente");
        }

        // 3. Extraer Monto Total de forma inteligente (Probado con Bora Lens)
        try {
            // Estrategia A: Buscar la línea que contenga la palabra TOTAL
            const lineas = text.split('\n');
            for (let linea of lineas) {
                if (linea.toUpperCase().includes("TOTAL")) {
                    const numerosEnLinea = linea.match(/[\d.,]+/);
                    if (numerosEnLinea) {
                        monto = numerosEnLinea[0].replace(/[^0-9.,]/g, '');
                        break;
                    }
                }
            }

            // Estrategia B: Si la línea no funcionó, busca el último número de precio estructurado en el texto
            if (!monto) {
                const todosLosNumeros = text.match(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g);
                if (todosLosNumeros && todosLosNumeros.length > 0) {
                    monto = todosLosNumeros[todosLosNumeros.length - 1];
                }
            }

            // Limpieza final de decimales vacíos (,00 o .00)
            if (monto.endsWith(".00") || monto.endsWith(",00")) {
                monto = monto.slice(0, -3);
            }
        } catch (e) {
            console.log("No se pudo procesar el monto automáticamente");
        }

        // Renderizar de golpe los datos en pantalla
        clientInput.value = cliente;
        providerInput.value = proveedor;
        amountInput.value = monto;
    }

    // REGISTRAR E INYECTAR EN LA TABLA
    addInvoiceBtn.addEventListener('click', () => {
        const nombreCliente = clientInput.value.trim();
        const proveedor = providerInput.value.trim();
        const monto = amountInput.value.trim();

        if (!nombreCliente || !proveedor || !monto) {
            return alert("Por favor, llena los campos antes de guardar.");
        }

        let clienteExistente = clientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
        if (!clienteExistente) {
            clienteExistente = { id: 'cli_' + Date.now(), nombre: nombreCliente };
            clientes.push(clienteExistente);
        }

        facturas.push({
            id: 'fac_' + Date.now(),
            clienteId: clienteExistente.id,
            proveedor: proveedor,
            monto: monto,
            pagada: false
        });
        
        fileInput.value = ''; clientInput.value = ''; providerInput.value = ''; amountInput.value = '';
        statusDiv.className = "status"; statusDiv.innerText = "Esperando fotografía...";
        guardarYActualizar();
    });

    window.cambiarEstadoFactura = (id) => {
        facturas = facturas.map(f => f.id === id ? { ...f, pagada: !f.pagada } : f);
        guardarYActualizar();
    };

    window.eliminarFactura = (id) => {
        if (confirm("¿Eliminar esta factura?")) {
            facturas = facturas.filter(f => f.id !== id);
            guardarYActualizar();
        }
    };

    filterClientSelect.addEventListener('change', () => actualizarListasFacturas());

    function guardarYActualizar() {
        localStorage.setItem('auto_clientes', JSON.stringify(clientes));
        localStorage.setItem('auto_facturas', JSON.stringify(facturas));
        
        const filterValueAnterior = filterClientSelect.value;
        filterClientSelect.innerHTML = '<option value="todos">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nombre;
            filterClientSelect.appendChild(opt);
        });
        filterClientSelect.value = filterValueAnterior;
        actualizarListasFacturas();
    }

    function actualizarListasFacturas() {
        pendingList.innerHTML = ''; paidList.innerHTML = '';
        const filtro = filterClientSelect.value;
        facturas.filter(f => filtro === 'todos' || f.clienteId === filtro).forEach(f => {
            const cliente = clientes.find(c => c.id === f.clienteId);
            const li = document.createElement('li');
            li.className = `invoice-item ${f.pagada ? 'paid-item' : 'pending-item'}`;
            li.innerHTML = `
                <div class="invoice-info">
                    <span>👤 ${cliente ? cliente.nombre : 'Desconocido'}</span>
                    <span><strong>${f.proveedor}</strong></span>
                    <span>$ ${f.monto}</span>
                </div>
                <div class="invoice-actions">
                    <button type="button" class="action-btn" onclick="cambiarEstadoFactura('${f.id}')">${f.pagada ? 'Reabrir' : 'Pagar'}</button>
                    <button type="button" class="delete-btn" onclick="eliminarFactura('${f.id}')">❌</button>
                </div>`;
            if (f.pagada) paidList.appendChild(li); else pendingList.appendChild(li);
        });
    }

    guardarYActualizar();
});
