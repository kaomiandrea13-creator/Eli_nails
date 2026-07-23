document.addEventListener("DOMContentLoaded", () => {

  const loader = document.getElementById("loader");
  window.addEventListener("load", () => {
    setTimeout(() => loader.classList.add("hidden"), 350);
  });

  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar.style.boxShadow = window.scrollY > 10
      ? "0 6px 24px rgba(122,46,66,0.08)"
      : "none";
  });

  const navToggle = document.getElementById("navToggle");
  const navLinks = document.querySelector(".nav-links");
  navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  const btnTop = document.getElementById("btnTop");
  window.addEventListener("scroll", () => {
    btnTop.classList.toggle("visible", window.scrollY > 500);
  });
  btnTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const footerYear = document.getElementById("footerYear");
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const animatedEls = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  animatedEls.forEach(el => observer.observe(el));

  const numerosGrid = document.getElementById("numerosGrid");
  const sorteoCerradoMsg = document.getElementById("sorteoCerradoMsg");
  const btnParticipar = document.getElementById("btnParticipar");

  let configActual = null;

  configRef.onSnapshot((snap) => {
    if (!snap.exists) {
      configRef.set({
        premioNombre: "Manicura Acrílica",
        premioValor: 65,
        ticketPrecio: 5,
        premioImagenURL: "",
        qrYapeURL: "",
        totalNumeros: 12,
        sorteoActual: 1,
        sorteoAbierto: true,
        numerosOcupados: []
      });
      return;
    }

    configActual = snap.data();
    pintarNumeros(configActual);
    pintarPremioYPrecio(configActual);

    const cerrado = !configActual.sorteoAbierto;
    sorteoCerradoMsg.style.display = cerrado ? "flex" : "none";
    btnParticipar.disabled = cerrado;
    btnParticipar.innerHTML = cerrado
      ? 'Sorteo cerrado <i class="fa-solid fa-lock"></i>'
      : 'Participar <i class="fa-solid fa-heart"></i>';
  });

  function pintarNumeros(config) {
    const total = config.totalNumeros || 12;
    const ocupados = new Set(config.numerosOcupados || []);
    numerosGrid.innerHTML = "";

    for (let i = 1; i <= total; i++) {
      const ocupado = ocupados.has(i);
      const box = document.createElement("div");
      box.className = `boleto-num ${ocupado ? "ocupado" : "disponible"}`;
      box.innerHTML = `
        <span class="num">${String(i).padStart(2, "0")}</span>
        <span class="estado">${ocupado ? "Ocupado" : "Disponible"}</span>
      `;
      numerosGrid.appendChild(box);
    }
  }

  function pintarPremioYPrecio(config) {
    document.querySelectorAll(".premio-valor-monto").forEach(el => {
      if (config.premioValor) el.textContent = `S/${config.premioValor}`;
    });
    document.querySelectorAll(".hero-subtitle strong").forEach(el => {
      if (config.premioValor) el.textContent = `S/${config.premioValor}`;
    });
    document.querySelectorAll(".hero-badges span").forEach(el => {
      if (el.textContent.includes("Ticket") && config.ticketPrecio) {
        el.innerHTML = `<i class="fa-solid fa-ticket"></i> Ticket S/${config.ticketPrecio}`;
      }
    });
    if (config.premioImagenURL) {
      document.querySelectorAll('img[alt="Premio: Manicura Acrílica"], img[alt="Manicura Acrílica"]').forEach(img => {
        img.src = config.premioImagenURL;
      });
    }
    if (config.qrYapeURL) {
      const qrImg = document.querySelector('img[alt="Código QR de Yape"]');
      if (qrImg) qrImg.src = config.qrYapeURL;
    }
  }

  const inputComprobante = document.getElementById("comprobante");
  const fileUploadText = document.getElementById("fileUploadText");
  const previewImg = document.getElementById("previewImg");

  inputComprobante.addEventListener("change", () => {
    const file = inputComprobante.files[0];
    if (!file) return;
    fileUploadText.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  /* ---------- Comprime una imagen y la convierte a Base64 ----------
     Como no usamos Firebase Storage, guardamos la captura directo
     en el documento de Firestore. Para que quepa (límite ~1MB por
     documento), la reducimos de tamaño y comprimimos como JPEG. */
  function comprimirImagenABase64(file, maxAncho = 900, calidad = 0.6) {
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

  const registroForm = document.getElementById("registroForm");
  const formMsg = document.getElementById("formMsg");
  const boletoResult = document.getElementById("boletoResult");
  const boletoNumero = document.getElementById("boletoNumero");

  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "";
    formMsg.className = "form-msg";

    const nombre = document.getElementById("nombre").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.trim();
    const file = inputComprobante.files[0];

    if (!nombre || !whatsapp || !file) {
      formMsg.textContent = "Por favor completa todos los campos.";
      formMsg.className = "form-msg error";
      return;
    }

    if (!configActual || !configActual.sorteoAbierto) {
      formMsg.textContent = "Lo sentimos, el sorteo ya está cerrado.";
      formMsg.className = "form-msg error";
      return;
    }

    btnParticipar.disabled = true;
    btnParticipar.innerHTML = 'Enviando... <i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const comprobanteURL = await comprimirImagenABase64(file);

      const numeroAsignado = await db.runTransaction(async (transaction) => {
        const configSnap = await transaction.get(configRef);
        const config = configSnap.data();

        if (!config.sorteoAbierto) {
          throw new Error("SORTEO_CERRADO");
        }

        const total = config.totalNumeros || 12;
        const ocupados = config.numerosOcupados || [];
        const disponibles = [];
        for (let i = 1; i <= total; i++) {
          if (!ocupados.includes(i)) disponibles.push(i);
        }

        if (disponibles.length === 0) {
          throw new Error("SORTEO_CERRADO");
        }

        const numero = disponibles[Math.floor(Math.random() * disponibles.length)];
        const nuevosOcupados = [...ocupados, numero];

        transaction.update(configRef, {
          numerosOcupados: nuevosOcupados,
          sorteoAbierto: nuevosOcupados.length < total
        });

        const nuevoDocRef = participantesRef.doc();
        transaction.set(nuevoDocRef, {
          nombre,
          whatsapp,
          numero,
          estadoPago: "pendiente",
          comprobanteURL,
          fecha: firebase.firestore.FieldValue.serverTimestamp(),
          sorteoId: config.sorteoActual || 1
        });

        return numero;
      });

      boletoNumero.textContent = `#${String(numeroAsignado).padStart(2, "0")}`;
      boletoResult.style.display = "block";
      boletoResult.classList.add("in-view");
      registroForm.reset();
      previewImg.style.display = "none";
      fileUploadText.textContent = "Toca para subir tu captura";
      boletoResult.scrollIntoView({ behavior: "smooth", block: "center" });

    } catch (err) {
      console.error(err);
      formMsg.textContent = err.message === "SORTEO_CERRADO"
        ? "Lo sentimos, todos los números ya fueron asignados."
        : "Ocurrió un error al registrar tu participación. Intenta de nuevo.";
      formMsg.className = "form-msg error";
    } finally {
      if (configActual && configActual.sorteoAbierto) {
        btnParticipar.disabled = false;
        btnParticipar.innerHTML = 'Participar <i class="fa-solid fa-heart"></i>';
      }
    }
  });

});
