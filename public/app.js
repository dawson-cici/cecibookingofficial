const API = "https://ceci-desk.djholmberg01.workers.dev/api/public";
const CECI = "525573022862";
const READINGS = [
  { id: "integral", name: "Lectura Integral", minutes: 45, mxn: 700, usd: 50, title: "🌙 Lectura Integral", text: "Ideal para explorar el área de tu vida que hoy necesita mayor claridad: amor, trabajo, economía, decisiones, familia o crecimiento personal.", points: ["45 minutos", "3 preguntas específicas", "3 cartas de consejo"] },
  { id: "vincular", name: "Lectura Vincular (AMOR)", minutes: 50, mxn: 800, usd: 60, title: "❤️ Lectura Vincular (AMOR)", text: "Enfocada en comprender profundamente un vínculo específico.", points: ["50 minutos", "Tu energía", "La energía de la otra persona", "Dinámica del vínculo", "Bloqueos emocionales", "Posibles movimientos", "Lo que necesitas comprender para tu proceso"] },
  { id: "compleja", name: "Lectura Vincular Compleja", minutes: 60, mxn: 900, usd: 70, title: "❤️‍🩹 Lectura Vincular Compleja", text: "Pensada para situaciones donde deseas analizar dos o más personas importantes dentro de una misma consulta.", points: ["60 minutos", "3 preguntas específicas", "3 cartas de consejo"], featured: true },
];

const readings = document.querySelector("#readings");
const sheet = document.querySelector("#sheet");
let visitorZone = "America/Mexico_City";
try { visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || visitorZone; } catch {}

function cityName(zone) {
  return String(zone || "").split("/").pop().replaceAll("_", " ") || "Ciudad de México";
}
function clockIn(iso, zone) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(when);
}
function dayIn(iso, zone) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { timeZone: zone, weekday: "long", day: "numeric", month: "long" }).format(when);
}
function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}
function overlaps(start, end, busy) {
  return (busy || []).some((item) => start < item.end && item.start < end);
}
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\x27/g, "&#39;");
}

readings.innerHTML = READINGS.map((item) => `
  <article class="reading-card${item.featured ? " featured" : ""}">
    <div class="reading-head">
      <h3>${item.title}</h3>
      <span class="price-tag">$${item.mxn} MXN</span>
    </div>
    <p class="reading-copy">${item.text}</p>
    <ul class="reading-meta">${item.points.map((point) => `<li>${point}</li>`).join("")}</ul>
    <button class="primary-cta" type="button" data-reading="${item.id}">Reservar ${esc(item.name)}</button>
  </article>
`).join("");

function closeSheet() {
  sheet.hidden = true;
  sheet.innerHTML = "";
  const draft = readDraft();
  if (draft) saveDraft({ ...draft, open: false });
}

function openSheet(html, large) {
  sheet.hidden = false;
  sheet.innerHTML = `<button class="book-backdrop" type="button" aria-label="Cerrar"></button><section class="book-sheet${large ? " is-pay" : ""}" role="dialog">${html}</section>`;
  sheet.querySelector(".book-backdrop").onclick = closeSheet;
  sheet.querySelector(".close").onclick = closeSheet;
}

async function loadOffer() {
  const response = await fetch(API);
  if (!response.ok) throw new Error("No se pudieron cargar los horarios");
  const body = await response.json();
  if (!Array.isArray(body.openings)) throw new Error(body.error || "No se pudieron cargar los horarios");
  return body;
}

readings.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reading]");
  if (button) void choose(button.dataset.reading);
});

async function choose(id) {
  const reading = READINGS.find((item) => item.id === id);
  openSheet(`<header><h2>${esc(reading.name)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="note">Cargando horarios…</p>`);
  try {
    const offer = await loadOffer();
    const zone = offer.timeZone || "America/Mexico_City";
    const times = offer.open ? offer.openings.filter((item) => !overlaps(item.at, addMinutes(item.at, reading.minutes), offer.busy)) : [];
    if (!offer.open || times.length === 0) return showWait(reading);
    showTimes(reading, times, zone);
  } catch (error) {
    openSheet(`<header><h2>${esc(reading.name)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="error">${esc(error.message)}</p>`);
  }
}

function showTimes(reading, times, zone) {
  const groups = [];
  for (const item of times) {
    const day = dayIn(item.at, zone);
    const group = groups.find((entry) => entry.day === day);
    if (group) group.items.push(item);
    else groups.push({ day, items: [item] });
  }
  openSheet(`
    <header><h2>${esc(reading.name)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <div class="sheet-body">
    <p class="note">Elige un horario. La hora de arriba es la de ${esc(cityName(zone))}. El lugar se aparta 1 hora mientras pagas.</p>
    ${groups.map((group) => `<p class="day">${esc(group.day)}</p>${group.items.map((item) => `
      <button class="slot" type="button" data-slot="${esc(item.id)}" data-at="${esc(item.at)}">
        <span>${esc(clockIn(item.at, zone))}<small style="display:block;font-weight:500;font-size:.75rem">hora de ${esc(cityName(zone))}${visitorZone !== zone ? ` · ${esc(clockIn(item.at, visitorZone))} en tu hora` : ""}</small></span>
        <span>Elegir</span>
      </button>`).join("")}`).join("")}
    </div>
  `);
  sheet.querySelectorAll("[data-slot]").forEach((button) => {
    button.onclick = () => showPay(reading, { id: button.dataset.slot, at: button.dataset.at }, zone);
  });
}

const DRAFT_KEY = "ceci-pay-draft";

function saveDraft(draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() })); } catch {}
}

function readDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!draft || Date.now() - Number(draft.savedAt || 0) > 2 * 60 * 60 * 1000) return null;
    return draft;
  } catch {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

function openNewWindow(url) {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) return true;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return false;
}

function openDedicated(url) {
  if (/Android/i.test(navigator.userAgent || "")) {
    const intent = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    if (openNewWindow(intent)) return;
  }
  openNewWindow(url);
}

function personFrom(form) {
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim();
  if (name.length < 2 || phone.replace(/[^\d]/g, "").length < 8) return { error: "Revisa tu nombre y tu WhatsApp." };
  if (email && !email.includes("@")) return { error: "Revisa el correo o déjalo en blanco." };
  return { name, phone, email };
}

async function holdSlot(reading, opening, person) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "hold",
      openingId: opening.id,
      readingId: reading.id,
      name: person.name,
      whatsapp: person.phone,
      email: person.email,
      timeZone: visitorZone,
    }),
    signal: AbortSignal.timeout(15000),
  });
  return response.json();
}

function showPay(reading, opening, zone) {
  const when = `${dayIn(opening.at, zone)} a las ${clockIn(opening.at, zone)}`;
  openSheet(`
    <header><h2>${esc(reading.name)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <form id="pay">
      <div class="sheet-body">
        <p class="note">${esc(dayIn(opening.at, zone))} · ${esc(clockIn(opening.at, zone))} hora de ${esc(cityName(zone))}${visitorZone !== zone ? ` · ${esc(clockIn(opening.at, visitorZone))} en tu hora` : ""} · ${reading.minutes} min</p>
        <label>Nombre completo<input name="name" required autocomplete="name" /></label>
        <label>WhatsApp<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="55 1234 5678" /></label>
        <label>Correo (opcional)<input name="email" type="email" autocomplete="email" placeholder="tu@correo.com" /></label>
        <p class="amount">$${reading.mxn} MXN</p>
        <p class="note">o $${reading.usd} USD por PayPal. El horario queda apartado 1 hora. La cita no se confirma hasta que Ceci reciba el comprobante.</p>
        <div class="pay-choices">
          <button class="pay-choice" type="button" data-pay="bank">
            <span>Transferencia bancaria</span>
            <strong>$${reading.mxn} MXN</strong>
          </button>
          <div class="pay-panel" data-panel="bank" hidden>
            <p class="note">Tarjeta 4152314310559599<br />Beneficiaria: Cecilia Gallardo<br />En el concepto escribe solo tu nombre completo. No agregues palabras como “tarot” o “sesión”.</p>
            <label>Captura del pago<input name="proof-bank" type="file" accept="image/*" /></label>
            <button class="primary-cta" type="submit" data-send="bank">Enviar solicitud de reserva</button>
          </div>
          <button class="pay-choice" type="button" data-pay="paypal">
            <span>PayPal</span>
            <strong>$${reading.usd} USD</strong>
          </button>
          <div class="pay-panel" data-panel="paypal" hidden>
            <p class="note">ceciliatovarcuenta@gmail.com</p>
            <a class="paypal" href="https://www.paypal.com/paypalme/ceciliatovarcuenta" target="_blank" rel="noopener noreferrer">Abrir PayPal</a>
            <p class="note">Se abre en otra ventana. Lo que escribiste se queda en esta página.</p>
            <label>Captura del pago<input name="proof-paypal" type="file" accept="image/*" /></label>
            <button class="primary-cta" type="submit" data-send="paypal">Enviar solicitud de reserva</button>
          </div>
        </div>
        <button class="whatsapp-fallback" id="whatsapp" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 2.2A9.8 9.8 0 0 0 3.5 17.3L2.2 21.8l4.6-1.2A9.8 9.8 0 1 0 12 2.2Z"/><path fill="#fff" d="M16.7 14.4c-.2.6-1.2 1.1-1.7 1.2-.4.1-.9.2-2.6-.5-2.2-.9-3.6-3.1-3.7-3.2-.1-.2-.9-1.2-.9-2.3s.6-1.6.8-1.8c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4.2.5.6 1.6.7 1.7.1.1.1.3 0 .5-.1.2-.2.3-.3.5l-.2.2c-.1.1-.2.2-.1.4.2.3.7 1.2 1.5 1.9.9.8 1.7 1 2 .1.1-.1.3-.2.5-.4.1-.1.3-.1.5 0 .2.1 1.3.6 1.5.7.2.1.3.2.4.3.1.2 0 .6-.2.9Z"/></svg>
          <span>¿No puedes subir tu comprobante? Envíalo a Ceci por WhatsApp</span>
        </button>
        <p class="error" hidden></p>
      </div>
    </form>
  `, true);
  const form = sheet.querySelector("#pay");
  const error = form.querySelector(".error");
  const earlier = readDraft();
  if (earlier && earlier.openingId === opening.id) {
    form.name.value = earlier.name || "";
    form.phone.value = earlier.phone || "";
    form.email.value = earlier.email || "";
  }
  const remember = () => saveDraft({
    open: true,
    readingId: reading.id,
    openingId: opening.id,
    at: opening.at,
    zone,
    name: form.name.value,
    phone: form.phone.value,
    email: form.email.value,
  });
  remember();
  form.addEventListener("input", remember);
  form.querySelector(".paypal").onclick = (event) => {
    event.preventDefault();
    remember();
    openDedicated("https://www.paypal.com/paypalme/ceciliatovarcuenta");
  };
  form.querySelectorAll(".pay-choice").forEach((choice) => {
    choice.onclick = () => {
      const panel = form.querySelector(`[data-panel="${choice.dataset.pay}"]`);
      const willOpen = panel.hidden;
      form.querySelectorAll(".pay-panel").forEach((item) => { item.hidden = true; });
      form.querySelectorAll(".pay-choice").forEach((item) => item.classList.remove("is-open"));
      panel.hidden = !willOpen;
      choice.classList.toggle("is-open", willOpen);
    };
  });
  const sendProof = async (which, button) => {
    const person = personFrom(form);
    const file = form.querySelector(`[name="proof-${which}"]`).files[0];
    error.hidden = true;
    if (person.error) {
      error.hidden = false;
      error.textContent = person.error;
      return;
    }
    if (!file) {
      error.hidden = false;
      error.textContent = "Por favor sube el comprobante de pago.";
      return;
    }
    button.disabled = true;
    button.textContent = "Enviando…";
    try {
      const hold = await holdSlot(reading, opening, person);
      if (!hold.ok) {
        error.hidden = false;
        error.textContent = hold.error === "taken" ? "Ese horario acaba de ocuparse. Elige otro." : "No se pudo apartar el horario. Inténtalo de nuevo.";
        if (hold.error === "taken") void choose(reading.id);
        return;
      }
      const data = new FormData();
      data.set("id", hold.id);
      data.set("proof", file);
      const response = await fetch(API, { method: "POST", body: data });
      if (!response.ok) throw new Error("proof");
      clearDraft();
      openSheet(`<header><h2>Gracias</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="thanks">Gracias por enviar tu solicitud de lectura con ❤️‍🔥</p>`, true);
    } catch {
      error.hidden = false;
      error.textContent = "No se pudo enviar la captura. Inténtalo de nuevo.";
    } finally {
      button.disabled = false;
      button.textContent = "Enviar solicitud de reserva";
    }
  };
  form.querySelectorAll("[data-send]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      void sendProof(button.dataset.send, button);
    };
  });
  sheet.querySelector("#whatsapp").onclick = async () => {
    const person = personFrom(form);
    const button = sheet.querySelector("#whatsapp");
    error.hidden = true;
    if (person.error) {
      error.hidden = false;
      error.textContent = person.error;
      return;
    }
    button.disabled = true;
    try {
      const hold = await holdSlot(reading, opening, person);
      if (!hold.ok) {
        error.hidden = false;
        error.textContent = hold.error === "taken" ? "Ese horario acaba de ocuparse. Elige otro." : "No se pudo registrar la reserva. Inténtalo de nuevo.";
        if (hold.error === "taken") void choose(reading.id);
        button.disabled = false;
        return;
      }
      const marked = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "whatsapp", id: hold.id }),
      });
      if (!marked.ok) throw new Error("whatsapp");
      clearDraft();
      const text = encodeURIComponent(`Hola Ceci! Te mando el comprobante de pago de mi solicitud de reserva del ${when}.`);
      openNewWindow(`https://wa.me/${CECI}?text=${text}`);
      openSheet(`<header><h2>Reserva registrada</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="note">Tu reserva quedó registrada. Envía el comprobante en el chat de WhatsApp que se abrió.</p>`, true);
    } catch {
      error.hidden = false;
      error.textContent = "No se pudo registrar la reserva. Inténtalo de nuevo.";
      button.disabled = false;
    }
  };
}

function showWait(reading) {
  openSheet(`
    <header><h2>Lista de espera</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <form id="wait">
      <div class="sheet-body">
        <p class="note">Ahora no hay horarios abiertos para esta lectura. Déjame tu WhatsApp y Ceci te escribe cuando se abra un lugar.</p>
        <label>Nombre completo<input name="name" required autocomplete="name" /></label>
        <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="55 1234 5678" /></label>
        <p class="error" hidden></p>
      </div>
      <div class="sheet-actions">
        <button class="primary-cta" type="submit">Enviar solicitud</button>
      </div>
    </form>
  `);
  sheet.querySelector("#wait").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "waitlist", readingId: reading.id, name: form.name.value, whatsapp: form.phone.value }),
    });
    const body = await response.json();
    if (!body.ok) {
      const error = form.querySelector(".error");
      error.hidden = false;
      error.textContent = "Revisa tu nombre y tu WhatsApp.";
      return;
    }
    openSheet(`<header><h2>Lista de espera</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="note">Listo. Ceci te escribe por WhatsApp cuando se abra un lugar.</p>`);
  };
}

function restoreDraft() {
  const draft = readDraft();
  if (!draft?.open) return;
  const reading = READINGS.find((item) => item.id === draft.readingId);
  if (!reading || !draft.openingId || !draft.at) return;
  showPay(reading, { id: draft.openingId, at: draft.at }, draft.zone || "America/Mexico_City");
}

function inAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|ByteLocale|WhatsApp|Line\/|Snapchat/i.test(ua);
}

function bookingIntentUrl() {
  const current = location.href.split("#")[0];
  return `intent://${current.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(current)};end`;
}

function showBrowserGate() {
  if (!inAppBrowser()) return;
  const page = document.querySelector(".book-page");
  if (!page || page.querySelector(".browser-gate")) return;
  const android = /Android/i.test(navigator.userAgent || "");
  const gate = document.createElement("section");
  gate.className = "browser-gate";
  gate.innerHTML = android
    ? `<p class="label">Ábrela en Chrome</p><p>Si entras desde TikTok, Instagram o WhatsApp, esta página puede cerrarse cuando vayas a pagar. Ábrela en Chrome para no perder la reserva.</p><button class="primary-cta" type="button">Abrir en Chrome</button>`
    : `<p class="label">Ábrela en Safari</p><p>Si entras desde TikTok, Instagram o WhatsApp, esta página puede cerrarse cuando vayas a pagar. Toca el menú del navegador y elige <strong>Abrir en Safari</strong>.</p><button class="primary-cta" type="button">Copiar enlace</button>`;
  page.prepend(gate);
  gate.querySelector("button").onclick = async () => {
    if (android) {
      location.href = bookingIntentUrl();
      return;
    }
    const button = gate.querySelector("button");
    try {
      await navigator.clipboard.writeText(location.href.split("#")[0]);
      button.textContent = "Enlace copiado";
    } catch {
      button.textContent = "No se pudo copiar";
    }
  };
  if (android && !sessionStorage.getItem("ceci-browser-hop")) {
    sessionStorage.setItem("ceci-browser-hop", "1");
    location.href = bookingIntentUrl();
  }
}

showBrowserGate();
restoreDraft();

