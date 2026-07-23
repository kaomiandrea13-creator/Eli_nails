const path = window.location.pathname;
const esPaginaLogin = path.includes("login.html");

if (esPaginaLogin) {
  const loginForm = document.getElementById("loginForm");
  const loginMsg = document.getElementById("loginMsg");
  const btnLogin = document.getElementById("btnLogin");

  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = "admin.html";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;
    btnLogin.disabled = true;
    btnLogin.innerHTML = 'Ingresando... <i class="fa-solid fa-spinner fa-spin"></i>';
    loginMsg.textContent = "";

    try {
      await auth.signInWithEmailAndPassword(ADMIN_EMAIL, password);
      window.location.href = "admin.html";
    } catch (err) {
      loginMsg.textContent = "Contraseña incorrecta. Intenta de nuevo.";
      loginMsg.className = "login-msg error";
      btnLogin.disabled = false;
      btnLogin.innerHTML = 'Ingresar <i class="fa-solid fa-arrow-right-to-bracket"></i>';
    }
  });
}

if (!esPaginaLogin) {

  auth.onAuthStateChanged((user) => {
    if (!user) window.location.href = "login.html";
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
  });

  let participantesCache = [];
  let configCache = null;

  const inputPremioNombre = document.getElementById("inputPremioNombre");
  const inputPremioValor = document.getElementById("inputPremioValor");
  const inputTicketPrecio = document.getElementById("inputTicketPrecio");
  const inputTotalNumeros = document.getElementById("inputTotalNumeros");
  const sorteoEstadoLabel = document.getElementById("sorteoEstadoLabel");
  const statDisponibles = document.getElementById("statDisponibles");

  configRef.onSnapshot((snap) => {
    if (!snap.exists) return;
    configCache = snap.data();

    inputPremioNombre.value = configCache.premioNombre || "";
    inputPremioValor.value = configCache.premioValor || "";
    inputTicketPrecio.value = configCache.ticketPrecio || "";
    inputTotalNumeros.value = configCache.totalNumeros || 12;

    const total = configCache.totalNumeros || 12;
    const ocupados = (configCache.numerosOcupados || []).length;
    statDisponibles.textContent = total - ocupados;

    sorteoEstadoLabel.innerHTML = configCache.sorteoAbierto
      ? `<i class="fa-solid fa-lock-open"></i> Sorteo abierto (${ocupados}/${total} números asignados)`
      : `<i class="fa-solid fa-lock"></i> Sorteo cerrado (${ocupados}/${total} números asignados)`;
  });

  document.getElementById("formPremio").addEventListener("submit", async (e) => {
    e.preventDefault();
    const premioMsg = document.getElementById("premioMsg");
    try {
      await configRef.update({
        premioNombre: inputPremioNombre.value.trim(),
        premioValor: Number(inputPremioValor.value) || 0,
        ticketPrecio: Number(inputTicketPrecio.value) || 0,
        totalNumeros: Number(inputTotalNumeros.value) || 12
      });
      premioMsg.textContent = "Cambios guardados.";
      premioMsg.className = "admin-msg success";
    } catch (err) {
      premioMsg.textContent = "No se pudo guardar. Intenta de nuevo.";
      premioMsg.className = "admin-msg error";
    }
  });

  /* ---------- Comprime una imagen y la convierte a Base64
     (no usamos Firebase Storage, se guarda directo en Firestore) ---------- */
  function comprimirImagenABase64(file, maxAncho = 800, calidad = 0.7) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Subir nueva foto del premio ---------- */
  document.getElementById("inputFotoPremio").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = document.getElementById("fotoPremioMsg");
    msg.textContent = "Subiendo imagen...";
    msg.className = "admin-msg";
    try {
      const base64 = await comprimirImagenABase64(file);
      await configRef.update({ premioImagenURL: base64 });
      msg.textContent = "Foto del premio actualizada.";
      msg.className = "admin-msg success";
    } catch (err) {
      msg.textContent = "Error al subir la imagen.";
      msg.className = "admin-msg error";
    }
  });

  /* ---------- Subir nuevo QR de Yape ---------- */
  document.getElementById("inputQR").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = document.getElementById("qrMsg");
    msg.textContent = "Subiendo QR...";
    msg.className = "admin-msg";
    try {
      const base64 = await comprimirImagenABase64(file, 500, 0.8);
      await configRef.update({ qrYapeURL: base64 });
      msg.textContent = "QR actualizado.";
      msg.className = "admin-msg success";
    } catch (err) {
      msg.textContent = "Error al subir el QR.";
      msg.className = "admin-msg error";
    }
  });

  document.getElementById("btnCerrarSorteo").addEventListener("click", async () => {
    if (!confirm("¿Cerrar el sorteo? No se asignarán más números hasta que abras uno nuevo.")) return;
    await configRef.update({ sorteoAbierto: false });
  });

  document.getElementById("btnAbrirNuevo").addEventListener("click", async () => {
    if (!confirm("¿Abrir un nuevo sorteo? Los números se reiniciarán y las participantes anteriores quedarán guardadas en el historial.")) return;
    const nuevoSorteoId = (configCache?.sorteoActual || 1) + 1;
    await configRef.update({
      sorteoActual: nuevoSorteoId,
      numerosOcupados: [],
      sorteoAbierto: true
    });
  });

  const tbody = document.getElementById("tablaParticipantesBody");
  const tablaVacia = document.getElementById("tablaVacia");
  const statTotal = document.getElementById("statTotal");
  const statConfirmados = document.getElementById("statConfirmados");
  const statPendientes = document.getElementById("statPendientes");

  participantesRef.orderBy("numero", "asc").onSnapshot((snap) => {
    participantesCache = [];
    snap.forEach(doc => participantesCache.push({ id: doc.id, ...doc.data() }));

    const sorteoActual = configCache?.sorteoActual || 1;
    const visibles = participantesCache.filter(p => (p.sorteoId || 1) === sorteoActual);

    statTotal.textContent = visibles.length;
    statConfirmados.textContent = visibles.filter(p => p.estadoPago === "confirmado").length;
    statPendientes.textContent = visibles.filter(p => p.estadoPago === "pendiente").length;

    tablaVacia.style.display = visibles.length === 0 ? "block" : "none";
    tbody.innerHTML = "";

    visibles.forEach(p => {
      const fecha = p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString("es-PE") : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${String(p.numero).padStart(2, "0")}</strong></td>
        <td>${escapeHTML(p.nombre)}</td>
        <td>${escapeHTML(p.whatsapp)}</td>
        <td>${p.comprobanteURL ? `<a href="#" class="link-comprobante" data-url="${p.comprobanteURL}">Ver captura</a>` : "—"}</td>
        <td><span class="badge ${p.estadoPago === "confirmado" ? "badge-confirmado" : "badge-pendiente"}">
              <i class="fa-solid ${p.estadoPago === "confirmado" ? "fa-circle-check" : "fa-clock"}"></i>
              ${p.estadoPago === "confirmado" ? "Confirmado" : "Pendiente"}
            </span></td>
        <td>${fecha}</td>
        <td>
          <div class="acciones-cell">
            <button class="icon-btn confirm" title="Confirmar pago" data-accion="confirmar" data-id="${p.id}"><i class="fa-solid fa-check"></i></button>
            <button class="icon-btn" title="Editar" data-accion="editar" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" title="Eliminar" data-accion="eliminar" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  function escapeHTML(str = "") {
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  tbody.addEventListener("click", async (e) => {
    const linkComprobante = e.target.closest(".link-comprobante");
    if (linkComprobante) {
      e.preventDefault();
      abrirModalComprobante(linkComprobante.dataset.url);
      return;
    }

    const btn = e.target.closest("button[data-accion]");
    if (!btn) return;
    const { accion, id } = btn.dataset;
    const participante = participantesCache.find(p => p.id === id);
    if (!participante) return;

    if (accion === "confirmar") {
      await participantesRef.doc(id).update({
        estadoPago: participante.estadoPago === "confirmado" ? "pendiente" : "confirmado"
      });
    }

    if (accion === "editar") {
      abrirModalEditar(participante);
    }

    if (accion === "eliminar") {
      if (confirm(`¿Eliminar a ${participante.nombre} del sorteo? Esta acción no se puede deshacer.`)) {
        await participantesRef.doc(id).delete();
      }
    }
  });

  const modalEditar = document.getElementById("modalEditar");
  function abrirModalEditar(p) {
    document.getElementById("editId").value = p.id;
    document.getElementById("editNombre").value = p.nombre;
    document.getElementById("editWhatsapp").value = p.whatsapp;
    document.getElementById("editNumero").value = p.numero;
    modalEditar.classList.add("visible");
  }
  document.getElementById("btnCancelarEditar").addEventListener("click", () => modalEditar.classList.remove("visible"));

  document.getElementById("formEditar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    await participantesRef.doc(id).update({
      nombre: document.getElementById("editNombre").value.trim(),
      whatsapp: document.getElementById("editWhatsapp").value.trim(),
      numero: Number(document.getElementById("editNumero").value)
    });
    modalEditar.classList.remove("visible");
  });

  const modalComprobante = document.getElementById("modalComprobante");
  function abrirModalComprobante(url) {
    document.getElementById("imgComprobanteGrande").src = url;
    modalComprobante.classList.add("visible");
  }
  document.getElementById("btnCerrarComprobante").addEventListener("click", () => modalComprobante.classList.remove("visible"));

  document.getElementById("btnExportar").addEventListener("click", () => {
    const sorteoActual = configCache?.sorteoActual || 1;
    const visibles = participantesCache.filter(p => (p.sorteoId || 1) === sorteoActual);

    const datos = visibles.map(p => ({
      "Número": p.numero,
      "Nombre": p.nombre,
      "WhatsApp": p.whatsapp,
      "Estado de pago": p.estadoPago === "confirmado" ? "Confirmado" : "Pendiente",
      "Fecha de registro": p.fecha?.toDate ? p.fecha.toDate().toLocaleString("es-PE") : "",
      "Comprobante (link)": p.comprobanteURL || ""
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Participantes");
    XLSX.writeFile(libro, `Eli-Nails-Sorteo-${sorteoActual}.xlsx`);
  });
                         }
