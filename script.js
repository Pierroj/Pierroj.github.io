// ================= ระบบ Dark Mode =================
function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleDarkMode() {
    const isDark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
}

if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    applyTheme(true);
} else {
    applyTheme(false);
}

// ================= ตัวแปรหลัก =================
let players = [];
let matches = []; 

function addPlayer() {
    const nameInput = document.getElementById('playerName');
    const isBeginner = document.getElementById('isBeginner').checked;
    const name = nameInput.value.trim();
    if (name === '') return alert('กรุณาใส่ชื่อผู้เล่น');
    if (players.find(p => p.name === name)) return alert('ชื่อซ้ำครับ');
    players.push({ name, isBeginner, gamesPlayed: 0, homeGames: 0, awayGames: 0, consecutiveGames: 0, consecutiveRests: 0, firstRestAt: Infinity });
    nameInput.value = '';
    document.getElementById('isBeginner').checked = false;
    updatePlayerList();
}

document.getElementById('playerName').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addPlayer();
});

function updatePlayerList() {
    const list = document.getElementById('playerList');
    list.innerHTML = players.map((p, index) => `
        <li class="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-full text-sm flex items-center gap-2 hover:bg-white dark:hover:bg-gray-600 transition shadow-sm text-gray-800 dark:text-gray-100">
            <span class="font-medium">${p.name}</span> <span class="text-xs">${p.isBeginner ? '🐣' : '🔥'}</span>
            <button onclick="removePlayer(${index})" class="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-bold ml-1 transition text-base leading-none">×</button>
        </li>
    `).join('');
}

function removePlayer(index) { 
    players.splice(index, 1); 
    updatePlayerList(); 
}

function getTeamKey(p1, p2) { return [p1.name, p2.name].sort().join('|'); }

function getCombinations(array, k) {
    const results = [];
    function helper(start, current) {
        if (current.length === k) { results.push([...current]); return; }
        for (let i = start; i < array.length; i++) {
            current.push(array[i]); helper(i + 1, current); current.pop();
        }
    }
    helper(0, []); return results;
}

// ================= ระบบสมองกล (Algorithm) =================
function generateMatches() {
    if (players.length < 4) return alert('ต้องมีผู้เล่นอย่างน้อย 4 คนครับ');
    
    history.pushState(null, '', window.location.pathname);
    
    document.getElementById('viewModeSection').classList.add('hidden');
    document.getElementById('setupSection').classList.remove('hidden');
    
    const totalGamesInput = parseInt(document.getElementById('totalGames').value);
    const initialPreventBeginner = document.getElementById('preventBeginner').checked;
    let enableScoreTable = document.getElementById('enableScoreTable').checked;
    
    if (totalGamesInput > 20 || players.length > 10) {
        enableScoreTable = false;
        document.getElementById('enableScoreTable').checked = false; 
    }
    
    const mainLayout = document.getElementById('mainLayout');
    mainLayout.classList.remove('items-center');
    mainLayout.classList.add('lg:flex-row', 'items-start');
    
    const leftColumn = document.getElementById('leftColumn');
    leftColumn.classList.remove('max-w-2xl');
    leftColumn.classList.add('lg:w-[400px]', 'xl:w-[450px]', 'lg:sticky', 'lg:top-6', 'lg:max-h-[calc(100vh-3rem)]', 'lg:overflow-y-auto', 'custom-scrollbar', 'pr-2', 'pb-4');

    const totalBeginners = players.filter(p => p.isBeginner).length;
    let isPreventBeginnerActive = initialPreventBeginner;
    if (totalBeginners > (players.length / 2)) isPreventBeginnerActive = false;

    players.forEach(p => {
        p.gamesPlayed = 0; p.homeGames = 0; p.awayGames = 0;
        p.consecutiveGames = 0; p.consecutiveRests = 0; p.firstRestAt = Infinity;
    });

    matches = []; 
    let prevTeams = [];
    let partnerHistory = {};
    let matchHistory = {}; 
    let restSequence = [];

    for (let i = 1; i <= totalGamesInput; i++) {
        let sittingOut = [];
        let playing4 = [];
        const k = players.length - 4;

        if (players.length === 5) {
            if (i === 1) restSequence = [...players].sort(() => Math.random() - 0.5);
            sittingOut = [restSequence[(i - 1) % 5]];
            playing4 = players.filter(p => !sittingOut.includes(p));
        } else if (players.length > 5) {
            const combos = getCombinations(players, k);
            const maxRestAllowed = (players.length >= 8) ? 2 : 1;
            let validCombos = combos.filter(S => !S.some(p => p.consecutiveRests >= maxRestAllowed));
            
            let safeLimit = maxRestAllowed;
            while (validCombos.length === 0 && safeLimit < players.length) {
                safeLimit++;
                validCombos = combos.filter(S => !S.some(p => p.consecutiveRests >= safeLimit));
            }

            if (totalBeginners > 0) {
                let strictCombos = validCombos.filter(S => {
                    const begCount = S.filter(p => p.isBeginner).length;
                    return begCount === 0 || begCount === Math.min(k, totalBeginners);
                });
                if (strictCombos.length > 0) validCombos = strictCombos;
            }

            validCombos.sort(() => Math.random() - 0.5);
            validCombos.sort((a, b) => {
                const gA = a.reduce((s, p) => s + p.gamesPlayed, 0);
                const gB = b.reduce((s, p) => s + p.gamesPlayed, 0);
                if (gA !== gB) return gB - gA;
                if (i > 1) {
                    const begA = a.filter(p => p.isBeginner).length;
                    const begB = b.filter(p => p.isBeginner).length;
                    if (begA !== begB) return begB - begA;
                }
                return 0;
            });

            sittingOut = validCombos[0];
            playing4 = players.filter(p => !sittingOut.includes(p));
        } else {
            playing4 = [...players];
        }

        sittingOut.forEach(p => { if (p.firstRestAt === Infinity) p.firstRestAt = i; });

        playing4.sort(() => Math.random() - 0.5);
        let possiblePairs = [
            [[playing4[0], playing4[1]], [playing4[2], playing4[3]]],
            [[playing4[0], playing4[2]], [playing4[1], playing4[3]]],
            [[playing4[0], playing4[3]], [playing4[1], playing4[2]]]
        ];

        if (isPreventBeginnerActive) {
            let filtered = possiblePairs.filter(c => 
                c[0].filter(p => p.isBeginner).length < 2 && c[1].filter(p => p.isBeginner).length < 2
            );
            if (filtered.length > 0) possiblePairs = filtered;
        }

        let nonConsec = possiblePairs.filter(c => !prevTeams.includes(getTeamKey(c[0][0], c[0][1])) && !prevTeams.includes(getTeamKey(c[1][0], c[1][1])));
        let combosToEval = nonConsec.length > 0 ? nonConsec : possiblePairs;

        combosToEval.forEach(c => {
            const h1 = partnerHistory[getTeamKey(c[0][0], c[0][1])] || 0;
            const h2 = partnerHistory[getTeamKey(c[1][0], c[1][1])] || 0;
            c.maxH = Math.max(h1, h2); 
            c.sumH = h1 + h2;
        });
        
        combosToEval.sort((a, b) => {
            if (a.maxH !== b.maxH) return a.maxH - b.maxH;
            if (a.sumH !== b.sumH) return a.sumH - b.sumH;
            return Math.random() - 0.5;
        });
        
        let finalC = combosToEval[0];
        let tA = finalC[0], tB = finalC[1];
        let tAKey = getTeamKey(tA[0], tA[1]), tBKey = getTeamKey(tB[0], tB[1]);

        let home, away;
        let matchKey = [tAKey, tBKey].sort().join('VS');
        
        if (matchHistory[matchKey]) {
            if (matchHistory[matchKey] === tAKey) { home = tB; away = tA; } 
            else { home = tA; away = tB; }
        } else {
            const hA = tA[0].homeGames + tA[1].homeGames;
            const hB = tB[0].homeGames + tB[1].homeGames;
            if (hA < hB) { home = tA; away = tB; } 
            else if (hB < hA) { home = tB; away = tA; } 
            else { 
                home = Math.random() > 0.5 ? tA : tB; 
                away = (home === tA) ? tB : tA; 
            }
        }
        matchHistory[matchKey] = getTeamKey(home[0], home[1]);

        home.forEach(p => { p.gamesPlayed++; p.homeGames++; p.consecutiveGames++; p.consecutiveRests = 0; });
        away.forEach(p => { p.gamesPlayed++; p.awayGames++; p.consecutiveGames++; p.consecutiveRests = 0; });
        sittingOut.forEach(p => { p.consecutiveGames = 0; p.consecutiveRests++; });
        
        partnerHistory[getTeamKey(home[0], home[1])] = (partnerHistory[getTeamKey(home[0], home[1])] || 0) + 1;
        partnerHistory[getTeamKey(away[0], away[1])] = (partnerHistory[getTeamKey(away[0], away[1])] || 0) + 1;
        prevTeams = [getTeamKey(home[0], home[1]), getTeamKey(away[0], away[1])];

        matches.push({ gameNum: i, homeTeam: home, awayTeam: away, sittingOut });
    }

    renderHTMLSummary(matches, enableScoreTable);
    
    document.fonts.ready.then(() => {
        drawMatchListCanvas(matches);
        if(enableScoreTable) {
            drawCanvasTable(matches);
        }
    });

    if(window.innerWidth < 1024) {
        setTimeout(() => {
            document.getElementById('rightColumn').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

// ================= อัปเดตหน้าตา UI =================
function renderHTMLSummary(matches, enableScoreTable) {
    document.getElementById('statsSection').classList.remove('hidden');
    document.getElementById('matchListSection').classList.remove('hidden');
    document.getElementById('rightColumn').classList.remove('hidden');

    const matchListSection = document.getElementById('matchListSection');
    const canvasSection = document.getElementById('canvasSection');
    
    if (!enableScoreTable) {
        canvasSection.classList.add('hidden');
        document.getElementById('matchListAnchorRight').appendChild(matchListSection);
    } else {
        canvasSection.classList.remove('hidden');
        document.getElementById('matchListAnchorLeft').appendChild(matchListSection);
    }

    document.getElementById('matches').innerHTML = matches.map(m => `
        <div class="border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm bg-gray-50 dark:bg-gray-800/80 border-l-4 border-l-green-500 hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
            <div class="font-bold text-gray-700 dark:text-gray-200 mb-2 font-prompt text-sm">Game ${m.gameNum}</div>
            <div class="flex justify-between items-center bg-white dark:bg-gray-700 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm">
                <div class="flex-1 text-center font-medium text-sm">
                    <div class="text-[10px] text-blue-600 dark:text-blue-400 mb-0.5 font-prompt tracking-wide">🏠 เหย้า</div>
                    <span class="text-gray-800 dark:text-gray-100">${m.homeTeam[0].name} <span class="text-gray-400 dark:text-gray-500 font-normal">&</span> ${m.homeTeam[1].name}</span>
                </div>
                <div class="px-2 sm:px-4 text-gray-300 dark:text-gray-500 font-black text-xs sm:text-sm italic">VS</div>
                <div class="flex-1 text-center font-medium text-sm">
                    <div class="text-[10px] text-orange-600 dark:text-orange-400 mb-0.5 font-prompt tracking-wide">🚀 เยือน</div>
                    <span class="text-gray-800 dark:text-gray-100">${m.awayTeam[0].name} <span class="text-gray-400 dark:text-gray-500 font-normal">&</span> ${m.awayTeam[1].name}</span>
                </div>
            </div>
            ${m.sittingOut.length > 0 ? `
            <div class="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 px-2 py-1.5 rounded border border-gray-100 dark:border-gray-600 inline-block shadow-sm">
                <span class="font-bold">🛋️ รอพัก:</span> ${m.sittingOut.map(p => p.name).join(', ')}
            </div>` : ''}
        </div>
    `).join('');
    
    const sortedForStats = [...players].sort((a,b) => a.name.localeCompare(b.name));
    document.getElementById('stats').innerHTML = sortedForStats.map(p => `
        <li class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col gap-1.5 shadow-sm">
            <div class="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">${p.name}</div>
            <div class="text-xs text-gray-600 dark:text-gray-300 flex justify-between font-medium">
                <span>ลง: <b class="text-green-600 dark:text-green-400 text-sm">${p.gamesPlayed}</b></span>
                <span class="text-blue-600 dark:text-blue-400">🏠 ${p.homeGames}</span>
                <span class="text-orange-600 dark:text-orange-400">🚀 ${p.awayGames}</span>
            </div>
        </li>
    `).join('');
}

// ================= วาดรูป A4 =================
function drawMatchListCanvas(matches) {
    const canvas = document.getElementById('matchListCanvas');
    const ctx = canvas.getContext('2d');
    
    const baseWidth = 1240, baseHeight = 1754, scale = 2;
    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.fillStyle = '#059669'; 
    ctx.font = 'bold 48px Prompt';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📋 ลำดับการแข่งขัน Pickleball', baseWidth / 2, 100);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Prompt';
    ctx.fillText(`จำนวนทั้งหมด ${matches.length} เกม`, baseWidth / 2, 160);

    const margin = 60;
    let cols = 1;
    if (matches.length > 10 && matches.length <= 24) cols = 2;
    else if (matches.length > 24) cols = 3;

    const gapX = 40;
    let gapY = 30;
    const cardW = (baseWidth - (margin * 2) - (gapX * (cols - 1))) / cols;
    const rows = Math.ceil(matches.length / cols);
    
    let cardH = 120; 
    const startY = 220;
    const availableH = baseHeight - startY - margin;
    const totalHNeeded = (rows * cardH) + ((rows - 1) * gapY);
    
    if (totalHNeeded > availableH) {
        const shrinkRatio = availableH / totalHNeeded;
        cardH *= shrinkRatio;
        gapY *= shrinkRatio;
    }

    function drawRoundedRect(x, y, w, h, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    matches.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = margin + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#f9fafb';
        drawRoundedRect(x, y, cardW, cardH, 16);
        ctx.fill();
        
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x + 10, y + cardH);
        ctx.lineTo(x + 16, y + cardH);
        ctx.quadraticCurveTo(x, y + cardH, x, y + cardH - 16);
        ctx.lineTo(x, y + 16);
        ctx.quadraticCurveTo(x, y, x + 16, y);
        ctx.fill();

        const scaleF = cardH < 100 ? cardH / 100 : 1;

        ctx.fillStyle = '#374151';
        ctx.font = `bold ${22 * scaleF}px Prompt`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Game ${m.gameNum}`, x + 30, y + (20 * scaleF));

        const teamY = y + cardH/2 + (10 * scaleF); 

        ctx.fillStyle = '#9ca3af';
        ctx.font = `900 ${18 * scaleF}px Prompt`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VS', x + cardW/2, teamY);

        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${28 * scaleF}px "Google Sans", Prompt`; 
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m.homeTeam[0].name} & ${m.homeTeam[1].name}`, x + cardW/2 - 25, teamY);

        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${28 * scaleF}px "Google Sans", Prompt`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m.awayTeam[0].name} & ${m.awayTeam[1].name}`, x + cardW/2 + 25, teamY);
    });
    
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, baseWidth - 20, baseHeight - 20);
}

function drawCanvasTable(matches) {
    const canvas = document.getElementById('scoreCanvas');
    const ctx = canvas.getContext('2d');
    
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.firstRestAt !== b.firstRestAt) return a.firstRestAt - b.firstRestAt;
        return a.name.localeCompare(b.name);
    });

    const baseWidth = 1240, baseHeight = 1754, scale = 2;
    canvas.width = baseWidth * scale; canvas.height = baseHeight * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, baseWidth, baseHeight);

    const margin = 40, titleH = 120, headH = 80, sumH = 80, gap = 40;
    const rowH = (baseHeight - (margin * 2) - titleH - headH - sumH - gap) / matches.length;
    const cT1 = 200, cVS = 60, cT2 = 200, cB = 80, cDiv = 20;
    const leftW = cT1 + cVS + cT2 + cB;
    const pColW = (baseWidth - (margin * 2) - leftW - cDiv) / sortedPlayers.length;

    function drawCell(x, y, w, h, bg, border, textLines, font, color) {
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
        if (textLines && textLines.length > 0) {
            ctx.fillStyle = color || '#000000'; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
            const sizeMatch = font.match(/(\d+)px/);
            const fontSize = sizeMatch ? parseInt(sizeMatch[1]) : 20;
            const lineHeight = fontSize * 1.35; 
            const totalHeight = lineHeight * textLines.length;
            let startY = y + (h / 2) - (totalHeight / 2) + (lineHeight / 2);
            startY += (fontSize * 0.1); 
            textLines.forEach(line => { ctx.fillText(line, x + w / 2, startY); startY += lineHeight; });
        }
    }

    let curY = margin;
    drawCell(margin, curY, baseWidth - (margin * 2), titleH, '#ffffff', null, ['ตารางแข่ง Pickleball'], 'bold 48px Prompt', '#059669');
    curY += titleH;

    let curX = margin;
    drawCell(curX, curY, leftW, headH, '#000000', '#000000', ['แมตช์การแข่งขัน'], 'bold 26px Prompt', '#ffffff');
    curX += leftW + cDiv;
    
    sortedPlayers.forEach(p => {
        let pFontSize = 26;
        if (pColW < 45) pFontSize = 16;
        else if (pColW < 65) pFontSize = 20;
        else if (pColW < 85) pFontSize = 24;
        drawCell(curX, curY, pColW, headH, '#000000', '#000000', [p.name], `bold ${pFontSize}px "Google Sans", Prompt`, '#ffffff');
        curX += pColW;
    });
    curY += headH;

    matches.forEach(m => {
        curX = margin;
        drawCell(curX, curY, cT1, rowH, '#ffffff', '#000000', [m.homeTeam[0].name, m.homeTeam[1].name], 'bold 26px "Google Sans", Prompt', '#1f2937');
        curX += cT1;
        drawCell(curX, curY, cVS, rowH, '#ffffff', '#000000', ['VS'], '900 20px Prompt', '#000000');
        curX += cVS;
        drawCell(curX, curY, cT2, rowH, '#ffffff', '#000000', [m.awayTeam[0].name, m.awayTeam[1].name], 'bold 26px "Google Sans", Prompt', '#1f2937');
        curX += cT2;
        drawCell(curX, curY, cB, rowH, '#f9fafb', '#000000', [], '', '');
        curX += cB + cDiv;
        
        sortedPlayers.forEach(p => {
            const isOut = m.sittingOut.some(outPlayer => outPlayer.name === p.name);
            const bg = isOut ? '#000000' : '#ffffff';
            drawCell(curX, curY, pColW, rowH, bg, '#000000', [], '', '');
            curX += pColW;
        });
        curY += rowH;
    });

    curY += gap;
    curX = margin + leftW;
    drawCell(margin, curY, leftW, sumH, '#000000', '#000000', ['คะแนนรวม'], 'bold 26px Prompt', '#ffffff');
    curX += cDiv;
    sortedPlayers.forEach(p => { drawCell(curX, curY, pColW, sumH, '#ffffff', '#000000', [], '', ''); curX += pColW; });
    
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, baseWidth - 20, baseHeight - 20);
}

// ================= ฟังก์ชันปุ่ม Save & Share =================

function saveScoreTableImage() {
    const link = document.createElement('a');
    link.download = 'pickleball-scoretable.png';
    link.href = document.getElementById('scoreCanvas').toDataURL('image/png');
    link.click();
}

function saveScoreTablePDF() {
    const canvas = document.getElementById('scoreCanvas');
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
    pdf.save('pickleball-scoretable.pdf');
}

function saveMatchListImage() {
    const link = document.createElement('a');
    link.download = 'pickleball-matchschedule.png';
    link.href = document.getElementById('matchListCanvas').toDataURL('image/png');
    link.click();
}

function saveMatchListPDF() {
    const canvas = document.getElementById('matchListCanvas');
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
    pdf.save('pickleball-matchschedule.pdf');
}

// ระบบสร้างและคัดลอกลิงก์แชร์ด้วย URL-Safe Base64 (แก้ปัญหาแอป LINE ตัดลิงก์)
function copyShareLink() {
    if (matches.length === 0) return alert('กรุณากดเริ่มจัดตารางแข่งขันก่อนแชร์ลิงก์ครับ 🚀');
    
    const pNames = players.map(p => p.name);
    const pBegins = players.map(p => p.isBeginner ? 1 : 0);
    const enableScoreTablePref = document.getElementById('enableScoreTable').checked ? 1 : 0;

    const mShrink = matches.map(m => [
        m.gameNum,
        m.homeTeam.map(p => pNames.indexOf(p.name)),
        m.awayTeam.map(p => pNames.indexOf(p.name)),
        m.sittingOut.map(p => pNames.indexOf(p.name))
    ]);

    const shareData = { n: pNames, b: pBegins, m: mShrink, s: enableScoreTablePref };
    const jsonStr = JSON.stringify(shareData);
    
    // แปลงให้เป็น Base64 แบบธรรมดาก่อน
    let base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
    
    // เปลี่ยน Base64 ธรรมดา ให้เป็น URL-Safe Base64 (ไม่มี + / = มากวนใจแอปแชท)
    let safeBase64 = base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const shareUrl = window.location.origin + window.location.pathname + '?m=' + safeBase64;

    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('🎉 คัดลอกลิงก์สำเร็จ!');
    }).catch(err => {
        prompt('เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ กรุณาก๊อปปี้ลิงก์ในช่องด้านล่างนี้ครับ:', shareUrl);
    });
}

// ================= ระบบอ่านข้อมูลตอนเปิดเว็บ (เมื่อรับลิงก์มา) =================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let mParam = urlParams.get('m');
    
    if (mParam) {
        try {
            // แปลง URL-Safe Base64 กลับมาเป็น Base64 ปกติ
            let base64 = mParam.replace(/-/g, '+').replace(/_/g, '/');
            // เติมเครื่องหมาย = กลับเข้าไปให้ครบ Format ถ้าจำเป็น
            while (base64.length % 4) {
                base64 += '=';
            }
            
            // ถอดรหัสกลับมาเป็น Object
            const decoded = JSON.parse(decodeURIComponent(escape(atob(base64))));
            
            players = decoded.n.map((name, idx) => ({
                name: name,
                isBeginner: decoded.b[idx] === 1,
                gamesPlayed: 0, homeGames: 0, awayGames: 0,
                consecutiveGames: 0, consecutiveRests: 0, firstRestAt: Infinity
            }));

            matches = decoded.m.map(ms => {
                const homeTeam = ms[1].map(idx => players[idx]);
                const awayTeam = ms[2].map(idx => players[idx]);
                const sittingOut = ms[3].map(idx => players[idx]);
                
                homeTeam.forEach(p => { p.gamesPlayed++; p.homeGames++; });
                awayTeam.forEach(p => { p.gamesPlayed++; p.awayGames++; });
                sittingOut.forEach(p => { if (p.firstRestAt === Infinity) p.firstRestAt = ms[0]; });

                return { gameNum: ms[0], homeTeam, awayTeam, sittingOut };
            });

            updatePlayerList();
            
            let enableScoreTable = (decoded.s !== undefined) ? (decoded.s === 1) : true;
            
            if (matches.length > 20 || players.length > 10) {
                enableScoreTable = false;
            }
            
            const mainLayout = document.getElementById('mainLayout');
            mainLayout.classList.remove('items-center');
            mainLayout.classList.add('lg:flex-row', 'items-start');
            
            const leftColumn = document.getElementById('leftColumn');
            leftColumn.classList.remove('max-w-2xl');
            leftColumn.classList.add('lg:w-[400px]', 'xl:w-[450px]', 'lg:sticky', 'lg:top-6', 'lg:max-h-[calc(100vh-3rem)]', 'lg:overflow-y-auto', 'custom-scrollbar', 'pr-2', 'pb-4');

            renderHTMLSummary(matches, enableScoreTable);
            
            // เปิดการทำงานโหมด View
            document.getElementById('setupSection').classList.add('hidden');
            document.getElementById('viewModeSection').classList.remove('hidden');
            
            document.fonts.ready.then(() => {
                drawMatchListCanvas(matches);
                if(enableScoreTable) drawCanvasTable(matches);
            });

            if(window.innerWidth < 1024) {
                setTimeout(() => {
                    document.getElementById('rightColumn').scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }

        } catch (e) {
            console.error('Data decoding error:', e);
            alert('ลิงก์แชร์ไม่ถูกต้อง ข้อมูลอาจสูญหายหรือถูกเปลี่ยนแปลงครับ ⚠️');
            window.location.href = window.location.pathname;
        }
    }
});
