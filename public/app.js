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
}

function openSheet(html) {
  sheet.hidden = false;
  sheet.innerHTML = `<button class="book-backdrop" type="button" aria-label="Cerrar"></button><section class="book-sheet" role="dialog">${html}</section>`;
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
    <p class="note">Elige un horario. La hora de arriba es la de ${esc(cityName(zone))}. El lugar se aparta 1 hora mientras pagas.</p>
    ${groups.map((group) => `<p class="day">${esc(group.day)}</p>${group.items.map((item) => `
      <button class="slot" type="button" data-slot="${esc(item.id)}" data-at="${esc(item.at)}">
        <span>${esc(clockIn(item.at, zone))}<small style="display:block;font-weight:500;font-size:.75rem">hora de ${esc(cityName(zone))}${visitorZone !== zone ? ` · ${esc(clockIn(item.at, visitorZone))} en tu hora` : ""}</small></span>
        <span>Elegir</span>
      </button>`).join("")}`).join("")}
  `);
  sheet.querySelectorAll("[data-slot]").forEach((button) => {
    button.onclick = () => showDetails(reading, { id: button.dataset.slot, at: button.dataset.at }, zone);
  });
}

function showDetails(reading, opening, zone) {
  openSheet(`
    <header><h2>${esc(reading.name)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <form id="details">
      <p class="note">${esc(dayIn(opening.at, zone))} · ${esc(clockIn(opening.at, zone))} hora de ${esc(cityName(zone))}${visitorZone !== zone ? ` · ${esc(clockIn(opening.at, visitorZone))} en tu hora` : ""} · $${reading.mxn} MXN</p>
      <label>Nombre completo<input name="name" required autocomplete="name" /></label>
      <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="55 1234 5678" /></label>
      <p class="error" hidden></p>
      <button class="primary-cta" type="submit" style="margin-top:16px">Apartar este horario</button>
    </form>
  `);
  sheet.querySelector("#details").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const error = form.querySelector(".error");
    button.disabled = true;
    button.textContent = "Apartando…";
    error.hidden = true;
    const response = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "hold", openingId: opening.id, readingId: reading.id, name: form.name.value, whatsapp: form.phone.value, timeZone: visitorZone }),
    });
    const body = await response.json();
    button.disabled = false;
    button.textContent = "Apartar este horario";
    if (!body.ok) {
      error.hidden = false;
      error.textContent = body.error === "taken" ? "Ese horario acaba de ocuparse. Elige otro." : "Revisa tu nombre y tu WhatsApp.";
      if (body.error === "taken") void choose(reading.id);
      return;
    }
    showPay(body);
  };
}

function showWait(reading) {
  openSheet(`
    <header><h2>Lista de espera</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <form id="wait">
      <p class="note">Ahora no hay horarios abiertos para esta lectura. Déjame tu WhatsApp y Ceci te escribe cuando se abra un lugar.</p>
      <label>Nombre completo<input name="name" required autocomplete="name" /></label>
      <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="55 1234 5678" /></label>
      <p class="error" hidden></p>
      <button class="primary-cta" type="submit" style="margin-top:16px">Avisarme cuando haya lugar</button>
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

function showPay(hold) {
  const zone = hold.timeZone || "America/Mexico_City";
  openSheet(`
    <header><h2>Pago</h2><button class="close" type="button" aria-label="Cerrar">×</button></header>
    <form id="pay">
      <p class="note">Hola, bonita. Tu horario quedó apartado. Para confirmarlo, paga dentro de 1 hora.</p>
      <p class="amount">$${hold.mxn} MXN</p>
      <p class="note">$${hold.usd} USD por PayPal · ${esc(hold.reading)} · ${hold.minutes} min · ${esc(dayIn(hold.at, zone))} ${esc(clockIn(hold.at, zone))} hora de ${esc(cityName(zone))}${visitorZone !== zone ? ` · ${esc(clockIn(hold.at, visitorZone))} en tu hora` : ""}</p>
      <div class="warn"><strong>Cuidado con las estafas.</strong> Solo paga con los datos de esta página, los mismos del TikTok y WhatsApp de Ceci. Número oficial: 55 7302 2862.</div>
      <h3>Transferencia</h3>
      <p class="note">Tarjeta 4152314310559599 · Cecilia Gallardo. En el concepto escribe solo tu nombre completo.</p>
      <h3>PayPal</h3>
      <p class="note">ceciliatovarcuenta@gmail.com</p>
      <a class="paypal" href="https://www.paypal.com/paypalme/ceciliatovarcuenta" target="_blank" rel="noreferrer">Abrir PayPal</a>
      <label>Captura del pago<input name="proof" type="file" accept="image/*" required /></label>
      <p class="error" hidden></p>
      <button class="primary-cta" type="submit" style="margin-top:16px">Enviar comprobante</button>
      <button class="primary-cta" id="whatsapp" type="button" style="margin-top:8px;background:#1f7a4d">Enviar por WhatsApp</button>
    </form>
  `);
  sheet.querySelector("#pay").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.proof.files[0];
    const error = form.querySelector(".error");
    if (!file) {
      error.hidden = false;
      error.textContent = "Sube la captura de tu pago.";
      return;
    }
    const data = new FormData();
    data.set("id", hold.id);
    data.set("proof", file);
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    button.textContent = "Enviando…";
    const response = await fetch(API, { method: "POST", body: data });
    if (!response.ok) {
      button.disabled = false;
      button.textContent = "Enviar comprobante";
      error.hidden = false;
      error.textContent = "No se pudo enviar la captura. Inténtalo de nuevo o mándala por WhatsApp.";
      return;
    }
    openSheet(`<header><h2>Pago</h2><button class="close" type="button" aria-label="Cerrar">×</button></header><p class="note">Recibí tu comprobante. Ceci lo revisa y te confirma por WhatsApp.</p>`);
  };
  sheet.querySelector("#whatsapp").onclick = async () => {
    await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "whatsapp", id: hold.id }) });
    const text = encodeURIComponent(`Hola Ceci, te envío el comprobante de pago de mi ${hold.reading} del ${dayIn(hold.at, zone)} a las ${clockIn(hold.at, zone)}.`);
    window.location.href = `https://wa.me/${CECI}?text=${text}`;
  };
}
