document.addEventListener('DOMContentLoaded', () => {
    const invoiceTextArea = document.getElementById('invoice-text');
    const btnMiracle = document.getElementById('btn-miracle');
    const btnBora = document.getElementById('btn-bora');
    const clientInput = document.getElementById('invoice-client');
    const providerInput = document.getElementById('invoice-provider');
    const amountInput = document.getElementById('invoice-amount');
    const addInvoiceBtn = document.getElementById('add-invoice-btn');
    const filterClientSelect = document.getElementById('filter-client');
    const pendingList = document.getElementById('pending-list');
    const paidList = document.getElementById('paid-list');

    let clientes = JSON.parse(localStorage.getItem('auto_clientes')) || [];
    let facturas = JSON.parse(localStorage.getItem('auto_facturas')) || [];

    btnMiracle.addEventListener('click', () => {
        const text = invoiceTextArea.value;
        if (!text.trim()) return alert("Por favor, pega el texto primero.");
        
        let cliente = "REVISAR MANUAL";
        let monto = "";

        const matchCliente = text.match(/CLIENTE:\s*(.*)/i);
        if (matchCliente) cliente = matchCliente[1].trim();

        const matchMonto = text.match(/TOTAL A PAGAR\s*\$?[\s]*([\d.,]+)/i);
        if (matchMonto) monto = matchMonto[1].replace(/[^0-9.]/g, '');

        clientInput.value = cliente.toUpperCase();
        providerInput.value = "LABORATORIO OPTICO MIRACLE SAS";
        amountInput.value = monto;
    });

    btnBora.addEventListener('click', () => {
        const text = invoiceTextArea.value;
        if (!text.trim()) return alert("Por favor, pega el texto primero.");
        
        let cliente = "REVISAR MANUAL";
        let monto = "";

        const matchCliente = text.match(/Adquiriente\s*(.*)/i);
        if (matchCliente) cliente = matchCliente[1].trim();

        const matchMonto = text.match(/TOTAL COPS\s*([\d.,]+)/i);
        if (matchMonto) monto = matchMonto[1].replace(/[^0-9.]/g, '');

        clientInput.value = cliente.toUpperCase();
        providerInput.value = "BORA LENS SAS";
        amountInput.value = monto;
    });

    addInvoiceBtn.addEventListener('click', () => {
        const nombreCliente = clientInput.value.trim();
        const proveedor = providerInput.value.trim();
        const monto = amountInput.value.trim();

        if (!nombreCliente || !proveedor || !monto) return alert("Llena los campos primero.");

        let clienteExistente = clientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
        if (!clienteExistente) {
            clienteExistente = { id: 'cli_' + Date.now(), nombre: nombreCliente };
            clientes.push(clienteExistente);
        }

        facturas.push({ id: 'fac_' + Date.now(), clienteId: clienteExistente.id, proveedor, monto, pagada: false });
        invoiceTextArea.value = ''; clientInput.value = ''; providerInput.value = ''; amountInput.value = '';
        guardarYActualizar();
    });

    window.cambiarEstadoFactura = (id) => {
        facturas = facturas.map(f => f.id === id ? { ...f, pagada: !f.pagada } : f);
        guardarYActualizar();
    };

    window.eliminarFactura = (id) => {
        if (confirm("¿Eliminar?")) { facturas = facturas.filter(f => f.id !== id); guardarYActualizar(); }
    };

    filterClientSelect.addEventListener('change', () => actualizarListasFacturas());

    function guardarYActualizar() {
        localStorage.setItem('auto_clientes', JSON.stringify(clientes));
        localStorage.setItem('auto_facturas', JSON.stringify(facturas));
        filterClientSelect.innerHTML = '<option value="todos">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nombre;
            filterClientSelect.appendChild(opt);
        });
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
                <div class="invoice-info"><span>👤 ${cliente ? cliente.nombre : 'Desconocido'}</span><span><strong>${f.proveedor}</strong></span><span>$ ${f.monto}</span></div>
                <div class="invoice-actions">
                    <button type="button" class="action-btn" onclick="cambiarEstadoFactura('${f.id}')">${f.pagada ? 'Reabrir' : 'Pagar'}</button>
                    <button type="button" class="delete-btn" onclick="eliminarFactura('${f.id}')">❌</button>
                </div>`;
            if (f.pagada) paidList.appendChild(li); else pendingList.appendChild(li);
        });
    }
    guardarYActualizar();
});