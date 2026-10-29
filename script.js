/* =================================================================
   1. CONFIGURATION GLOBALE, NAVIGATION & UTILITAIRES
   ================================================================ */
const CONFIG = {
    CACHE_VERSION: 'v3', /* Faire évoluer la version à chaque changement significatif */
    CACHE_DURATION: 15 * 60 * 1000,
    MEMBRES_SHEET_ID: '1wAC4LrcpOTTlObYt3kSricIqNRCVGWC3fgJQ0LiDe7M',
    EVENTS_SHEET_ID: '1-vEelbB9DDbJRFmJ0HYW-wCAwZau6DWirqaq6U-Zuww',
    PLANNING_SHEET_ID: '1-TRwpHJa93G5JyKkWjWAaIrj4-ip9QNwGx5RCG-HSuA',
    DRIVE_API_KEY: 'AIzaSyDAuWBtbVPUXwI8e27RRYREgGu64u3HK74',
    DRIVE_PHOTOS_FOLDER_ID: '1k9hHi9_s5hufPL1jxH9bxvmBbIZUsikb',
    DRIVE_POSTERS_FOLDER_ID: '1iIfPZiGPyJokoDaqkc-oHsMz60c3cp9i',
    DRIVE_GAZETTE_FOLDER_ID: '1xJNiT1oez2Ov3Ec3WHvTEnCQOG1F4oE-'
};

const safeStorage = {
    getItem: function(key) {
        try { return localStorage.getItem(key); } 
        catch (e) { return null; }
    },
    setItem: function(key, value) {
        try { localStorage.setItem(key, value); } 
        catch (e) {}
    },
    removeItem: function(key) {
        try { localStorage.removeItem(key); } 
        catch (e) {}
    }
};

const cacheManager = {
    get: function(key) {
        const savedVersion = safeStorage.getItem(`${key}_version`);
        const cacheData = safeStorage.getItem(key);
        const cacheTimestamp = safeStorage.getItem(`${key}_timestamp`);

        if (savedVersion === CONFIG.CACHE_VERSION && cacheData && cacheTimestamp) {
            if (Date.now() - parseInt(cacheTimestamp, 10) < CONFIG.CACHE_DURATION) {
                try { return JSON.parse(cacheData); } 
                catch (e) { return null; }
            }
        }
        return null;
    },
    set: function(key, data) {
        safeStorage.setItem(key, JSON.stringify(data));
        safeStorage.setItem(`${key}_timestamp`, Date.now().toString());
        safeStorage.setItem(`${key}_version`, CONFIG.CACHE_VERSION);
    },
    clear: function(key) {
        safeStorage.removeItem(key);
        safeStorage.removeItem(`${key}_timestamp`);
        safeStorage.removeItem(`${key}_version`);
    }
};

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function afficherEtatFichier(elementId, message, estErreur = false, colspan = 1) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const couleur = estErreur ? '#e74c3c' : 'var(--text)';
    const style = `text-align: center; color: ${couleur}; font-style: italic; padding: 2rem;`;

    if (el.tagName === 'TBODY') {
        el.innerHTML = `<tr><td colspan="${colspan}" style="${style}">${escapeHTML(message)}</td></tr>`;
    } else {
        el.style.gridColumn = '1 / -1';
        el.style.cssText += style;
        el.textContent = message;
    }
}

async function fetchWithErrorHandling(url, errorMessage = "Erreur de chargement.") {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(errorMessage);
        return await response.json();
    } catch (error) {
        console.warn(errorMessage, error);
        return null;
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');

    const targetBtn = document.getElementById('btn-' + sectionId);
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.setAttribute('aria-expanded', 'true');
    }
	
	const formStatus = document.getElementById('formStatus');
    if (formStatus) {
        formStatus.style.display = 'none';
        formStatus.textContent = '';
	}
}

let currentLightboxImages = [];
let currentLightboxIndex = 0;

function zoomImage(src, imageList = null, index = 0) {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    if (!lb || !lbImg) return;

    if (imageList) {
        currentLightboxImages = imageList;
        currentLightboxIndex = index;
    } else {
        currentLightboxImages = [src];
        currentLightboxIndex = 0;
    }

    lbImg.src = '';
    lb.classList.add('active');
    lbImg.src = currentLightboxImages[currentLightboxIndex];
    
    updateLightboxNavVisibility();
}

function changeLightboxImage(direction) {
    if (currentLightboxImages.length <= 1) return;

    currentLightboxIndex += direction;

    if (currentLightboxIndex < 0) {
        currentLightboxIndex = currentLightboxImages.length - 1;
    } else if (currentLightboxIndex >= currentLightboxImages.length) {
        currentLightboxIndex = 0;
    }

    const lbImg = document.getElementById('lightboxImg');
    if (lbImg) {
        lbImg.src = '';
        setTimeout(() => {
            lbImg.src = currentLightboxImages[currentLightboxIndex];
        }, 50);
    }
}

function updateLightboxNavVisibility() {
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    const showNav = currentLightboxImages.length > 1;

    if (prevBtn) prevBtn.style.display = showNav ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = showNav ? 'flex' : 'none';
}

function closeZoom() {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    if (lb) {
        lb.classList.remove('active');
        if (lbImg) {
            setTimeout(() => {
                lbImg.src = '';
            }, 300);
        }
    }
}

document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('active')) {
        if (e.key === 'ArrowLeft') changeLightboxImage(-1);
        if (e.key === 'ArrowRight') changeLightboxImage(1);
        if (e.key === 'Escape') closeZoom();
    }
});


/* =================================================================
   2. ONGLET "LE CLUB" (TACTIQUE, PLANNING & STATUT DES SÉANCES)
   ================================================================ */

async function chargerTactiqueDuJour() {
    const dateEl = document.getElementById('puzzleDateNum');
    const imgEl = document.getElementById('puzzleImg');
    const btnEl = document.getElementById('puzzleBtn');
    const descEl = document.getElementById('puzzleDesc');
    const solutionContainer = document.getElementById('puzzleSolutionContainer');
    const solutionTextEl = document.getElementById('puzzleSolutionText');
    
    const now = new Date();
    if (dateEl) dateEl.textContent = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    try {
        const response = await fetch('https://api.chess.com/pub/puzzle');
        if (!response.ok) throw new Error("Erreur réseau API");
        
        const data = await response.json();
        if (imgEl) imgEl.src = data.image;
        if (descEl) descEl.style.display = 'none';
        if (solutionContainer) solutionContainer.classList.add('hidden');

        if (btnEl) {
            btnEl.href = data.url;
            btnEl.target = "_blank";
            btnEl.rel = "noopener noreferrer";
            btnEl.textContent = "Tester la solution";
            btnEl.onclick = null; 
        }
    } catch (error) {
        if (imgEl) imgEl.src = "https://fen2image.chessvision.ai/7Q/1pq2kp1/p2ppb2/8/4B1P1/3P4/PP3P2/K7";
        if (descEl) { descEl.textContent = "Trait aux Blancs."; descEl.style.display = 'block'; }
        if (solutionTextEl) solutionTextEl.innerHTML = "<strong>Solution :</strong> 1. Fg6!!<br>Si 1… RxFg6 2. Dh5#<br>Si 1… Re7 2. De8#";
        if (solutionContainer) solutionContainer.classList.add('hidden');
        if (btnEl) {
            btnEl.removeAttribute('target');
            btnEl.removeAttribute('rel');
            btnEl.href = "#";
            btnEl.textContent = "Afficher la solution";
            btnEl.onclick = function(e) { e.preventDefault(); togglePuzzleSolution(); };
        }
    }
}

function togglePuzzleSolution() {
    const container = document.getElementById('puzzleSolutionContainer');
    const btn = document.getElementById('puzzleBtn');
    if (!container || !btn) return;

    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
        container.classList.remove('hidden');
        btn.textContent = "Masquer la solution";
    } else {
        container.classList.add('hidden');
        btn.textContent = "Afficher la solution";
    }
}

function convertirNomJourEnChiffre(nomJour) {
    const jours = {
        'dimanche': 0, 'lundi': 1, 'mardi': 2, 
        'mercredi': 3, 'jeudi': 4, 'vendredi': 5, 'samedi': 6
    };
    const normalise = nomJour.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return jours[normalise] !== undefined ? jours[normalise] : 1;
}

function getTimeValue(cell) {
    if (!cell) return '';
    if (cell.f) return cell.f.trim(); 
    if (cell.v === null || cell.v === undefined) return '';
    
    const val = String(cell.v);
    if (val.startsWith('Date(')) {
        const match = val.match(/\d+/g);
        if (match && match.length >= 6) {
            const h = String(match[3]).padStart(2, '0');
            const m = String(match[4]).padStart(2, '0');
            return `${h}:${m}`;
        }
    }
    return val.trim();
}

function formaterHeure(heureStr) {
    if (!heureStr) return '';
    return heureStr.replace(':', 'h');
}

window.googlePlanningCallback = function(data) {
    const scriptEl = document.getElementById('jsonp-planning-script');
    if (scriptEl) scriptEl.remove();

    const tbody = document.getElementById('planningTableBody');
    if (!tbody || !data || !data.table) return;

    const rows = data.table.rows;
    const planningData = [];

    rows.forEach(row => {
        const cellules = row.c;
        if (!cellules || cellules.length < 5) return;

        const getVal = (index) => {
            if (!cellules[index] || cellules[index].v === null) return '';
            return String(cellules[index].v).trim();
        };

        const jourNom = getVal(0);
        const heureDebut = getTimeValue(cellules[1]); 
        const heureFin = getTimeValue(cellules[2]);   
        const commune = getVal(3);
        const lieu = getVal(4);

        if (jourNom && heureDebut) {
            planningData.push({ jourNom, heureDebut, heureFin, commune, lieu });
        }
    });

    if (planningData.length > 0) {
        cacheManager.set('cache_planning', planningData);
        afficherPlanningUI(planningData);
    }
};

function afficherPlanningUI(planningData) {
    const tbody = document.getElementById('planningTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    planningData.forEach(item => {
        const numJour = convertirNomJourEnChiffre(item.jourNom);
        const debutFormate = formaterHeure(item.heureDebut);
        const finFormate = formaterHeure(item.heureFin);
        const affichageHoraire = `${debutFormate} - ${finFormate}`;

        const tr = document.createElement('tr');
        tr.setAttribute('data-jour', numJour);
        tr.setAttribute('data-debut', item.heureDebut);
        tr.setAttribute('data-fin', item.heureFin);

        tr.innerHTML = `
            <td style="font-weight: bold;">${escapeHTML(item.jourNom)}</td>
            <td>${escapeHTML(affichageHoraire)}</td>
            <td>${escapeHTML(item.commune)}</td>
            <td>${escapeHTML(item.lieu)}</td>
        `;
        tbody.appendChild(tr);
    });

    verifierStatutSeanceClub();
}

function loadPlanningData() {
    const cachedPlanning = cacheManager.get('cache_planning');

    if (cachedPlanning) {
        afficherPlanningUI(cachedPlanning);
    }

    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.PLANNING_SHEET_ID}/gviz/tq?tqx=responseHandler:googlePlanningCallback`;
    const script = document.createElement('script');
    script.id = 'jsonp-planning-script';
    script.src = url;
    script.onerror = function() {
        script.remove();
        if (!cachedPlanning) {
            afficherEtatFichier('planningTableBody', 'Impossible de charger le planning.', true, 4);
        }
    };
    document.head.appendChild(script);
}

function convertirHeureEnMinutes(heureStr) {
    const [h, m] = heureStr.split(':').map(Number);
    return h * 60 + m;
}

function verifierStatutSeanceClub() {
    const rows = document.querySelectorAll('.planning-table tbody tr');
    if (rows.length === 0) return;

    rows.forEach(row => {
        row.classList.remove('seance-active-row');
        const existingBadge = row.querySelector('.table-badge');
        if (existingBadge) existingBadge.remove();
    });

    const maintenant = new Date();
    const jourActuel = maintenant.getDay(); 
    const heureActuelleMinutes = maintenant.getHours() * 60 + maintenant.getMinutes();

    let indexCible = -1;
    let typeStatut = '';

    rows.forEach((row, index) => {
        const j = parseInt(row.getAttribute('data-jour'), 10);
        const debutMin = convertirHeureEnMinutes(row.getAttribute('data-debut'));
        const finMin = convertirHeureEnMinutes(row.getAttribute('data-fin'));

        if (j === jourActuel && heureActuelleMinutes >= debutMin && heureActuelleMinutes <= finMin) {
            indexCible = index;
            typeStatut = 'live';
        }
    });

    if (indexCible === -1) {
        let minEcartMinutes = Infinity;
        rows.forEach((row, index) => {
            const j = parseInt(row.getAttribute('data-jour'), 10);
            const debutMin = convertirHeureEnMinutes(row.getAttribute('data-debut'));

            let ecartJours = j - jourActuel;
            if (ecartJours < 0 || (ecartJours === 0 && debutMin <= heureActuelleMinutes)) ecartJours += 7; 

            const ecartTotalMinutes = ecartJours * 24 * 60 + (debutMin - heureActuelleMinutes);
            if (ecartTotalMinutes < minEcartMinutes) {
                minEcartMinutes = ecartTotalMinutes;
                indexCible = index;
                typeStatut = 'pending';
            }
        });
    }

    if (indexCible !== -1) {
        const targetRow = rows[indexCible];
        targetRow.classList.add('seance-active-row');

        const badge = document.createElement('span');
        if (typeStatut === 'live') {
            badge.className = "table-badge live";
            badge.textContent = "🔴 En direct";
        } else {
            badge.className = "table-badge pending";
            badge.textContent = "Prochaine séance";
        }

        const lastCell = targetRow.querySelector('td:last-child');
        if (lastCell) lastCell.appendChild(badge);
    }
}


/* =================================================================
   3. ONGLET "ÉVÉNEMENTS & CALENDRIER"
   ================================================================ */
let allClubEvents = []; 
let currentCalendarDate = new Date(); 
let drivePostersMap = {};

async function loadDrivePostersMapping() {
    if (!CONFIG.DRIVE_API_KEY || CONFIG.DRIVE_API_KEY === 'VOTRE_CLE_API_GOOGLE') return;
    try {
        const query = `'${CONFIG.DRIVE_POSTERS_FOLDER_ID}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=files(id,name)`;
        const response = await fetch(url);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.files) {
            data.files.forEach(file => {
                drivePostersMap[file.name.trim()] = file.id;
            });
        }
    } catch (error) {
        console.warn("Impossible de charger le mapping des affiches Google Drive", error);
    }
}

async function loadDynamicEvents() {
    await loadDrivePostersMapping();

    const cachedEvents = cacheManager.get('cache_evenements');

    if (cachedEvents) {
        allClubEvents = cachedEvents;
        allClubEvents.forEach(e => {
            e.dateTime = new Date(e.dateTime);
            if (e.endDateTime) e.endDateTime = new Date(e.endDateTime);
        });
        renderDynamicEventsGrid();
    }

    const eventsUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.EVENTS_SHEET_ID}/gviz/tq?tqx=responseHandler:handleEventsCallback`;
    const script = document.createElement('script');
    script.id = 'jsonp-events-script';
    script.src = eventsUrl;
    script.onerror = function() { 
        script.remove(); 
        if (!cachedEvents) {
            afficherEtatFichier('eventsGrid', 'Impossible de charger le calendrier des événements pour le moment.', true);
        }
    };
    document.body.appendChild(script);
}

function getCellValue(cells, index) {
    if (!cells || !cells[index]) return '';
    if (cells[index].v !== null && cells[index].v !== undefined) return String(cells[index].v).trim();
    if (cells[index].f !== null && cells[index].f !== undefined) return String(cells[index].f).trim();
    return '';
}

function parseCellTime(cell) {
    if (!cell) return { hour: 0, minute: 0 };
    let hour = 0, minute = 0;
    if (cell.f) {
        const timeParts = cell.f.split(':');
        hour = parseInt(timeParts[0], 10) || 0;   
        minute = parseInt(timeParts[1], 10) || 0; 
    } else if (cell.v && typeof cell.v === 'object') {
        hour = cell.v.hours !== undefined ? cell.v.hours : 0;
        minute = cell.v.minutes !== undefined ? cell.v.minutes : 0;
    } else if (cell.v) {
        const timeParts = String(cell.v).split(':');
        hour = parseInt(timeParts[0], 10) || 0;   
        minute = parseInt(timeParts[1], 10) || 0; 
    }
    return { hour, minute };
}

function handleEventsCallback(response) {
    const scriptEl = document.getElementById('jsonp-events-script');
    if (scriptEl) scriptEl.remove();

    const gridContainer = document.getElementById('eventsGrid');
    if (!gridContainer || !response || !response.table) return;

    const rows = response.table.rows;
    const now = new Date();
    allClubEvents = []; 

    rows.forEach(row => {
        const cells = row.c;
        if (!cells || cells.length < 5) return;
        
        let rawDate = getCellValue(cells, 0); 
        const rawTime = getCellValue(cells, 1); 

        let cell2Val = getCellValue(cells, 2);
        let hasExplicitEndTime = cell2Val.includes(':') || (cells[2] && cells[2].v && String(cells[2].v).includes('Time'));
        
        let endTimeCellIndex = 2;
        let typeIndex = 3;
        let titreIndex = 4;
        let lieuIndex = 5;
        let cadenceIndex = 6;
        let rondesIndex = 7;
        let commentaireIndex = 8;
        let lienAfficheIndex = 9;

        if (!hasExplicitEndTime && cells.length < 10) {
            endTimeCellIndex = -1;
            typeIndex = 2;
            titreIndex = 3;
            lieuIndex = 4;
            cadenceIndex = 5;
            rondesIndex = 6;
            commentaireIndex = 7;
            lienAfficheIndex = 8;
        }

        const type = getCellValue(cells, typeIndex); 
        const titre = getCellValue(cells, titreIndex); 
        const lieu = getCellValue(cells, lieuIndex); 
        const cadence = getCellValue(cells, cadenceIndex); 
        const rondes = getCellValue(cells, rondesIndex); 
        const commentaire = getCellValue(cells, commentaireIndex); 
        const lienAffiche = getCellValue(cells, lienAfficheIndex); 

        if (rawDate.toLowerCase() === 'date' || !rawDate || !rawTime) return;

        let year, month, day;
        if (rawDate.includes('/')) {
            const dateParts = rawDate.split('/');
            day = parseInt(dateParts[0], 10);   
            month = parseInt(dateParts[1], 10); 
            year = parseInt(dateParts[2], 10);  
        } else if (cells[0].v && String(cells[0].v).includes('Date')) {
            const extract = String(cells[0].v).match(/\d+/g);
            if (extract && extract.length >= 3) {
                year = parseInt(extract[0], 10);
                month = parseInt(extract[1], 10) + 1; 
                day = parseInt(extract[2], 10);
                rawDate = `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
            }
        } else {
            return; 
        }

        const startTimeObj = parseCellTime(cells[1]);
        const hour = startTimeObj.hour;
        const minute = startTimeObj.minute;

        const eventDateTime = new Date(year, month - 1, day, hour, minute);
        if (isNaN(eventDateTime.getTime())) return;

        let eventEndDateTime = new Date(eventDateTime.getTime() + 3 * 60 * 60 * 1000);

        if (endTimeCellIndex !== -1 && cells[endTimeCellIndex]) {
            const endTimeObj = parseCellTime(cells[endTimeCellIndex]);
            if (endTimeObj.hour !== 0 || endTimeObj.minute !== 0) {
                eventEndDateTime = new Date(year, month - 1, day, endTimeObj.hour, endTimeObj.minute);
                if (eventEndDateTime < eventDateTime) {
                    eventEndDateTime.setDate(eventEndDateTime.getDate() + 1);
                }
            }
        }

        const isLive = (now >= eventDateTime && now <= eventEndDateTime);
        const isPast = (now > eventEndDateTime);

        const formattedISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        allClubEvents.push({
            dateTime: eventDateTime,
            endDateTime: eventEndDateTime,
            isoDate: formattedISO,
            year: String(year),
            rawDate: rawDate,
            rawTime: (hour < 10 ? '0' : '') + hour + 'h' + (minute < 10 ? '0' : '') + minute,
            type: type.toLowerCase(),
            titre: titre,
            lieu: lieu,
            cadence: cadence,
            rondes: rondes,
            commentaire: commentaire,
            lienAffiche: lienAffiche,
            isLive: isLive,
            isPast: isPast
        });
    });

	allClubEvents.sort((a, b) => a.dateTime - b.dateTime);
    cacheManager.set('cache_evenements', allClubEvents);
    renderDynamicEventsGrid();
}

function renderDynamicEventsGrid() {
    const gridContainer = document.getElementById('eventsGrid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    if (allClubEvents.length === 0) {
        afficherEtatFichier('eventsGrid', 'Aucun événement enregistré.');
        updateYearSelect();
        generateCalendar();
        return;
    }

    allClubEvents.forEach(event => {
        const card = document.createElement('div');
        card.className = 'card event-card';
        card.setAttribute('data-year', event.year);
        card.setAttribute('data-date', event.isoDate);
        card.setAttribute('data-type', event.type);
        card.setAttribute('data-is-past', event.isPast);
        card.setAttribute('data-is-live', event.isLive);

        if (event.isPast) card.style.opacity = "0.65"; 

        let badgeText = "🏆 Tournoi";
        let badgeBg = "#ecc94b";
        let badgeColor = "#2d3748";

        if (event.type === 'cours') {
            badgeText = "📚 Cours";
            badgeBg = "#2980b9";
            badgeColor = "#ffffff";
        }

        let statusBadgeHTML = '';
        if (event.isLive) {
            statusBadgeHTML = `<span class="badge dynamic-badge live" style="background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.80rem; animation: pulseLive 1.5s infinite;">🔴 En cours</span>`;
        } else if (event.isPast) {
            statusBadgeHTML = `<span class="badge dynamic-badge" style="background-color: #7f8c8d; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.80rem;">Terminé</span>`;
        } else {
            statusBadgeHTML = `<span class="badge dynamic-badge" style="background-color: #2ecc71; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.80rem;">À venir</span>`;
        }

        let timeDisplay = `Le ${escapeHTML(event.rawDate)} à ${escapeHTML(event.rawTime)}`;

        let cardHTML = `
            <div class="event-content-wrapper" style="display: flex; gap: 1.5rem; align-items: start;">
                <div class="event-info-side" style="flex: 2;">
                    <h3 style="margin-top: 0; margin-bottom: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                        ${statusBadgeHTML}
                        <span class="badge type-badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${badgeText}</span>
                        <span class="event-title-text" style="margin-left: 0.25rem; font-weight: bold; color: var(--primary);">${escapeHTML(event.titre)}</span>
                    </h3>
                    <p style="margin: 0.3rem 0;">📅 <strong>Date :</strong> ${timeDisplay}</p>
                    <p style="margin: 0.3rem 0;">📍 <strong>Lieu :</strong> ${escapeHTML(event.lieu)}</p>
        `;

        if (event.cadence) cardHTML += `<p style="margin: 0.3rem 0;" class="cadence-field">⏳ <strong>Cadence :</strong> ${escapeHTML(event.cadence)}</p>`;
        if (event.rondes) cardHTML += `<p style="margin: 0.3rem 0;" class="rondes-field">🔄 <strong>Nombre de rondes :</strong> ${escapeHTML(event.rondes)}</p>`;
        cardHTML += `</div>`; 

        if (event.lienAffiche) {
            let cleanSrc = '';
            if (event.lienAffiche.startsWith('http')) {
                cleanSrc = event.lienAffiche;
            } else {
                const fileName = event.lienAffiche.trim();
                const fileId = drivePostersMap[fileName];
                if (fileId) {
                    cleanSrc = `https://lh3.googleusercontent.com/d/${fileId}`;
                }
            }

            if (cleanSrc) {
                cardHTML += `
                    <div class="event-poster-side" style="flex: 1; text-align: right;">
                        <img src="${cleanSrc}" alt="Affiche" loading="lazy" onclick="zoomImage(this.src)" style="max-width: 100px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd;" onerror="this.parentElement.style.display='none'">
                    </div>
                `;
            }
        }
        cardHTML += `</div>`; 

        if (event.commentaire) {
            cardHTML += `<p style="margin: 0.75rem 0 0 0; color: #555; font-style: italic;">💬 ${escapeHTML(event.commentaire)}</p>`;
        }

        card.innerHTML = cardHTML;
        gridContainer.appendChild(card);
    });

    updateYearSelect();
    filterEvents();
    setTimeout(generateCalendar, 50);
    initCountdown();

    setTimeout(() => {
        const currentYearStr = String(new Date().getFullYear());
        const firstVisibleFutureCard = allClubEvents.find(e => e.year === currentYearStr && !e.isPast);
        if (firstVisibleFutureCard) {
            const cardElements = document.querySelectorAll('.event-card');
            for (let card of cardElements) {
                if (card.getAttribute('data-date') === firstVisibleFutureCard.isoDate) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        }
    }, 400);
}

function filterEvents() {
    const select = document.getElementById('yearSelect');
    const hidePastCheckbox = document.getElementById('hidePastCheckbox');
    if (!select || !hidePastCheckbox) return;
    
    const selectedYear = select.value;
    const hidePast = hidePastCheckbox.checked;
    
    document.querySelectorAll('.event-card').forEach(card => {
        const eventYear = card.getAttribute('data-year');
        const isPastEvent = card.getAttribute('data-is-past') === 'true';
        const isLiveEvent = card.getAttribute('data-is-live') === 'true';
        
        const matchYear = (selectedYear === 'all' || eventYear === selectedYear);
        const matchPast = !(hidePast && isPastEvent && !isLiveEvent);
        
        card.style.display = (matchYear && matchPast) ? 'block' : 'none';
    });
}

function updateYearSelect() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    const currentYear = String(new Date().getFullYear());
    const years = [...new Set(allClubEvents.map(e => e.year))].sort();
    
    yearSelect.innerHTML = '<option value="all">Toutes les années</option>';
    years.forEach(y => {
        const isSelected = (y === currentYear) ? 'selected' : '';
        yearSelect.innerHTML += `<option value="${y}" ${isSelected}>${y}</option>`;
    });

    if (typeof filterEvents === 'function') filterEvents(); 
}

function generateCalendar() {
    const monthYearHeader = document.getElementById('calendarMonthYear');
    const daysGrid = document.getElementById('calendarDaysGrid');
    if (!monthYearHeader || !daysGrid) return;

    daysGrid.innerHTML = ''; 

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    monthYearHeader.textContent = `${monthNames[month]} ${year}`;

    let firstDayIndex = new Date(year, month, 1).getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6; 

    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        daysGrid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.style.cssText = "position: relative; padding: 6px 0; font-weight: 600; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s ease;";

        const dayNumber = document.createElement('span');
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        const currentISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = allClubEvents.filter(e => e.isoDate === currentISO);

        if (dayEvents.length > 0) {
            dayCell.style.backgroundColor = "var(--bg-light, #f7fafc)";
            dayCell.style.border = "1px solid var(--accent, #ecc94b)";
            dayCell.style.color = "var(--primary, #2d3748)";
            dayCell.style.cursor = "pointer";

            const dot = document.createElement('div');
            dot.style.cssText = "width: 5px; height: 5px; background-color: var(--accent, #ecc94b); border-radius: 50%; margin-top: 2px;";
            dayCell.appendChild(dot);

            let tooltipHTML = `<div style="text-align:left; font-size:0.8rem; line-height:1.4;">`;
            dayEvents.forEach(e => {
                const badge = e.type === 'cours' ? '📚' : '🏆';
                tooltipHTML += `<div style="margin-bottom:4px; font-weight:bold; color:#ecc94b;">${badge} ${escapeHTML(e.titre)}</div>`;
                tooltipHTML += `<div style="color:#fff; font-size:0.75rem;">🕒 ${escapeHTML(e.rawTime)} - 📍 ${escapeHTML(e.lieu)}</div>`;
            });
            tooltipHTML += `</div>`;

            dayCell.setAttribute('data-tooltip-content', tooltipHTML);
            
            dayCell.onmouseenter = function() {
                showCustomTooltip(this, this.getAttribute('data-tooltip-content'));
                this.style.backgroundColor = "var(--accent, #ecc94b)";
                this.style.color = "white";
                if(this.querySelector('div')) this.querySelector('div').style.backgroundColor = "white";
            };
            
            dayCell.onmouseleave = function() {
                hideCustomTooltip();
                this.style.backgroundColor = "var(--bg-light, #f7fafc)";
                this.style.color = "var(--primary, #2d3748)";
                if(this.querySelector('div')) this.querySelector('div').style.backgroundColor = "var(--accent, #ecc94b)";
            };

            dayCell.onclick = () => {
                const cardElements = document.querySelectorAll('.event-card');
                const yearSelect = document.getElementById('yearSelect');
                const hidePastCheckbox = document.getElementById('hidePastCheckbox');

                const targetEventData = allClubEvents.find(e => e.isoDate === currentISO);
                if (targetEventData && targetEventData.isPast && hidePastCheckbox && hidePastCheckbox.checked) {
                    hidePastCheckbox.checked = false;
                }

                if (yearSelect && yearSelect.value !== 'all' && yearSelect.value !== String(year)) {
                    yearSelect.value = String(year);
                }

                if (typeof filterEvents === 'function') filterEvents();

                setTimeout(() => {
                    for (let card of cardElements) {
                        if (card.getAttribute('data-date') === currentISO) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            card.style.boxShadow = "0 0 15px var(--accent)";
                            setTimeout(() => card.style.boxShadow = "", 1500);
                            break;
                        }
                    }
                }, 50);
            };
        }

        daysGrid.appendChild(dayCell);
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    generateCalendar();
}

let activeTooltipElement = null;

function showCustomTooltip(target, content) {
    if (activeTooltipElement) hideCustomTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'calendar-custom-tooltip';
    tooltip.innerHTML = content;
    tooltip.style.cssText = "position: absolute; background-color: #2d3748; border: 2px solid #ecc94b; color: white; padding: 10px; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 5000; pointer-events: none; width: 220px;";

    document.body.appendChild(tooltip);
    activeTooltipElement = tooltip;

    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    tooltip.style.top = `${rect.top + scrollTop - tooltip.offsetHeight - 10}px`;
    tooltip.style.left = `${rect.left + scrollLeft + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
}

function hideCustomTooltip() {
    if (activeTooltipElement) {
        activeTooltipElement.remove();
        activeTooltipElement = null;
    }
}

function initCountdown() {
    const timerEl = document.getElementById('countdownTimer');
    const containerEl = document.getElementById('countdownContainer');
    if (!timerEl || !containerEl) return;

    const nextEvent = allClubEvents.find(e => !e.isPast);
    
    if (!nextEvent) {
        containerEl.style.display = 'none'; 
        return;
    }

    function calculateTime() {
        const now = new Date();
        const diff = nextEvent.dateTime - now;

        if (diff <= 0) {
            timerEl.textContent = `C'est aujourd'hui : ${nextEvent.titre} !`;
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        timerEl.innerHTML = `<strong>${days}j ${hours}h ${minutes}m</strong> — <a href="#evenements" onclick="showSection('evenements')" style="color: var(--accent); text-decoration: underline;">${escapeHTML(nextEvent.titre)}</a>`;
    }

    calculateTime();
    setInterval(calculateTime, 60000); 
}


/* =================================================================
   4. ONGLET "RÉSULTATS & MEMBRES"
   ================================================================ */
let listeMembresGlobale = [];
let directionTri = { colonne: null, ordre: 'asc' };

function afficherMembres(membres) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    membres.forEach(membre => {
        const tr = document.createElement('tr');
        
        let fideCellule = '';
        if (membre.fideId && membre.fideId !== '' && membre.fideId !== 'N/A') {
            fideCellule = `<a href="https://ratings.fide.com/profile/${escapeHTML(membre.fideId)}" target="_blank" rel="noopener noreferrer" class="table-fide-btn">🔗 Fiche FIDE</a>`;
        }

        tr.innerHTML = `
            <td><strong>${escapeHTML(membre.nomPrenom)}</strong></td>
            <td style="text-align:center;">${escapeHTML(membre.classique)}</td>
            <td style="text-align:center;">${escapeHTML(membre.rapide)}</td>
            <td style="text-align:center;">${escapeHTML(membre.blitz)}</td>
            <td style="text-align:center;">${escapeHTML(membre.categorie)}</td>
            <td style="text-align:center;">${escapeHTML(membre.genre)}</td>
            <td style="text-align:center;">${fideCellule}</td>
        `;
        tbody.appendChild(tr);
    });

    mettreAJourStatistiquesClub();
}

function mettreAJourStatistiquesClub() {
    if (!listeMembresGlobale || listeMembresGlobale.length === 0) return;

    const totalMembres = listeMembresGlobale.length;
    
    const nbFeminines = listeMembresGlobale.filter(m => {
        const g = String(m.genre).trim().toUpperCase();
        return g === 'F' || g === 'FEMININE';
    }).length;
    const pourcentFeminines = Math.round((nbFeminines / totalMembres) * 100);

    const nbFide = listeMembresGlobale.filter(m => {
        const fide = String(m.fideId).trim().toUpperCase();
        return fide !== '' && fide !== 'N/A' && fide !== '-';
    }).length;

    let maxEloGlobal = 0;
    const rapidesArr = [];

    listeMembresGlobale.forEach(m => {
        const eloClassique = parseInt(String(m.classique).replace(/\s/g, ''), 10) || 0;
        const eloRapide = parseInt(String(m.rapide).replace(/\s/g, ''), 10) || 0;
        const eloBlitz = parseInt(String(m.blitz).replace(/\s/g, ''), 10) || 0;

        const maxMember = Math.max(eloClassique, eloRapide, eloBlitz);
        if (maxMember > maxEloGlobal) maxEloGlobal = maxMember;

        if (eloRapide > 0) {
            rapidesArr.push(eloRapide);
        }
    });

    rapidesArr.sort((a, b) => b - a);
    const top5Rapide = rapidesArr.slice(0, 5);
    const sommeTop5 = top5Rapide.reduce((acc, val) => acc + val, 0);
    const moyenneTop5Rapide = top5Rapide.length > 0 ? Math.round(sommeTop5 / top5Rapide.length) : 0;

    const elMembres = document.getElementById('stat-total-membres');
    const elFeminines = document.getElementById('stat-feminines');
    const elFide = document.getElementById('stat-joueurs-fide');
    const elTopElo = document.getElementById('stat-top-elo');
    const elMoyenneElo = document.getElementById('stat-niveau-moyen');

    if (elMembres) elMembres.textContent = totalMembres;
    if (elFeminines) elFeminines.textContent = pourcentFeminines + '%';
    if (elFide) elFide.textContent = nbFide;
    if (elTopElo) elTopElo.textContent = maxEloGlobal > 0 ? maxEloGlobal : '-';
    if (elMoyenneElo) elMoyenneElo.textContent = moyenneTop5Rapide > 0 ? moyenneTop5Rapide : '-';
}

function trierTableau(propriete) {
    const estNumerique = ['classique', 'rapide', 'blitz'].includes(propriete);

    if (directionTri.colonne === propriete) {
        if (estNumerique && directionTri.ordre === 'desc') {
            directionTri.colonne = 'nomPrenom';
            directionTri.ordre = 'asc';
        } else {
            directionTri.ordre = directionTri.ordre === 'asc' ? 'desc' : 'asc';
        }
    } else {
        directionTri.colonne = propriete;
        directionTri.ordre = estNumerique ? 'desc' : 'asc';
    }

    const mappingIcones = {
        'nomPrenom': 'th-nomPrenom',
        'classique': 'th-classique',
        'rapide': 'th-rapide',
        'blitz': 'th-blitz'
    };
    
    Object.entries(mappingIcones).forEach(([key, thId]) => {
        const th = document.getElementById(thId);
        const icon = th ? th.querySelector('.sort-icon') : null;
        if (th) {
            if (directionTri.colonne === key) {
                if (icon) {
                    icon.textContent = directionTri.ordre === 'desc' ? '▼' : '▲';
                    icon.style.color = '#ffffff';
                }
                th.setAttribute('aria-sort', directionTri.ordre === 'desc' ? 'descending' : 'ascending');
            } else {
                if (icon) {
                    icon.textContent = '↕';
                    icon.style.color = 'var(--accent)';
                }
                th.removeAttribute('aria-sort');
            }
        }
    });

    listeMembresGlobale.sort((a, b) => {
        let propActive = directionTri.colonne;
        let estActuellementNumerique = ['classique', 'rapide', 'blitz'].includes(propActive);

        let valA = a[propActive];
        let valB = b[propActive];

        if (estActuellementNumerique) {
            let numA = parseInt(String(valA).replace(/\s/g, ''), 10) || 0;
            let numB = parseInt(String(valB).replace(/\s/g, ''), 10) || 0;
            return directionTri.ordre === 'asc' ? numA - numB : numB - numA;
        } else {
            let strA = String(valA).trim();
            let strB = String(valB).trim();
            return directionTri.ordre === 'asc' 
                ? strA.localeCompare(strB, 'fr', { sensitivity: 'base' }) 
                : strB.localeCompare(strA, 'fr', { sensitivity: 'base' });
        }
    });

    filterByInputName();
}

function brancherLesEntetes() {
    const mapping = {
        'th-nomPrenom': 'nomPrenom', 'th-classique': 'classique',
        'th-rapide': 'rapide', 'th-blitz': 'blitz',
        'th-categorie': 'categorie', 'th-genre': 'genre', 'th-fide': 'fideId'
    };

    for (const [id, propriete] of Object.entries(mapping)) {
        const th = document.getElementById(id);
        if (th) {
            th.style.cursor = 'pointer';
            th.setAttribute('title', 'Cliquez pour trier');
            
            const thClone = th.cloneNode(true);
            th.parentNode.replaceChild(thClone, th);
            
            thClone.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.textContent.includes('🔍')) return;
                trierTableau(propriete);
            });
        }
    }
}

function toggleSearchInput(event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('searchContainer');
    const input = document.getElementById('nameSearchInput');
    if (container && input) {
        const visible = container.style.display === 'block';
        container.style.display = visible ? 'none' : 'block';
        if (!visible) {
            input.focus();
        } else {
            input.value = '';
            afficherMembres(listeMembresGlobale);
        }
    }
}

function filterByInputName() {
    const input = document.getElementById('nameSearchInput');
    if (!input) return;
    
    const saisie = input.value.toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (saisie === '') {
        afficherMembres(listeMembresGlobale);
    } else {
        const membresFiltres = listeMembresGlobale.filter(m => {
            const nomNormalise = m.nomPrenom.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return nomNormalise.includes(saisie);
        });
        afficherMembres(membresFiltres);
    }
}

window.googleDocCallback = function(data) {
    const scriptEl = document.getElementById('jsonp-membres-script');
    if (scriptEl) scriptEl.remove();

    try {
        const rows = data.table.rows;
        listeMembresGlobale = [];

        for (let i = 0; i < rows.length; i++) {
            const cellules = rows[i].c;
            if (!cellules || cellules.length === 0) continue;

            const getVal = (index) => {
                if (!cellules[index] || cellules[index].v === null) return '';
                return String(cellules[index].v).trim().replace(/^["']|["']\$/g, '').trim();
            };

            const membre = {
                nomPrenom: getVal(0),
                classique: getVal(1) || '0',
                rapide: getVal(2) || '0',
                blitz: getVal(3) || '0',
                categorie: getVal(4),
                genre: getVal(5),
                fideId: getVal(6)
            };

            if (membre.nomPrenom !== '') listeMembresGlobale.push(membre);
        }

		listeMembresGlobale.sort((a, b) => a.nomPrenom.localeCompare(b.nomPrenom, 'fr'));
        cacheManager.set('cache_membres', listeMembresGlobale);

        afficherMembres(listeMembresGlobale);
        brancherLesEntetes();

	} catch (error) {
        console.error("Erreur lors du traitement du flux Google Sheets :", error);
    }
};

function loadMembresData() {
    const cachedMembres = cacheManager.get('cache_membres');

    if (cachedMembres) {
        listeMembresGlobale = cachedMembres;
        afficherMembres(listeMembresGlobale);
        brancherLesEntetes();
    } else {
        cacheManager.clear('cache_membres');

        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.MEMBRES_SHEET_ID}/gviz/tq?tqx=responseHandler:googleDocCallback`;
        const script = document.createElement('script');
        script.id = 'jsonp-membres-script';
        script.src = url;
        script.onerror = function() { 
            script.remove(); 
            afficherEtatFichier('membersTableBody', 'Impossible de charger la liste des membres pour le moment. Veuillez réessayer ultérieurement.', true, 7);
        };
        document.head.appendChild(script);
    }
}


/* =================================================================
   5. ONGLET "VIE DU CLUB" (GALERIE PHOTOS & GAZETTES)
   ================================================================ */
let allGazettesGlobal = [];

async function chargerGazettesDrive() {
    const gazetteListEl = document.getElementById('gazetteList');
    if (!gazetteListEl) return;

    if (!CONFIG.DRIVE_API_KEY || CONFIG.DRIVE_API_KEY === 'VOTRE_CLE_API_GOOGLE' || !CONFIG.DRIVE_GAZETTE_FOLDER_ID || CONFIG.DRIVE_GAZETTE_FOLDER_ID === 'VOTRE_ID_DOSSIER_GAZETTE') {
        gazetteListEl.innerHTML = '<li style="color: #7f8c8d; font-style: italic;">Dossier Drive non configuré.</li>';
        return;
    }

    try {
        const query = `'${CONFIG.DRIVE_GAZETTE_FOLDER_ID}' in parents and mimeType = 'application/pdf' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=files(id,name)&orderBy=name desc`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur réseau Google Drive");

        const data = await response.json();
        allGazettesGlobal = data.files || [];

        renderGazettesUI();

    } catch (error) {
        console.warn("Impossible de charger les gazettes Google Drive", error);
        gazetteListEl.innerHTML = '<li style="color: #7f8c8d; font-style: italic;">Erreur de chargement.</li>';
    }
}

function renderGazettesUI() {
    const gazetteListEl = document.getElementById('gazetteList');
    const modalListEl = document.getElementById('gazetteModalList');
    if (!gazetteListEl) return;

    gazetteListEl.innerHTML = '';
    if (modalListEl) modalListEl.innerHTML = '';

    if (allGazettesGlobal.length === 0) {
        gazetteListEl.innerHTML = '<li style="color: #7f8c8d; font-style: italic;">Aucune gazette pour le moment.</li>';
        return;
    }

    const latestGazettes = allGazettesGlobal.slice(0, 5);
    latestGazettes.forEach(file => {
        const li = document.createElement('li');
		const fileUrl = `https://drive.google.com/file/d/${escapeHTML(file.id)}/view?usp=sharing`;
		li.innerHTML = `📄 <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(file.name)}</a>`;
        gazetteListEl.appendChild(li);
    });

    const existingBtnContainer = document.getElementById('gazetteBtnContainer');
    if (existingBtnContainer) existingBtnContainer.remove();

    if (allGazettesGlobal.length > 5) {
        const cardContainer = gazetteListEl.closest('.card');
        if (cardContainer) {
            const btnContainer = document.createElement('div');
            btnContainer.id = 'gazetteBtnContainer';
            btnContainer.style.cssText = 'text-align: center; margin-top: 1rem;';
            btnContainer.innerHTML = `<button type="button" class="btn" onclick="openGazetteModal()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; margin-top: 0;">📚 Voir toutes les archives (${allGazettesGlobal.length} numéros)</button>`;
            cardContainer.appendChild(btnContainer);
        }
    }

    if (modalListEl) {
        populateModalList(allGazettesGlobal);
    }
}

function populateModalList(gazettes) {
    const modalListEl = document.getElementById('gazetteModalList');
    if (!modalListEl) return;
    modalListEl.innerHTML = '';

    gazettes.forEach(file => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 0.5rem; border-bottom: 1px solid #ddd;';
        const fileUrl = `https://drive.google.com/file/d/${escapeHTML(file.id)}/view?usp=sharing`;
        li.innerHTML = `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none; font-weight: 500; display: block;">📄 ${escapeHTML(file.name)}</a>`;
        modalListEl.appendChild(li);
    });
}

function openGazetteModal() {
    const modal = document.getElementById('gazetteModal');
    const input = document.getElementById('gazetteSearchInput');
    if (input) input.value = '';
    populateModalList(allGazettesGlobal);
    if (modal) modal.classList.add('active');
}

function closeGazetteModal() {
    const modal = document.getElementById('gazetteModal');
    const input = document.getElementById('gazetteSearchInput');
    if (input) input.value = '';
    populateModalList(allGazettesGlobal);
    if (modal) modal.classList.remove('active');
}

function filterGazetteModal() {
    const input = document.getElementById('gazetteSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const filtered = allGazettesGlobal.filter(file => {
        const nameNorm = file.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nameNorm.includes(filter);
    });

    populateModalList(filtered);
}

let elementsRacineGlobales = [];
let photosAlbumGlobales = [];
let pageGalerieActuelle = 1;
let albumActuelId = null;
let nomAlbumActuel = "";

function getColonnesParLigne() {
    const galleryContainer = document.getElementById('dynamicGalleryGrid');
    if (!galleryContainer) return 5;

    let containerWidth = galleryContainer.clientWidth;
    if (containerWidth === 0) {
        containerWidth = window.innerWidth - 48;
        if (containerWidth > 1120) containerWidth = 1120;
    }

    const minItemWidth = 180; 
    const gap = 16;           

    const cols = Math.floor((containerWidth + gap) / (minItemWidth + gap));
    return Math.max(1, cols);
}

async function chargerGaleriePhotos() {
    albumActuelId = null;
    nomAlbumActuel = "";
    
    const galleryContainer = document.getElementById('dynamicGalleryGrid');
    if (!galleryContainer) return;

    supprimerControlesExtras();

    if (!CONFIG.DRIVE_API_KEY || CONFIG.DRIVE_API_KEY === 'VOTRE_CLE_API_GOOGLE') {
        afficherEtatFichier('dynamicGalleryGrid', 'Galerie Google Drive non configurée.', true);
        return;
    }

    try {
        afficherEtatFichier('dynamicGalleryGrid', 'Chargement de la galerie...');

        const query = `'${CONFIG.DRIVE_PHOTOS_FOLDER_ID}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/') and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=files(id,name,mimeType,thumbnailLink)`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur lors de la récupération du contenu Google Drive.");
        
        const data = await response.json();
        const fichiers = data.files || [];

        if (fichiers.length === 0) {
            afficherEtatFichier('dynamicGalleryGrid', 'Aucune photo dans le dossier pour le moment.');
            return;
        }

        const sousDossiers = fichiers.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const photosRacine = fichiers.filter(f => f.mimeType.startsWith('image/'));

        const promessesAlbums = sousDossiers.map(async (album) => {
            let coverUrl = '';
            try {
                const imgQuery = `'${album.id}' in parents and (mimeType contains 'image/') and trashed = false`;
                const imgUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(imgQuery)}&key=${CONFIG.DRIVE_API_KEY}&pageSize=1&fields=files(thumbnailLink,id)`;
                const imgRes = await fetch(imgUrl);
                const imgData = await imgRes.json();
                if (imgData.files && imgData.files.length > 0) {
                    const img = imgData.files[0];
                    coverUrl = img.thumbnailLink ? img.thumbnailLink.replace(/=s\d+/, '=w400-h400-c') : `https://lh3.googleusercontent.com/d/${img.id}`;
                }
            } catch (e) {
                console.warn("Impossible de charger la couverture de l'album", album.name);
            }
            return { type: 'album', id: album.id, name: album.name, coverUrl: coverUrl };
        });

        const albumsAvecCouverture = await Promise.all(promessesAlbums);

        const photosFormattees = photosRacine.map(f => ({
            type: 'photo',
            id: f.id,
            name: f.name,
            thumbnailLink: f.thumbnailLink
        }));

        elementsRacineGlobales = [...albumsAvecCouverture, ...photosFormattees];

        pageGalerieActuelle = 1;
        afficherPageGalerie();

    } catch (error) {
        console.error("Erreur galerie Google Drive :", error);
        afficherEtatFichier('dynamicGalleryGrid', 'Erreur lors du chargement de la galerie.', true);
    }
}

async function chargerPhotosAlbum(folderId, folderName) {
    albumActuelId = folderId;
    nomAlbumActuel = folderName;

    const galleryContainer = document.getElementById('dynamicGalleryGrid');
    if (!galleryContainer) return;

    afficherEtatFichier('dynamicGalleryGrid', `Chargement de l'album "${folderName}"...`);
    supprimerControlesExtras();
    afficherBoutonRetour();

    try {
        const query = `'${folderId}' in parents and (mimeType contains 'image/') and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=files(id,name,thumbnailLink)`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur lors de la récupération des photos.");
        
        const data = await response.json();
        photosAlbumGlobales = data.files || [];
        
        if (photosAlbumGlobales.length === 0) {
            afficherEtatFichier('dynamicGalleryGrid', 'Cet album est vide pour le moment.');
            return;
        }

        pageGalerieActuelle = 1;
        afficherPageGalerie();

    } catch (error) {
        console.error("Erreur photos Google Drive :", error);
        afficherEtatFichier('dynamicGalleryGrid', 'Erreur lors du chargement des photos.', true);
    }
}

function afficherPageGalerie() {
    const galleryContainer = document.getElementById('dynamicGalleryGrid');
    if (!galleryContainer) return;

    galleryContainer.innerHTML = '';

    const listeActive = (albumActuelId === null) ? elementsRacineGlobales : photosAlbumGlobales;
    const cols = getColonnesParLigne();
    const elementsParPage = cols * 2;

    const debut = (pageGalerieActuelle - 1) * elementsParPage;
    const fin = debut + elementsParPage;
    const elementsPage = listeActive.slice(debut, fin);

    const listeUrlsPhotos = listeActive
        .filter(item => item.type !== 'album')
        .map(photo => `https://lh3.googleusercontent.com/d/${photo.id}`);

    elementsPage.forEach(itemData => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        if (albumActuelId === null && itemData.type === 'album') {
            item.className = 'gallery-item album-card';
            
            if (itemData.coverUrl) {
                const optimizedCoverUrl = itemData.coverUrl.replace(/=s\d+/, '=w400-h400-c');
                item.style.backgroundImage = `url('${optimizedCoverUrl}')`;
            } else {
                item.style.backgroundColor = 'var(--primary)';
            }

            item.onclick = () => chargerPhotosAlbum(itemData.id, itemData.name);

            item.innerHTML = `
                <h4 style="color: var(--accent); margin: 0 0 4px 0; font-size: 1rem; word-break: break-word; padding: 0 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${escapeHTML(itemData.name)}</h4>
                <span style="font-size: 0.75rem; color: #ffffff; background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 4px;">Ouvrir l'album</span>
            `;
        } else {
            const photo = itemData;
            const fullImageUrl = `https://lh3.googleusercontent.com/d/${photo.id}`;
            
            let thumbUrl = fullImageUrl;
            if (photo.thumbnailLink) {
                thumbUrl = photo.thumbnailLink.replace(/=s\d+/, '=w400-h400-c');
            }

            const img = document.createElement('img');
            img.src = thumbUrl;
            img.loading = 'lazy'; // Optimisation : chargement différé systématique
            img.alt = photo.name ? escapeHTML(photo.name) : "Photo du club d'échecs de Fismes";
            
            const indexActuel = listeUrlsPhotos.indexOf(fullImageUrl);
            img.onclick = () => zoomImage(fullImageUrl, listeUrlsPhotos, indexActuel);
            
            img.onerror = function() { this.parentElement.style.display = 'none'; };

            item.appendChild(img);
        }

        galleryContainer.appendChild(item);
    });

    mettreAJourControlesGalerie(elementsParPage);
}

function afficherBoutonRetour() {
    let retourContainer = document.getElementById('galleryBackContainer');
    if (!retourContainer) {
        retourContainer = document.createElement('div');
        retourContainer.id = 'galleryBackContainer';
        retourContainer.style.cssText = 'margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;';
        
        const galleryCard = document.getElementById('dynamicGalleryGrid').parentElement;
        galleryCard.insertBefore(retourContainer, document.getElementById('dynamicGalleryGrid'));
    }

    retourContainer.innerHTML = `
        <button id="backToAlbumsBtn" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; background: var(--primary); color: white;">← Retour aux albums</button>
        <span style="font-weight: bold; color: var(--primary); font-size: 1.05rem;">📁 ${escapeHTML(nomAlbumActuel)}</span>
    `;

    document.getElementById('backToAlbumsBtn').onclick = () => {
        chargerGaleriePhotos(); 
    };
}

function supprimerControlesExtras() {
    const retourContainer = document.getElementById('galleryBackContainer');
    if (retourContainer) retourContainer.remove();

    const paginationContainer = document.getElementById('galleryPagination');
    if (paginationContainer) paginationContainer.remove();
}

function mettreAJourControlesGalerie(elementsParPage) {
    const listeActive = (albumActuelId === null) ? elementsRacineGlobales : photosAlbumGlobales;
    const totalPages = Math.ceil(listeActive.length / elementsParPage);
    
    let paginationContainer = document.getElementById('galleryPagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'galleryPagination';
        paginationContainer.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem;';
        
        const galleryCard = document.getElementById('dynamicGalleryGrid').parentElement;
        galleryCard.appendChild(paginationContainer);
    }

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button id="prevGalleryBtn" class="btn" style="margin-top: 0; padding: 0.4rem 0.8rem; font-size: 0.85rem; ${pageGalerieActuelle === 1 ? 'opacity: 0.4; cursor: not-allowed;' : ''}">← Précédent</button>
        <span style="font-weight: 500; font-size: 0.9rem; color: var(--text); line-height: 1;">Page ${pageGalerieActuelle} / ${totalPages}</span>
        <button id="nextGalleryBtn" class="btn" style="margin-top: 0; padding: 0.4rem 0.8rem; font-size: 0.85rem; ${pageGalerieActuelle === totalPages ? 'opacity: 0.4; cursor: not-allowed;' : ''}">Suivant →</button>
    `;

    const prevBtn = document.getElementById('prevGalleryBtn');
    const nextBtn = document.getElementById('nextGalleryBtn');

    if (prevBtn && pageGalerieActuelle > 1) {
        prevBtn.onclick = () => {
            pageGalerieActuelle--;
            afficherPageGalerie();
        };
    }

    if (nextBtn && pageGalerieActuelle < totalPages) {
        nextBtn.onclick = () => {
            pageGalerieActuelle++;
            afficherPageGalerie();
        };
    }
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const listeActive = (albumActuelId === null) ? elementsRacineGlobales : photosAlbumGlobales;
        if (listeActive.length > 0) {
            afficherPageGalerie();
        }
    }, 250);
});


/* =================================================================
   6. ONGLET "CONTACT" (FORMULAIRE)
   ================================================================ */
async function envoyerFormulaireContact(e) {
    e.preventDefault();
    
    const contactForm = document.getElementById('contactForm');
    const statusEl = document.getElementById('formStatus');
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    
    if (!contactForm || !statusEl || !submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours...";
    statusEl.style.display = 'none';

    try {
        const response = await fetch(contactForm.action, {
            method: 'POST',
            body: new FormData(contactForm),
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#27ae60';
            statusEl.style.fontWeight = 'bold';
            statusEl.textContent = "✅ Merci. Votre message a bien été envoyé !";
            contactForm.reset();
        } else {
            throw new Error("Erreur lors de l'envoi");
        }
    } catch (error) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#e74c3c';
        statusEl.style.fontWeight = 'bold';
        statusEl.textContent = "❌ Une erreur est survenue lors de l'envoi. Vous pouvez nous écrire directement par e-mail.";
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Envoyer le message";
    }
}


/* =================================================================
   7. INITIALISATION
   ================================================================ */
let logoClickTracker = 0;
let logoClickTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    loadMembresData();           
    loadDynamicEvents();          
    loadPlanningData();
    chargerTactiqueDuJour(); 
    verifierStatutSeanceClub();
    chargerGaleriePhotos();
    chargerGazettesDrive();
    initFooterYear();

    const logoEl = document.getElementById('clubLogo');
    if (logoEl) {
        logoEl.addEventListener('click', () => {
            logoClickTracker++;
            
            if (logoClickTimer) clearTimeout(logoClickTimer);
            
            logoClickTimer = setTimeout(() => {
                logoClickTracker = 0;
            }, 1500);

            if (logoClickTracker >= 5) {
                logoClickTracker = 0;
                clearTimeout(logoClickTimer);
                showSection('bureau');
            }
        });
    }
});


/* =================================================================
   8. FOOTER & MENTIONS LÉGALES
   ================================================================ */
function initFooterYear() {
    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

function openLegalModal(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('legalModal');
    if (modal) modal.classList.add('active');
}

function closeLegalModal() {
    const modal = document.getElementById('legalModal');
    if (modal) modal.classList.remove('active');
}


/* =================================================================
   9. ENREGISTREMENT DU SERVICE WORKER (MODE HORS-LIGNE)
   ================================================================ */
if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker enregistré avec succès :', reg.scope))
        .catch(err => console.warn('Échec de l\'enregistrement du Service Worker :', err));
}