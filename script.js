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

// ================= ตัวแปรหลัก & ตัวแปรถ่ายทอดสด =================
let players = [];
let matches = []; 

let currentRole = 'NONE'; 
let currentCompressedData = '';
let currentRoomId = '';

let peer = null;
let connections = [];

// ================= ระบบจัดการผู้เล่น =================
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
    currentRole = 'INITIAL';
    
    currentRoomId = 'pkb-' + Math.random().toString(36).substr(2, 6);
    
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

        matches.push({ gameNum: i, homeTeam: home, awayTeam: away, sittingOut, homeScore: 0, awayScore: 0, isFinished: false });
    }

    const pNames = players.map(p => p.name);
    const pBegins = players.map(p => p.isBeginner ? 1 : 0);
    const mShrink = matches.map(m => [
        m.gameNum, m.homeTeam.map(p => pNames.indexOf(p.name)),
        m.awayTeam.map(p => pNames.indexOf(p.name)), m.sittingOut.map(p => pNames.indexOf(p.name))
    ]);
    const shareData = [pNames, pBegins, mShrink, enableScoreTable ? 1 : 0];
    currentCompressedData = LZString.compressToEncodedURIComponent(JSON.stringify(shareData));

    renderHTMLSummary(matches, enableScoreTable);
    
    document.fonts.ready.then(() => {
        drawMatchListCanvas(matches);
        if(enableScoreTable) drawCanvasTable(matches);
    });

    if(window.innerWidth < 1024) {
        setTimeout(() => { document.getElementById('rightColumn').scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
}

// ================= ระบบควบคุมคะแนน & เปิด-ปิดตารางสด =================
function saveScoresToLocal() {
    const scores = matches.map(m => ({ h: m.homeScore, a: m.awayScore, f: m.isFinished }));
    localStorage.setItem('pkb_score_' + currentRoomId, JSON.stringify(scores));
}

function setScore(index, team, val) {
    if (currentRole !== 'ADMIN') return;
    const m = matches[index];
    if (m.isFinished) return;
    
    let newScore = parseInt(val, 10);
    if (isNaN(newScore) || newScore < 0) newScore = 0;
    
    if (team === 'home') m.homeScore = newScore;
    if (team === 'away') m.awayScore = newScore;
    
    saveScoresToLocal();
    renderHTMLSummary(matches, document.getElementById('enableScoreTable').checked);
    drawMatchListCanvas(matches); // อัปเดตรูปตารางแข่งทันที
    if(document.getElementById('enableScoreTable').checked) drawCanvasTable(matches);
    broadcastSync(); 
}

function updateScore(index, team, delta) {
    if (currentRole !== 'ADMIN') return;
    const m = matches[index];
    if (m.isFinished) return;
    
    if (team === 'home') m.homeScore = Math.max(0, m.homeScore + delta);
    if (team === 'away') m.awayScore = Math.max(0, m.awayScore + delta);
    
    saveScoresToLocal();
    renderHTMLSummary(matches, document.getElementById('enableScoreTable').checked);
    drawMatchListCanvas(matches); // อัปเดตรูปตารางแข่งทันที
    if(document.getElementById('enableScoreTable').checked) drawCanvasTable(matches);
    broadcastSync(); 
}

function toggleFinish(index) {
    if (currentRole !== 'ADMIN') return;
    matches[index].isFinished = !matches[index].isFinished;
    
    saveScoresToLocal();
    renderHTMLSummary(matches, document.getElementById('enableScoreTable').checked);
    drawMatchListCanvas(matches); // อัปเดตรูปตารางแข่งทันที
    if(document.getElementById('enableScoreTable').checked) drawCanvasTable(matches);
    broadcastSync();
}

function toggleScoreTable() {
    if (matches.length > 20 || players.length > 10) {
        alert('ไม่สามารถเปิดตารางคะแนนได้ เนื่องจากมีผู้เล่นเกิน 10 คน หรือจำนวนเกมเกิน 20 แมตช์ครับ ⚠️');
        return;
    }
    
    const checkbox = document.getElementById('enableScoreTable');
    checkbox.checked = !checkbox.checked;
    
    const pNames = players.map(p => p.name);
    const pBegins = players.map(p => p.isBeginner ? 1 : 0);
    const mShrink = matches.map(m => [
        m.gameNum, m.homeTeam.map(p => pNames.indexOf(p.name)),
        m.awayTeam.map(p => pNames.indexOf(p.name)), m.sittingOut.map(p => pNames.indexOf(p.name))
    ]);
    const shareData = [pNames, pBegins, mShrink, checkbox.checked ? 1 : 0];
    currentCompressedData = LZString.compressToEncodedURIComponent(JSON.stringify(shareData));
    
    renderHTMLSummary(matches, checkbox.checked);
    drawMatchListCanvas(matches); // อัปเดตรูปตารางแข่งด้วย
    
    if(checkbox.checked) {
        setTimeout(() => { drawCanvasTable(matches); }, 50);
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

    const mlBtns = document.getElementById('matchListButtons');
    const cvBtns = document.getElementById('canvasButtons');
    
    mlBtns.className = "flex flex-wrap gap-2 w-full mt-4 border-t border-gray-100 dark:border-gray-700 pt-4";
    cvBtns.className = "flex flex-wrap gap-2 w-full mt-4 border-t border-gray-100 dark:border-gray-700 pt-4";

    const btnClass = "flex-1 min-w-[110px] py-2.5 px-2 rounded-xl text-xs sm:text-sm font-medium shadow-sm transition flex justify-center items-center gap-1.5 whitespace-nowrap active:scale-95";

    const toggleBtnText = enableScoreTable ? '👁️‍🗨️ ซ่อนตาราง' : '📊 เปิดตาราง';
    const toggleBtn = `<button onclick="toggleScoreTable()" class="${btnClass} bg-teal-600 hover:bg-teal-700 text-white">${toggleBtnText}</button>`;
    const imgBtn = `<button onclick="saveMatchListImage()" class="${btnClass} bg-indigo-500 hover:bg-indigo-600 text-white">🖼️ บันทึกรูป</button>`;
    const pdfBtn = `<button onclick="saveMatchListPDF()" class="${btnClass} bg-red-500 hover:bg-red-600 text-white">📄 บันทึก PDF</button>`;

    if (currentRole === 'INITIAL') {
        mlBtns.innerHTML = `
            <button onclick="goToAdminMode()" class="${btnClass} bg-blue-600 hover:bg-blue-700 text-white">👑 โหมดกรรมการ</button>
            <button onclick="copyShareLink('viewer')" class="${btnClass} bg-purple-600 hover:bg-purple-700 text-white">🔗 ลิงก์ผู้ชม</button>
            ${toggleBtn}
            ${imgBtn}
            ${pdfBtn}
        `;
    } else if (currentRole === 'ADMIN') {
        mlBtns.innerHTML = `
            <button onclick="copyShareLink('admin')" class="${btnClass} bg-yellow-600 hover:bg-yellow-700 text-white">👑 ลิงก์กรรมการ</button>
            <button onclick="copyShareLink('viewer')" class="${btnClass} bg-purple-600 hover:bg-purple-700 text-white">🔗 ลิงก์ผู้ชม</button>
            ${toggleBtn}
            ${imgBtn}
            ${pdfBtn}
        `;
    } else {
        mlBtns.innerHTML = `
            ${toggleBtn}
            ${imgBtn}
            ${pdfBtn}
        `;
    }

    cvBtns.innerHTML = `
        <button onclick="copyShareLink('viewer')" class="${btnClass} bg-purple-600 hover:bg-purple-700 text-white">🔗 ลิงก์ผู้ชม</button>
        <button onclick="saveScoreTableImage()" class="${btnClass} bg-blue-600 hover:bg-blue-700 text-white">🖼️ บันทึกรูป</button>
        <button onclick="saveScoreTablePDF()" class="${btnClass} bg-red-500 hover:bg-red-600 text-white">📄 บันทึก PDF</button>
        <button onclick="window.print()" class="${btnClass} bg-gray-700 hover:bg-gray-800 text-white">🖨️ พิมพ์</button>
    `;

    let playerStats = players.map(p => ({...p, wins: 0}));
    let isAnyFinished = matches.some(m => m.isFinished);
    let isAllFinished = matches.length > 0 && matches.every(m => m.isFinished);
    
    matches.forEach(m => {
        if (m.isFinished) {
            if (m.homeScore > m.awayScore) m.homeTeam.forEach(p => playerStats.find(ps => ps.name === p.name).wins++);
            else if (m.awayScore > m.homeScore) m.awayTeam.forEach(p => playerStats.find(ps => ps.name === p.name).wins++);
        }
    });
    let maxWins = Math.max(...playerStats.map(p => p.wins));

    document.getElementById('matches').innerHTML = matches.map((m, index) => {
        let scoreUI = '';
        if (currentRole === 'ADMIN') {
            scoreUI = `
                <div class="flex justify-between items-center mt-3 bg-white dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-600 shadow-inner">
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button onclick="updateScore(${index}, 'home', -1)" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold hover:bg-red-200 dark:hover:bg-red-800 transition active:scale-90 flex justify-center items-center">-</button>
                        <input type="tel" value="${m.homeScore || 0}" onchange="setScore(${index}, 'home', this.value)" class="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 w-10 sm:w-12 text-center font-prompt bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none py-1 shadow-inner transition-colors" ${m.isFinished ? 'disabled' : ''}>
                        <button onclick="updateScore(${index}, 'home', 1)" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold hover:bg-green-200 dark:hover:bg-green-800 transition active:scale-90 flex justify-center items-center">+</button>
                    </div>
                    <button onclick="toggleFinish(${index})" class="px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 ${m.isFinished ? 'bg-gray-400 dark:bg-gray-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}">
                        ${m.isFinished ? '🏁 จบแล้ว' : 'ปิดแมตช์'}
                    </button>
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button onclick="updateScore(${index}, 'away', -1)" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold hover:bg-red-200 dark:hover:bg-red-800 transition active:scale-90 flex justify-center items-center">-</button>
                        <input type="tel" value="${m.awayScore || 0}" onchange="setScore(${index}, 'away', this.value)" class="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400 w-10 sm:w-12 text-center font-prompt bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none py-1 shadow-inner transition-colors" ${m.isFinished ? 'disabled' : ''}>
                        <button onclick="updateScore(${index}, 'away', 1)" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold hover:bg-green-200 dark:hover:bg-green-800 transition active:scale-90 flex justify-center items-center">+</button>
                    </div>
                </div>
            `;
        } else if (currentRole === 'VIEWER') {
            scoreUI = `
                <div class="flex justify-between items-center mt-3 bg-white dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 shadow-inner ${m.isFinished ? 'opacity-60' : ''}">
                    <span class="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 w-10 text-center">${m.homeScore || 0}</span>
                    <span class="text-[10px] sm:text-xs font-bold text-gray-500 ${m.isFinished ? 'bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full' : ''}">${m.isFinished ? '🏁 แข่งจบแล้ว' : '🔴 กำลังถ่ายทอดสด'}</span>
                    <span class="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400 w-10 text-center">${m.awayScore || 0}</span>
                </div>
            `;
        }

        return `
            <div class="border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm bg-gray-50 dark:bg-gray-800/80 border-l-4 ${m.isFinished ? 'border-l-gray-400 bg-gray-100 dark:bg-gray-800' : 'border-l-green-500 hover:bg-green-50 dark:hover:bg-gray-700'} transition-colors relative">
                <div class="font-bold text-gray-700 dark:text-gray-200 mb-2 font-prompt text-sm">Game ${m.gameNum}</div>
                <div class="flex justify-between items-center bg-white dark:bg-gray-700 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm ${m.isFinished ? 'opacity-75' : ''}">
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
                ${scoreUI}
                ${m.sittingOut.length > 0 ? `<div class="mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"><span class="font-bold">🛋️ รอพัก:</span> ${m.sittingOut.map(p => p.name).join(', ')}</div>` : ''}
            </div>
        `;
    }).join('');
    
    const sortedForStats = [...playerStats].sort((a,b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        return a.name.localeCompare(b.name);
    });

    document.getElementById('stats').innerHTML = sortedForStats.map(p => {
        let kingBadge = (isAnyFinished && p.wins === maxWins && p.wins > 0) ? `<span class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full border border-yellow-300 shadow-sm ml-2 font-bold whitespace-nowrap">${isAllFinished ? '👑 King' : '🔥 ผู้นำ'}</span>` : '';
        return `
        <li class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col gap-1.5 shadow-sm">
            <div class="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base flex items-center justify-between">
                <span class="truncate">${p.name}</span> ${kingBadge}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-300 flex justify-between font-medium">
                <span>ชนะ: <b class="text-green-600 dark:text-green-400 text-sm">${p.wins}</b> เกม</span>
                <span>เล่น: ${p.gamesPlayed} เกม</span>
            </div>
        </li>
    `}).join('');
}

// ================= วาดรูป A4 ลำดับการแข่งขัน (อัปเดตแบบโชว์คะแนน) =================
function drawMatchListCanvas(matches) {
    const canvas = document.getElementById('matchListCanvas');
    const ctx = canvas.getContext('2d');
    const baseWidth = 1240, baseHeight = 1754, scale = 2;
    canvas.width = baseWidth * scale; canvas.height = baseHeight * scale; ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, baseWidth, baseHeight);
    
    ctx.fillStyle = '#059669'; ctx.font = 'bold 48px Prompt'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('📋 ลำดับการแข่งขัน Pickleball', baseWidth / 2, 100);
    ctx.fillStyle = '#6b7280'; ctx.font = '24px Prompt'; ctx.fillText(`จำนวนทั้งหมด ${matches.length} เกม`, baseWidth / 2, 160);
    
    const margin = 60; let cols = 1; if (matches.length > 10 && matches.length <= 24) cols = 2; else if (matches.length > 24) cols = 3;
    const gapX = 40; let gapY = 30; const cardW = (baseWidth - (margin * 2) - (gapX * (cols - 1))) / cols; const rows = Math.ceil(matches.length / cols);
    let cardH = 120; const startY = 220; const availableH = baseHeight - startY - margin; const totalHNeeded = (rows * cardH) + ((rows - 1) * gapY);
    if (totalHNeeded > availableH) { const shrinkRatio = availableH / totalHNeeded; cardH *= shrinkRatio; gapY *= shrinkRatio; }
    
    function drawRoundedRect(x, y, w, h, radius) { ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath(); }
    
    matches.forEach((m, i) => { 
        const col = i % cols; const row = Math.floor(i / cols); const x = margin + col * (cardW + gapX); const y = startY + row * (cardH + gapY); 
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; 
        ctx.fillStyle = m.isFinished ? '#f3f4f6' : '#f9fafb'; // สีเทาอ่อนถ้าจบแล้ว
        drawRoundedRect(x, y, cardW, cardH, 16); ctx.fill(); 
        
        ctx.shadowColor = 'transparent'; ctx.strokeStyle = m.isFinished ? '#d1d5db' : '#e5e7eb'; ctx.lineWidth = 2; ctx.stroke(); 
        
        // แถบสีด้านซ้ายเปลี่ยนเป็นเทาถ้าจบแล้ว
        ctx.fillStyle = m.isFinished ? '#9ca3af' : '#10b981'; 
        ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + 10, y + cardH); ctx.lineTo(x + 16, y + cardH); ctx.quadraticCurveTo(x, y + cardH, x, y + cardH - 16); ctx.lineTo(x, y + 16); ctx.quadraticCurveTo(x, y, x + 16, y); ctx.fill(); 
        
        const scaleF = cardH < 100 ? cardH / 100 : 1; 
        
        ctx.fillStyle = m.isFinished ? '#6b7280' : '#374151'; 
        ctx.font = `bold ${22 * scaleF}px Prompt`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; 
        ctx.fillText(`Game ${m.gameNum}${m.isFinished ? ' (จบแล้ว)' : ''}`, x + 30, y + (20 * scaleF)); 
        
        const teamY = y + cardH/2 + (10 * scaleF); 
        
        // ตรงกลาง: สลับแสดงเป็นคะแนนถ้ามีการกดคะแนน หรือแสดง VS ถ้ายังเป็น 0
        let hasScore = m.isFinished || m.homeScore > 0 || m.awayScore > 0;
        let centerText = hasScore ? `${m.homeScore} - ${m.awayScore}` : 'VS';
        let centerColor = m.isFinished ? '#dc2626' : (hasScore ? '#ea580c' : '#9ca3af');
        let centerFont = hasScore ? `900 ${28 * scaleF}px Prompt` : `900 ${18 * scaleF}px Prompt`;
        let nameOffset = hasScore ? 55 * scaleF : 25 * scaleF;

        ctx.fillStyle = centerColor; ctx.font = centerFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText(centerText, x + cardW/2, teamY); 
        
        // ทีมเหย้า
        ctx.fillStyle = m.isFinished ? '#4b5563' : '#1f2937'; 
        ctx.font = `bold ${28 * scaleF}px "Google Sans", Prompt`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; 
        ctx.fillText(`${m.homeTeam[0].name} & ${m.homeTeam[1].name}`, x + cardW/2 - nameOffset, teamY); 
        
        // ทีมเยือน
        ctx.textAlign = 'left'; 
        ctx.fillText(`${m.awayTeam[0].name} & ${m.awayTeam[1].name}`, x + cardW/2 + nameOffset, teamY); 
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

    const margin = 40, titleH = 120, headH = 80, sumH = 100, gap = 40;
    const rowH = (baseHeight - (margin * 2) - titleH - headH - sumH - gap) / matches.length;
    
    const cT1 = 180, cVS = 50, cT2 = 180, cScore = 120, cDiv = 20;
    const leftW = cT1 + cVS + cT2 + cScore;
    const pColW = (baseWidth - (margin * 2) - leftW - cDiv) / sortedPlayers.length;

    function drawCell(x, y, w, h, bg, border, textLines, font, color) {
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
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
    drawCell(margin, curY, baseWidth - (margin * 2), titleH, '#ffffff', null, ['🏆 ตารางสรุปผลคะแนน Pickleball'], 'bold 48px Prompt', '#059669');
    curY += titleH;

    let curX = margin;
    drawCell(curX, curY, leftW, headH, '#111827', '#000000', ['ตารางแข่ง'], 'bold 26px Prompt', '#ffffff');
    curX += leftW + cDiv;
    
    sortedPlayers.forEach(p => {
        let pFontSize = 26;
        if (pColW < 45) pFontSize = 16;
        else if (pColW < 65) pFontSize = 20;
        else if (pColW < 85) pFontSize = 24;
        drawCell(curX, curY, pColW, headH, '#111827', '#000000', [p.name], `bold ${pFontSize}px "Google Sans", Prompt`, '#ffffff');
        curX += pColW;
    });
    curY += headH;

    let playerWins = {};
    sortedPlayers.forEach(p => playerWins[p.name] = 0);
    let isAllFinished = matches.length > 0 && matches.every(m => m.isFinished);

    matches.forEach(m => {
        let winners = [];
        if (m.isFinished) {
            if (m.homeScore > m.awayScore) winners = m.homeTeam.map(p => p.name);
            else if (m.awayScore > m.homeScore) winners = m.awayTeam.map(p => p.name);
            winners.forEach(w => playerWins[w]++);
        }

        curX = margin;
        
        let homeLines = [m.homeTeam[0].name, m.homeTeam[1].name];
        let awayLines = [m.awayTeam[0].name, m.awayTeam[1].name];
        let scoreText = m.isFinished ? `${m.homeScore}-${m.awayScore}` : '-';
        
        drawCell(curX, curY, cT1, rowH, '#ffffff', '#000000', homeLines, 'bold 22px "Google Sans", Prompt', '#1f2937');
        curX += cT1;
        drawCell(curX, curY, cVS, rowH, '#ffffff', '#000000', ['VS'], '900 18px Prompt', '#6b7280');
        curX += cVS;
        drawCell(curX, curY, cT2, rowH, '#ffffff', '#000000', awayLines, 'bold 22px "Google Sans", Prompt', '#1f2937');
        curX += cT2;
        
        let scoreBg = m.isFinished ? '#4b5563' : '#f9fafb';
        let scoreColor = m.isFinished ? '#ffffff' : '#9ca3af';
        drawCell(curX, curY, cScore, rowH, scoreBg, '#000000', [scoreText], 'bold 30px "Google Sans", Prompt', scoreColor);
        curX += cScore + cDiv;
        
        sortedPlayers.forEach(p => {
            const isOut = m.sittingOut.some(outPlayer => outPlayer.name === p.name);
            const isWinner = winners.includes(p.name);
            const bg = isOut ? '#111827' : '#ffffff';
            let text = [];
            let color = '';
            if (isWinner) { text = ['1']; color = '#ef4444'; }
            drawCell(curX, curY, pColW, rowH, bg, '#000000', text, 'bold 36px "Google Sans", Prompt', color);
            curX += pColW;
        });
        curY += rowH;
    });

    curY += gap;
    curX = margin + leftW;
    drawCell(margin, curY, leftW, sumH, '#000000', '#000000', ['รวมคะแนน'], 'bold 28px Prompt', '#ffffff');
    curX += cDiv;
    
    let maxWins = Math.max(...Object.values(playerWins));

    sortedPlayers.forEach(p => {
        let wins = playerWins[p.name];
        let isKing = isAllFinished && wins === maxWins && wins > 0;
        let bg = isKing ? '#eab308' : '#4b5563';
        let textColor = '#ffffff';
        let text = wins.toString();
        
        drawCell(curX, curY, pColW, sumH, bg, '#000000', [], '', '');
        
        if (isKing) {
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px "Google Sans", Prompt'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
            ctx.fillText('👑', curX + pColW/2, curY + sumH/2 - 15);
            ctx.fillText(text, curX + pColW/2, curY + sumH/2 + 15);
        } else {
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px "Google Sans", Prompt'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
            ctx.fillText(text, curX + pColW/2, curY + sumH/2);
        }
        curX += pColW;
    });
    
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, baseWidth - 20, baseHeight - 20);
}

function saveScoreTableImage() { const link = document.createElement('a'); link.download = 'pickleball-scoretable.png'; link.href = document.getElementById('scoreCanvas').toDataURL('image/png'); link.click(); }
function saveScoreTablePDF() { const canvas = document.getElementById('scoreCanvas'); const imgData = canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4'); pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight()); pdf.save('pickleball-scoretable.pdf'); }
function saveMatchListImage() { const link = document.createElement('a'); link.download = 'pickleball-matchschedule.png'; link.href = document.getElementById('matchListCanvas').toDataURL('image/png'); link.click(); }
function saveMatchListPDF() { const canvas = document.getElementById('matchListCanvas'); const imgData = canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4'); pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight()); pdf.save('pickleball-matchschedule.pdf'); }

function goToAdminMode() {
    let url = window.location.origin + window.location.pathname + '?m=' + currentCompressedData + '&admin=' + currentRoomId;
    window.location.href = url;
}

function copyShareLink(type) {
    let shareUrl = window.location.origin + window.location.pathname + '?m=' + currentCompressedData;
    if (type === 'admin') {
        shareUrl += '&admin=' + currentRoomId;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('👑 คัดลอก "ลิงก์กรรมการ" สำเร็จ!');
        }).catch(err => prompt('คัดลอกไม่ได้ กรุณาก๊อปปี้ลิงก์นี้:', shareUrl));
    } else if (type === 'viewer') {
        shareUrl += '&live=' + currentRoomId;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('🔗 คัดลอก "ลิงก์ผู้ชม" สำเร็จ!');
        }).catch(err => prompt('คัดลอกไม่ได้ กรุณาก๊อปปี้ลิงก์นี้:', shareUrl));
    }
}

// ================= ระบบถ่ายทอดสด (Peer-to-Peer / WebRTC) =================
function startLiveBroadcast() {
    if (peer) peer.destroy(); 
    peer = new Peer(currentRoomId); 
    
    peer.on('open', (id) => {
        const banner = document.getElementById('liveStatusBanner');
        banner.classList.remove('hidden');
        banner.className = "text-sm font-bold text-center p-3 rounded-lg mb-4 font-prompt shadow-sm transition-all bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
        banner.innerHTML = `📡 ถ่ายทอดสดพร้อมทำงาน (รอเพื่อนเข้าดู...)`;
    });

    peer.on('connection', (conn) => {
        connections.push(conn);
        updateLiveBannerHost();
        conn.on('open', () => { conn.send({ type: 'SYNC', matches: matches }); });
        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
            updateLiveBannerHost();
        });
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert('เกิดข้อผิดพลาด: มีกรรมการคนอื่นกำลังใช้ห้องนี้อยู่ครับ');
        }
    });
}

function updateLiveBannerHost() {
    const banner = document.getElementById('liveStatusBanner');
    banner.innerHTML = `📡 ถ่ายทอดสดคะแนน (มีผู้ชมอยู่ <b>${connections.length}</b> คน)`;
}

function broadcastSync() {
    connections.forEach(conn => {
        if (conn.open) conn.send({ type: 'SYNC', matches: matches });
    });
}

window.addEventListener('beforeunload', function (e) {
    if (currentRole === 'ADMIN' && connections.length > 0) {
        e.preventDefault(); e.returnValue = ''; 
    }
});

// ================= โหลดข้อมูลเมื่อเปิดเว็บ =================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let mParam = urlParams.get('m');
    let adminId = urlParams.get('admin');
    let liveId = urlParams.get('live');
    
    if (mParam) {
        try {
            currentCompressedData = mParam;
            const decompressed = LZString.decompressFromEncodedURIComponent(mParam);
            if (!decompressed) throw new Error("ข้อมูลเสียหาย ถอดรหัสไม่ได้");

            const decoded = JSON.parse(decompressed);
            const pNames = decoded[0]; const pBegins = decoded[1]; const mShrink = decoded[2]; const sPref = decoded[3];

            players = pNames.map((name, idx) => ({
                name: name, isBeginner: pBegins[idx] === 1, gamesPlayed: 0, homeGames: 0, awayGames: 0,
                consecutiveGames: 0, consecutiveRests: 0, firstRestAt: Infinity
            }));

            matches = mShrink.map(ms => {
                const homeTeam = ms[1].map(idx => players[idx]);
                const awayTeam = ms[2].map(idx => players[idx]);
                const sittingOut = ms[3].map(idx => players[idx]);
                
                homeTeam.forEach(p => { p.gamesPlayed++; p.homeGames++; });
                awayTeam.forEach(p => { p.gamesPlayed++; p.awayGames++; });
                sittingOut.forEach(p => { if (p.firstRestAt === Infinity) p.firstRestAt = ms[0]; });

                return { gameNum: ms[0], homeTeam, awayTeam, sittingOut, homeScore: 0, awayScore: 0, isFinished: false };
            });

            updatePlayerList();
            
            let enableScoreTable = (sPref === 1);
            if (matches.length > 20 || players.length > 10) enableScoreTable = false;
            document.getElementById('enableScoreTable').checked = enableScoreTable;
            
            const mainLayout = document.getElementById('mainLayout');
            mainLayout.classList.remove('items-center');
            mainLayout.classList.add('lg:flex-row', 'items-start');
            
            const leftColumn = document.getElementById('leftColumn');
            leftColumn.classList.remove('max-w-2xl');
            leftColumn.classList.add('lg:w-[400px]', 'xl:w-[450px]', 'lg:sticky', 'lg:top-6', 'lg:max-h-[calc(100vh-3rem)]', 'lg:overflow-y-auto', 'custom-scrollbar', 'pr-2', 'pb-4');

            document.getElementById('setupSection').classList.add('hidden');
            document.getElementById('viewModeSection').classList.remove('hidden');

            if (adminId) {
                currentRole = 'ADMIN';
                currentRoomId = adminId;
                document.getElementById('viewModeTitle').innerHTML = "👑 โหมดจัดการคะแนน (กรรมการ)";
                document.getElementById('viewModeDesc').innerHTML = "คุณคือกรรมการ: กรุณากดปุ่มเพิ่ม-ลดคะแนน เพื่อถ่ายทอดสดให้ทุกคนเห็น";
                
                const savedScores = localStorage.getItem('pkb_score_' + currentRoomId);
                if (savedScores) {
                    const parsed = JSON.parse(savedScores);
                    matches.forEach((m, i) => {
                        if (parsed[i]) { m.homeScore = parsed[i].h; m.awayScore = parsed[i].a; m.isFinished = parsed[i].f; }
                    });
                }
                
                startLiveBroadcast();

            } else if (liveId) {
                currentRole = 'VIEWER';
                currentRoomId = liveId;
                const banner = document.getElementById('liveStatusBanner');
                banner.classList.remove('hidden');
                banner.className = "text-sm font-bold text-center p-3 rounded-lg mb-4 font-prompt shadow-sm transition-all bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800";
                banner.innerHTML = `⏳ กำลังต่อสายหากระดานคะแนนสด...`;

                peer = new Peer();
                peer.on('open', () => {
                    const conn = peer.connect(liveId);
                    conn.on('open', () => {
                        banner.className = "text-sm font-bold text-center p-3 rounded-lg mb-4 font-prompt shadow-sm transition-all bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800";
                        banner.innerHTML = `🟢 เชื่อมต่อสดเรียบร้อย (คะแนนจะเด้งอัตโนมัติ)`;
                    });

                    conn.on('data', (data) => {
                        if (data.type === 'SYNC') {
                            data.matches.forEach((updatedMatch, i) => {
                                if (matches[i]) {
                                    matches[i].homeScore = updatedMatch.homeScore;
                                    matches[i].awayScore = updatedMatch.awayScore;
                                    matches[i].isFinished = updatedMatch.isFinished;
                                }
                            });
                            renderHTMLSummary(matches, document.getElementById('enableScoreTable').checked);
                            drawMatchListCanvas(matches); // อัปเดตรูปให้คนดูด้วย!
                            if(document.getElementById('enableScoreTable').checked) drawCanvasTable(matches);
                        }
                    });

                    conn.on('close', () => {
                        banner.className = "text-sm font-bold text-center p-3 rounded-lg mb-4 font-prompt shadow-sm transition-all bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800";
                        banner.innerHTML = `🔴 ขาดการเชื่อมต่อ (กรรมการปิดหน้าจอไปแล้ว)`;
                    });
                });
                
                peer.on('error', (err) => {
                    banner.className = "text-sm font-bold text-center p-3 rounded-lg mb-4 font-prompt shadow-sm transition-all bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600";
                    banner.innerHTML = `⚪️ ถ่ายทอดสดจบลงแล้ว (ไม่มีกรรมการอยู่ในห้อง)`;
                });
            } else {
                currentRole = 'STATIC'; 
            }

            renderHTMLSummary(matches, enableScoreTable);
            
            document.fonts.ready.then(() => {
                drawMatchListCanvas(matches);
                if(enableScoreTable) drawCanvasTable(matches);
            });

            if(window.innerWidth < 1024) {
                setTimeout(() => { document.getElementById('rightColumn').scrollIntoView({ behavior: 'smooth' }); }, 500);
            }

        } catch (e) {
            console.error('Data decoding error:', e);
            alert('ลิงก์แชร์ไม่ถูกต้อง หรือข้อมูลอาจสูญหายครับ ⚠️');
            window.location.href = window.location.pathname;
        }
    }
});