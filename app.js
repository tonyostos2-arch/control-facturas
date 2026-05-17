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

    // CONFIGURACIÓN DE LA API (Ya integrada permanentemente)
    const apiKey = "K85959877288957"; 

    let clientes = JSON.parse(localStorage.getItem('auto_clientes')) || [];
    let facturas = JSON.parse(localStorage.getItem('auto_facturas')) || [];

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
                const extractedText = data.ParsedResults[0].ParsedText;
                statusDiv.className = "status success";
                statusDiv.innerText = "¡Lectura completada con éxito!";
                procesarTextoFactura(extractedText);
            } else {
                throw new Error(data.ErrorMessage || "No se pudo extraer texto de la imagen.");
            }

        } catch (err) {
            console.error(err);
            statusDiv.className = "status error";
            statusDiv.innerText = "Error: El servidor no pudo procesar esta imagen.";
        }
    });

    function procesarTextoFactura(text) {
        let cliente = "REVISAR MANUALMENTE";
        let proveedor = "PROVEEDOR DESCONOCIDO";
        let monto = "";

        const textoCompleto = text.toUpperCase();

        if (textoCompleto.includes("MIRACLE")) {
            proveedor = "LABORATORIO OPTICO MIRACLE SAS";
            const matchCliente = text.match(/CLIENTE:\s*(.*)/i);
            if (matchCliente) cliente = matchCliente[1].trim();
            const matchMonto = text.match(/TOTAL A PAGAR\s*\$?[\s]*([\d.,]+)/i);
            if (matchMonto) monto = matchMonto[1].replace(/[^0-9.]/g, '');
        } 
        else if (textoCompleto.includes("BORA")) {
            proveedor = "BORA LENS SAS";
            const matchCliente = text.match(/Adquiriente\s*(.*)/i);
            if (matchCliente) cliente = matchCliente[1].trim();
            const matchMonto = text.match(/TOTAL COPS\s*([\d.,]+)/i);
            if (matchMonto) monto = matchMonto[1].replace(/[^0-9.]/g, '');
        }

        // Si los buscadores específicos no pescan el número, este busca el último valor numérico largo
        if (!monto) {
            const montosEncontrados = text.match(/\b\d{1,3}([.,]\d{3})+(?!\b)/g);
            if (montosEncontrados) monto = montosEncontrados[montosEncontrados.length - 1];
        }

        clientInput.value = cliente.toUpperCase();
        providerInput.value = proveedor;
        amountInput.value = monto;
    }

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
