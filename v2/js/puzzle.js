/* =================================================================
   DÉFI DU JOUR (Chess.com) - JOUABLE à la souris et au doigt
   - Carte d'accueil : image du problème + boutons (comportement d'origine conservé)
   - Fenêtre "Jouer le défi" : plateau Chessground + validation des coups par chess.js
   - Bibliothèques (GPL-3.0 / BSD-2) chargées à la demande depuis /vendor
   - Problème de secours intégré si l'API Chess.com est indisponible
   ================================================================ */
import { CONFIG } from './config.js';
import { $, h, safeUrl, debounce, fetchWithTimeout, on } from './utils.js';
import { loadWithCache } from './cache.js';
import { openModal } from './modal.js';

/* ------------------------------ Notation (français <-> anglais) ------------------------------ */
const FR_TO_EN = { R: 'K', D: 'Q', T: 'R', F: 'B', C: 'N' };
const EN_TO_FR = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

export const stripSan = (san) => String(san).replace(/[+#!?]/g, '');
export const toFrench = (san) => san.replace(/^[KQRBN]/, (p) => EN_TO_FR[p]).replace(/=([QRBN])/, (_, p) => `=${EN_TO_FR[p]}`);

export function frenchToEnglishSan(text) {
    let san = text.trim().replace(/0/g, 'O');
    if (/^o-o(-o)?[+#]?$/i.test(san)) return san.toUpperCase();
    san = san.replace(/^[RDTFC]/, (p) => FR_TO_EN[p]);
    san = san.replace(/=?([DTFC])([+#]?)$/, (_, p, check) => `=${FR_TO_EN[p]}${check}`); /* promotion : e8D, e8=D */
    return san;
}

/* Extrait la liste des coups d'un PGN (sans en-têtes, numéros, commentaires ni résultat) */
export function parseMovetext(pgn) {
    return String(pgn || '')
        .replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ')
        .replace(/\d+\.(\.\.)?/g, ' ').replace(/(^|\s)(1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/g, ' ')
        .split(/\s+/).map((t) => t.replace(/[!?]+$/, '')).filter(Boolean);
}

/* ------------------------------ État ------------------------------ */
let puzzle = null;          /* { fen, pgn, image, url, fallback } */
let libs = null;            /* { Chess, Chessground } */
let game = null;            /* partie en cours dans la fenêtre */
let promotionResolve = null;

const say = (text) => { $('#puzzleStatus').textContent = text; };
const colorName = (chess) => (chess.turn() === 'w' ? 'white' : 'black');

/* ------------------------------ Carte d'accueil ------------------------------ */
/* Seule l'image (cliquable) est affichée ; le problème de secours ajoute sa légende "Trait aux Blancs." */
function renderCard() {
    const description = $('#puzzleDesc');
    $('#puzzleImg').src = puzzle.image;
    description.hidden = !puzzle.fallback;
    if (puzzle.fallback) description.textContent = CONFIG.PUZZLE.FALLBACK.description;
    $('#puzzleChessLink').href = puzzle.fallback ? 'https://www.chess.com/daily-chess-puzzle' : puzzle.url;
}

function setPuzzle(data) {
    if (puzzle && puzzle.fen !== data.fen && game) resetGame(true);
    puzzle = data;
    renderCard();
}

async function fetchPuzzle() {
    const response = await fetchWithTimeout(CONFIG.PUZZLE.API_URL);
    if (!response.ok) throw new Error(`Chess.com : erreur ${response.status}`);
    const data = await response.json();
    const image = safeUrl(data.image);
    if (!image || typeof data.fen !== 'string') throw new Error('Données du défi invalides');
    return {
        fen: data.fen, pgn: typeof data.pgn === 'string' ? data.pgn : '', image, fallback: false,
        url: safeUrl(data.url, ['chess.com']) || 'https://www.chess.com/daily-chess-puzzle'
    };
}

const fallbackPuzzle = () => ({ fen: CONFIG.PUZZLE.FALLBACK.fen, pgn: '', image: CONFIG.PUZZLE.FALLBACK.image, url: '', fallback: true });

/* ------------------------------ Bibliothèques ------------------------------ */
function loadCss(href) {
    return new Promise((resolve, reject) => {
        if ($(`link[href="${href}"]`)) { resolve(); return; }
        const link = h('link', { rel: 'stylesheet', href });
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Feuille de style introuvable : ${href}`));
        document.head.append(link);
    });
}

async function loadLibs() {
    if (libs) return libs;
    const { CHESS, CHESSGROUND, CSS } = CONFIG.PUZZLE.VENDOR;
    const url = (path) => new URL(`../${path}`, import.meta.url).href;
    const [chessModule, groundModule] = await Promise.all([import(url(CHESS)), import(url(CHESSGROUND))]);
    const Chess = chessModule.Chess ?? chessModule.default?.Chess ?? chessModule.default;
    const Chessground = groundModule.Chessground ?? groundModule.default;
    if (typeof Chess !== 'function' || typeof Chessground !== 'function') throw new Error('Bibliothèques invalides');
    await Promise.all(CSS.map(loadCss));
    libs = { Chess, Chessground };
    return libs;
}

/* ------------------------------ Plateau jouable ------------------------------ */
function destinations(chess) {
    const map = new Map();
    for (const move of chess.moves({ verbose: true })) {
        if (!map.has(move.from)) map.set(move.from, []);
        map.get(move.from).push(move.to);
    }
    return map;
}

/* Remet le plateau dans l'état exact de la partie (annule aussi un déplacement refusé) */
function sync(lastMove) {
    const { chess, cg } = game;
    const turn = colorName(chess);
    const canMove = !game.locked && !game.finished && turn === game.userColor;
    const config = {
        fen: chess.fen(), turnColor: turn, check: chess.inCheck() ? turn : false,
        movable: { color: canMove ? game.userColor : undefined, dests: canMove ? destinations(chess) : new Map() }
    };
    if (lastMove) config.lastMove = lastMove;
    cg.set(config);
    cg.setAutoShapes([]);
}

const expectedMove = () => {
    const san = game.line[game.ply];
    return san ? game.chess.moves({ verbose: true }).find((m) => stripSan(m.san) === stripSan(san)) ?? null : null;
};

function buildLine(Chess) {
    const tokens = puzzle.fallback ? CONFIG.PUZZLE.FALLBACK.line : parseMovetext(puzzle.pgn);
    const probe = new Chess(puzzle.fen);
    const line = [];
    for (const token of tokens) {
        let move = null;
        try { move = probe.move(token); } catch { move = null; }
        if (!move) break;
        line.push(move.san);
    }
    return line;
}

function unavailable(message) {
    say(message);
    $('#puzzleStage').hidden = true;
    $('#puzzleMoveForm').hidden = true;
    $('#puzzleControls').hidden = true;
}

function startGame() {
    const { Chess, Chessground } = libs;
    let chess;
    try { chess = new Chess(puzzle.fen); } catch { unavailable('Ce défi ne peut pas être joué ici. Retrouvez-le sur Chess.com.'); return; }
    const line = buildLine(Chess);
    if (line.length === 0) { unavailable('Ce défi ne peut pas être joué ici. Retrouvez-le sur Chess.com.'); return; }

    const userColor = colorName(chess);
    game = { Chess, chess, line, ply: 0, locked: false, finished: false, userColor, token: 0, cg: null };
    game.cg = Chessground($('#puzzleBoard'), {
        fen: chess.fen(), orientation: userColor, turnColor: userColor, coordinates: true,
        animation: { enabled: true, duration: 200 },
        highlight: { lastMove: true, check: true },
        draggable: { enabled: true, showGhost: true },
        selectable: { enabled: true },
        premovable: { enabled: false },
        movable: { free: false, color: userColor, showDests: true, dests: destinations(chess), events: { after: onBoardMove } }
    });
    say(`Trait aux ${userColor === 'white' ? 'Blancs' : 'Noirs'} — trouvez le meilleur coup.`);
}

function resetGame(destroy = false) {
    if (!game) return;
    game.token++;
    if (destroy) {
        game.cg.destroy();
        $('#puzzleBoard').replaceChildren();
        game = null;
        return;
    }
    game.chess = new game.Chess(puzzle.fen);
    game.ply = 0;
    game.locked = false;
    game.finished = false;
    game.cg.set({ orientation: game.userColor });
    sync();
    $('#puzzleSolutionModal').hidden = true;
    say(`Trait aux ${game.userColor === 'white' ? 'Blancs' : 'Noirs'} — trouvez le meilleur coup.`);
}

function onBoardMove(from, to) {
    const piece = game.chess.get(from);
    const lastRank = piece?.color === 'w' ? '8' : '1';
    if (piece?.type === 'p' && to[1] === lastRank) {
        askPromotion().then((choice) => (choice ? attempt(from, to, choice) : sync()));
    } else {
        attempt(from, to);
    }
}

function askPromotion() {
    return new Promise((resolve) => {
        promotionResolve = resolve;
        $('#puzzlePromo').hidden = false;
        $('#puzzlePromo button')?.focus();
    });
}

function closePromotion(choice = null) {
    $('#puzzlePromo').hidden = true;
    const resolve = promotionResolve;
    promotionResolve = null;
    resolve?.(choice);
}

/* Applique le coup du joueur et le compare à la solution (ou accepte tout mat immédiat) */
function attempt(from, to, promotion) {
    if (!game || game.locked || game.finished) { sync(); return; }
    const { chess } = game;
    const expected = expectedMove();
    let move = null;
    try { move = chess.move({ from, to, promotion }); } catch { move = null; }
    if (!move) { sync(); return; }

    const matches = expected && expected.from === from && expected.to === to && (expected.promotion ?? '') === (promotion ?? '');
    if (!matches && !chess.isCheckmate()) {
        chess.undo();
        sync();
        say('Ce n’est pas la bonne idée, essayez encore.');
        return;
    }
    game.ply++;
    sync([from, to]);
    if (game.ply >= game.line.length || chess.isGameOver()) finish(); else opponentReply();
}

function opponentReply() {
    const token = game.token;
    game.locked = true;
    sync();
    say('L’adversaire répond…');
    setTimeout(() => {
        if (!game || game.token !== token) return;
        let move = null;
        try { move = game.chess.move(game.line[game.ply]); } catch { move = null; }
        game.locked = false;
        if (!move) { sync(); return; }
        game.ply++;
        sync([move.from, move.to]);
        if (game.ply >= game.line.length || game.chess.isGameOver()) finish();
        else say('Bien joué ! À vous de jouer.');
    }, 550);
}

function finish() {
    game.finished = true;
    sync();
    say('Bravo, défi réussi !');
}

/* ------------------------------ Boutons : indice, solution, coup au clavier ------------------------------ */
function solutionText() {
    if (puzzle.fallback) return CONFIG.PUZZLE.FALLBACK.solution.join(' — ');
    const parts = game.chess.fen().split(' ');
    const startParts = puzzle.fen.split(' ');
    let turn = startParts[1];
    let number = parseInt(startParts[5], 10) || 1;
    const out = [];
    game.line.forEach((san, index) => {
        if (turn === 'w') out.push(`${number}. ${toFrench(san)}`);
        else { out.push(index === 0 ? `${number}… ${toFrench(san)}` : toFrench(san)); number++; }
        turn = turn === 'w' ? 'b' : 'w';
    });
    return `Solution : ${out.join(' ')}`;
}

function handleControl(action) {
    if (!game) return;
    if (action === 'restart') { resetGame(); return; }
    if (action === 'flip') { game.cg.toggleOrientation(); return; }
    if (action === 'solution') {
        const box = $('#puzzleSolutionModal');
        box.textContent = solutionText();
        box.hidden = !box.hidden;
        return;
    }
    if (action === 'hint' && !game.finished && !game.locked) {
        const move = expectedMove();
        if (!move) return;
        game.cg.setAutoShapes([{ orig: move.from, brush: 'green' }]);
        say(`Indice : déplacez la pièce située en ${move.from}.`);
    }
}

function resolveTypedMove(text) {
    const legal = game.chess.moves({ verbose: true });
    const typed = text.trim().replace(/\s+/g, '');
    if (!typed) return null;
    const coordinates = typed.toLowerCase().match(/^([a-h][1-8])[-x]?([a-h][1-8])([qrbn])?$/);
    if (coordinates) {
        return legal.find((m) => m.from === coordinates[1] && m.to === coordinates[2] && (!m.promotion || m.promotion === (coordinates[3] ?? 'q'))) ?? null;
    }
    const wanted = stripSan(frenchToEnglishSan(typed));
    return legal.find((m) => stripSan(m.san) === wanted)
        ?? legal.find((m) => stripSan(m.san).replace('x', '') === wanted.replace('x', '')) ?? null;
}

function submitTypedMove(event) {
    event.preventDefault();
    if (!game) return;
    const input = $('#puzzleMoveInput');
    if (game.finished || game.locked) { say(game.finished ? 'Le défi est terminé : cliquez sur « Recommencer » pour rejouer.' : 'Patientez, l’adversaire répond.'); return; }
    const move = resolveTypedMove(input.value);
    if (!move) { say(`Coup non reconnu : « ${input.value.trim()} ». Exemple : Cf3, e4 ou O-O.`); return; }
    input.value = '';
    attempt(move.from, move.to, move.promotion);
}

/* ------------------------------ Ouverture de la fenêtre ------------------------------ */
async function openPuzzle() {
    if (!puzzle) return;
    openModal('puzzleModal');
    if (game) { game.cg.redrawAll(); return; }
    say('Chargement du plateau…');
    try {
        await loadLibs();
    } catch (error) {
        console.warn('Défi jouable indisponible :', error);
        unavailable('Le plateau interactif n’est pas disponible pour le moment. Vous pouvez retrouver ce défi sur Chess.com.');
        return;
    }
    startGame();
}

export async function initPuzzle() {
    $('#puzzleDateNum').textContent = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    $('#puzzleBoardBtn').addEventListener('click', openPuzzle);
    $('#puzzleControls').addEventListener('click', (event) => {
        const button = event.target.closest('[data-puzzle]');
        if (button) handleControl(button.dataset.puzzle);
    });
    $('#puzzleMoveForm').addEventListener('submit', submitTypedMove);
    $('#puzzlePromo').addEventListener('click', (event) => {
        const button = event.target.closest('[data-promo]');
        closePromotion(button ? button.dataset.promo : null);
    });
    on('modal:close', (event) => { if (event.detail.id === 'puzzleModal') closePromotion(null); });
    window.addEventListener('resize', debounce(() => game?.cg.redrawAll(), 150));

    await loadWithCache('puzzle', fetchPuzzle, {
        onData: setPuzzle,
        onError: () => setPuzzle(fallbackPuzzle())
    });
}

