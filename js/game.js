// ==================== 全局状态 ====================
window.mode = "local";
window.host = 0;
window.conn = null;                 // 游戏连接（复用 window.peer）
window.board = [];
window.cur = window.B;
window.over = 0;
window.phase = "modeSelect";
window.cs = [];
window.co = [];
window.bombs = [];
window.extra = 0;
window.dom = { a: 0, o: null, l: 0 };
window.spinning = 0;
window.wheelResult = "";
window.selectedCannon = null;
window.sitKillSelected = [];
window.D = {
    [window.B]: { s: null, c: 0, se: 0, dr: 0, skills: {} },
    [window.W]: { s: null, c: 0, se: 0, dr: 0, skills: {} }
};
window.st = null;
window.be = null;
window.wheel = null;
window.challengeMode = false;
window.baseDifficulty = 5;
window.currentRound = 1;
window.currentDifficulty = 5;
window.activeBuffs = [];
window.retryLeft = 1;
window.unlockedDiff = 5;
window.blastRange = 1;
window.copyMax = 4;
window.shieldActive = false;
window.isInGame = false;

// ==================== 初始化 ====================
document.addEventListener("DOMContentLoaded", function() {
    window.st = $("status");
    window.be = $("board");
    window.wheel = $("wheel");
    init();
    bindMouse();
    initDifficultyGrid();
    bindAllEvents();
});

// ==================== 事件绑定 ====================
function bindAllEvents() {
    // 开始游戏
    $("btnStartGame").onclick = () => {
        $("modeModal").classList.add("show");
        $("btnStartGame").style.display = "none";
    };
    // 挑战模式
    $("btnChallengeMode").onclick = () => {
        $("modeModal").classList.remove("show");
        $("diffModal").classList.add("show");
        $("btnStartGame").style.display = "none";
    };
    $("backToMenuBtn").onclick = () => {
        $("diffModal").classList.remove("show");
        $("modeModal").classList.add("show");
    };
    $("startChallengeBtn").onclick = startChallenge;
    // 模式选择
    document.querySelectorAll(".btn.mode[data-mode]").forEach(b => {
        b.onclick = () => {
            const m = b.dataset.mode;
            window.mode = m;
            window.challengeMode = false;
            $("challengeBar").style.display = "none";
            $("btnStartGame").style.display = "none";
            if (m === "local" || m === "ai") {
                $("modeModal").classList.remove("show");
                selSkill();
            } else if (m === "create") {
                if (typeof Peer === "undefined") return alert("联机组件加载失败，请检查网络后刷新");
                if (!Account.currentUser) return alert("请先登录账号再使用联机功能");
                createRoom();
            } else {
                if (typeof Peer === "undefined") return alert("联机组件加载失败，请检查网络后刷新");
                if (!Account.currentUser) return alert("请先登录账号再使用联机功能");
                $("joinArea").style.display = "block";
            }
        };
    });
    // 技能卡片
    document.querySelectorAll(".skill-card").forEach(c => {
        c.onclick = () => {
            const s = c.dataset.skill;
            if (window.mode === "ai") {
                setPlayerSkill(window.B, s);
                const pool = window.currentDifficulty <= 2 ? ["blast"] :
                    window.currentDifficulty <= 4 ? ["blast", "thunder", "sediment"] :
                    ["blast", "sediment", "thunder", "domain"];
                setPlayerSkill(window.W, pool[Math.floor(Math.random() * pool.length)]);
                $("skillModal").classList.remove("show");
                window.phase = "normal";
                ready();
            } else if (window.mode === "online") {
                const me = window.host ? window.B : window.W;
                setPlayerSkill(me, s);
                sendGame("ss", s);
                upDesc();
                upUI();
                $("skillTip").textContent = "已选择完成，等待对方选择技能...";
                const o = window.host ? window.W : window.B;
                if (window.D[o].s) {
                    $("skillModal").classList.remove("show");
                    window.phase = "normal";
                    ready();
                }
            } else {
                if (!window.D[window.B].s) {
                    setPlayerSkill(window.B, s);
                    $("skillTip").textContent = "白方请选择技能";
                    upDesc();
                    upUI();
                } else if (!window.D[window.W].s) {
                    setPlayerSkill(window.W, s);
                    $("skillModal").classList.remove("show");
                    window.phase = "normal";
                    ready();
                }
            }
        };
    });
    // 技能按钮（爆破、复制、沉淀、引雷、领域、炮、坐杀、赌徒）
    $("btnBlast").onclick = () => {
        if (cantUse("blast")) return setStatus("当前无法使用爆破专家");
        if (window.cur === window.B && !total()) return setStatus("首回合禁止使用爆破专家");
        window.phase = "placingBlast";
        setStatus("【爆破】点击空位放置标记，1回合后爆炸");
    };
    $("btnCopy").onclick = () => {
        if (window.phase === "selectingCopySource") {
            if (window.cs.length === 0) return setStatus("请至少选择1颗棋子");
            window.phase = "selectingCopyTarget";
            const mx = Math.min(...window.cs.map(p => p.x)), my = Math.min(...window.cs.map(p => p.y));
            window.co = window.cs.map(p => ({ dx: p.x - mx, dy: p.y - my }));
            setStatus("【复制】点击空位放置棋子组");
            return;
        }
        if (cantUse("copy")) return setStatus("当前无法使用复制");
        if (total() < (window.cur === window.B ? 5 : 4)) return setStatus("开局前3手禁止使用复制");
        window.phase = "selectingCopySource";
        window.cs = []; window.co = [];
        setStatus("【复制】选择最多" + window.copyMax + "颗己方棋子");
        render();
    };
    $("btnSed").onclick = () => {
        if (cantUse("sediment")) return setStatus("当前无法使用沉淀");
        if (window.D[window.cur].se >= getSedMax(window.cur)) return setStatus(`沉淀已达上限（${getSedMax(window.cur)}层）`);
        if (window.cur === window.B && !total()) return setStatus("首回合禁止使用沉淀");
        window.D[window.cur].se++;
        if (myTurn() && window.mode !== "local") sendGame("skill", { name: "sediment" });
        setStatus(`沉淀蓄力成功，当前${window.D[window.cur].se}/${getSedMax(window.cur)}层`);
        window.st.classList.add("glow");
        setTimeout(() => window.st.classList.remove("glow"), 800);
        upUI();
        endTurn();
    };
    $("btnThunder").onclick = () => {
        if (cantUse("thunder")) return setStatus("当前无法使用引雷");
        if (total() < 5) return setStatus("棋子少于5颗，禁止使用引雷");
        if (window.shieldActive && window.cur === window.W) { window.shieldActive = false; return setStatus("敌方引雷被免疫护盾抵消"); }
        setStatus("【引雷】发动中...");
        castT();
    };
    $("btnDomain").onclick = () => {
        if (cantUse("domain")) return setStatus("当前无法使用绝对领域");
        if (total() < 4) return setStatus("开局前4手禁止使用领域");
        castD();
    };
    $("btnCannon").onclick = () => {
        if (cantUse("cannon")) return setStatus("当前无法使用天上来敌");
        if (total() < 4) return setStatus("开局前4手禁止召唤炮");
        window.phase = "placingCannon";
        setStatus("【天上来敌】点击空位放置炮（下回合可攻击）");
    };
    $("btnSitKill").onclick = () => {
        if (window.phase === "selectingSitKill") {
            if (window.sitKillSelected.length === 0) return setStatus("请至少选择1颗敌方棋子");
            execSitKill();
            return;
        }
        if (cantUse("sitKill")) return setStatus("当前无法使用坐杀");
        if (total() < 8) return setStatus("棋子不足8颗，禁止使用坐杀");
        window.phase = "selectingSitKill";
        window.sitKillSelected = [];
        setStatus("【坐杀】选择敌方棋子（最多5颗）");
        render();
    };
    $("btnRps").onclick = () => {
        if (cantUse("gambler")) return setStatus("当前无法使用赌徒");
        if (total() < (window.cur === window.B ? 2 : 1)) return setStatus("开局前2手禁止使用赌徒");
        window.wheelResult = "";
        $("wheelModal").classList.add("show");
        window.wheel.style.transform = "rotate(0deg)";
        window.spinning = 0;
        $("spinBtn").disabled = false;
    };
    $("spinBtn").onclick = () => {
        if (window.spinning) return;
        window.spinning = 1;
        $("spinBtn").disabled = true;
        window.D[window.cur].c--;
        upUI();
        const idx = Math.floor(Math.random() * 6);
        const angle = 1800 + (360 - idx * 60 - 30);
        window.wheel.style.transform = `rotate(${angle}deg)`;
        setTimeout(() => {
            const resText = WHEEL_EFFECTS[idx].fn(window.cur);
            window.wheelResult = `转盘结果：${resText}`;
            upUI();
            setTimeout(() => {
                $("wheelModal").classList.remove("show");
                window.spinning = 0;
                if (window.extra > 0) {
                    window.phase = "gamblerDrop";
                    setStatus(`${window.wheelResult}\n获得 ${window.extra} 次落子机会，点击棋盘落子`);
                    if (window.D[window.cur].s === "redSpider" || (window.mode === "ai" && window.cur === window.W)) {
                        setTimeout(() => autoPlay(window.cur), 500);
                    }
                } else {
                    endTurn();
                }
            }, 1200);
        }, 4100);
    };
    $("btnCancel").onclick = () => {
        if (window.phase === "gamblerDrop") { window.extra = 0; endTurn(); return; }
        if (window.phase === "cannonAttack") { clearAttackTargets(); window.selectedCannon = null; window.phase = "normal"; render(); updateStatusText(); return; }
        if (window.phase === "normal" || window.phase === "skillSelect") return;
        clearPrev(); clearAttackTargets();
        window.phase = "normal";
        window.selectedCannon = null;
        window.sitKillSelected = [];
        window.cs = []; window.co = [];
        render();
        setStatus(window.wheelResult || `当前回合：${window.cur === window.B ? "黑方" : "白方"}`);
    };
    $("btnBack").onclick = () => {
        if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
        $("challengeBar").style.display = "none";
        $("btnStartGame").style.display = "block";
        $("modeModal").classList.remove("show");
        $("createArea").style.display = "none";
        $("joinArea").style.display = "none";
        window.phase = "modeSelect";
        window.mode = "local";
        window.challengeMode = false;
        window.isInGame = false;
        $("bs").classList.remove("me");
        $("ws").classList.remove("me");
        init();
        setStatus("请选择游戏模式");
    };
    $("joinBtn").onclick = () => {
        const r = $("joinInput").value.trim();
        if (!r) return alert("请输入对方6位玩家ID");
        if (!/^\d{6}$/.test(r)) return alert("请输入正确的6位玩家ID");
        window.host = 0;
        window.mode = "online";
        initPeerConnection(r, false);
    };
}

// ==================== 核心游戏函数 ====================
function init() {
    window.board = Array(window.S).fill().map(() => Array(window.S).fill(window.EMP));
    window.be.innerHTML = "";
    for (let y = 0; y < window.S; y++) {
        for (let x = 0; x < window.S; x++) {
            const c = document.createElement("div");
            c.className = "cell";
            c.onclick = () => click(x, y);
            window.be.appendChild(c);
        }
    }
    window.bombs = [];
    window.over = 0;
    window.cur = window.B;
    window.extra = 0;
    window.dom = { a: 0, o: null, l: 0 };
    window.cs = [];
    window.co = [];
    window.wheelResult = "";
    window.selectedCannon = null;
    window.sitKillSelected = [];
    window.D[window.B] = { s: null, c: 0, se: 0, dr: 0, skills: {} };
    window.D[window.W] = { s: null, c: 0, se: 0, dr: 0, skills: {} };
    document.querySelectorAll(".btn.skill").forEach(b => b.style.display = "none");
    window.be.classList.remove("domain");
    window.isInGame = false;
    render();
    upUI();
}

function selSkill() {
    $("btnStartGame").style.display = "none";
    window.phase = "skillSelect";
    $("skillModal").classList.add("show");
    if (window.challengeMode) {
        $("skillTip").textContent = `第 ${window.currentRound}/3 局 · 难度 ${window.currentDifficulty}\n请选择你的技能`;
    } else if (window.mode === "online") {
        const me = window.host ? window.B : window.W;
        $("bs").classList.toggle("me", me === window.B);
        $("ws").classList.toggle("me", me === window.W);
        $("skillTip").textContent = `请选择你的技能（${me === window.B ? "黑方" : "白方"}）`;
    } else {
        $("skillTip").textContent = "黑方请选择技能";
    }
}

function ready() {
    window.isInGame = true;
    upDesc();
    if (window.challengeMode && window.currentRound > 1 && window.activeBuffs.includes("extraDrop")) window.extra += 1;
    updateStatusText();
    refBtn();
    upUI();
    if (window.D[window.cur].s === "redSpider") setTimeout(() => autoPlay(window.cur), 800);
    else if (window.mode === "ai" && window.cur === window.W) setTimeout(() => autoPlay(window.W), 800);
}

function startChallenge() {
    window.challengeMode = true;
    window.currentRound = 1;
    window.currentDifficulty = window.baseDifficulty;
    window.activeBuffs = [];
    window.retryLeft = 1;
    window.blastRange = 1;
    window.copyMax = 4;
    window.shieldActive = false;
    $("diffModal").classList.remove("show");
    $("challengeBar").style.display = "flex";
    updateChallengeBar();
    window.mode = "ai";
    selSkill();
}

function updateChallengeBar() {
    $("diffText").textContent = window.currentDifficulty;
    for (let i = 1; i <= 3; i++) {
        const dot = $("dot" + i);
        dot.className = "dot";
        if (i < window.currentRound) dot.classList.add("done");
        else if (i === window.currentRound) dot.classList.add("active");
    }
    const list = $("buffList");
    list.innerHTML = "";
    window.activeBuffs.forEach(id => {
        const r = REWARD_POOL.find(x => x.id === id);
        const tag = document.createElement("div");
        tag.className = "buff-tag";
        tag.textContent = r.name;
        list.appendChild(tag);
    });
}

function setPlayerSkill(p, s) {
    window.D[p].s = s;
    window.D[p].c = getMaxCount(p, s);
    if (s === "redSpider") window.D[p].skills = { blast: 3, thunder: 2, sediment: true };
}

function upDesc() {
    ["bd", "wd"].forEach((id, i) => {
        const p = i ? window.W : window.B;
        const s = window.D[p].s;
        if (!s) { $(id).textContent = "未选择技能"; return; }
        const k = CFG[s];
        $(id).innerHTML = `${k.n}：${k.d}<br>限制：${k.l}`;
    });
}

function refBtn() {
    document.querySelectorAll(".btn.skill").forEach(b => b.style.display = "none");
    let p = window.cur;
    if (window.mode === "online") {
        const me = window.host ? window.B : window.W;
        if (window.cur !== me) return;
        p = me;
    } else if (window.mode === "ai" && window.cur === window.W) return;
    if (window.D[p].s === "redSpider") return;
    if (window.dom.a && window.dom.o !== p) { setStatus("处于敌方领域内，技能已被封禁"); return; }
    const s = window.D[p].s;
    if (s && BTN[s]) $(BTN[s]).style.display = "block";
}

function cantUse(n) {
    if (window.challengeMode && window.cur === window.B && window.currentDifficulty >= 8 && total() < 2) return true;
    return window.D[window.cur].s !== n || window.over || window.phase !== "normal" || window.D[window.cur].c <= 0;
}

function click(x, y) {
    if (window.over || window.phase === "skillSelect" || window.phase === "modeSelect") return;
    if (window.mode === "online" && !myTurn()) return;
    if (window.D[window.cur].s === "redSpider") { setStatus("红蜘蛛正在接管，无法手动操作"); return; }
    if (window.mode === "ai" && window.cur === window.W) return;

    // 炮选择
    if (window.D[window.cur].s === "cannon") {
        const v = window.board[y][x];
        if (isOwn(v, window.cur) && (v === window.B_CANNON || v === window.W_CANNON)) {
            if (window.dom.a && window.dom.o !== window.cur) return setStatus("敌方领域内，炮无法攻击");
            const targets = getAttackTargets(x, y, window.cur);
            if (targets.length === 0) { setStatus("该炮没有可攻击的目标（需隔1子打敌方棋子）"); return; }
            clearAttackTargets();
            window.selectedCannon = { x, y };
            window.phase = "cannonAttack";
            showAttackTargets(x, y, window.cur);
            setStatus("已选中炮，点击红色目标发动攻击，点空白取消");
            return;
        }
    }
    if (window.phase === "cannonAttack") {
        if (isEnemy(window.board[y][x], window.cur) && canAttack(window.selectedCannon.x, window.selectedCannon.y, x, y, window.cur)) {
            cannonAttack(window.selectedCannon.x, window.selectedCannon.y, x, y);
            return;
        }
        clearAttackTargets();
        window.selectedCannon = null;
        window.phase = "normal";
        render();
        updateStatusText();
        return;
    }

    switch (window.phase) {
        case "normal": drop(x, y); break;
        case "placingBlast": placeB(x, y, 1); break;
        case "placingCannon": placeCannon(x, y); break;
        case "selectingSitKill": toggleSitKill(x, y); break;
        case "selectingCopySource": toggleCs(x, y); break;
        case "selectingCopyTarget": placeCopy(x, y); break;
        case "sedimentBurst": sedDrop(x, y); break;
        case "gamblerDrop": gamblerDrop(x, y); break;
    }
}

// ==================== 炮逻辑 ====================
function getAttackTargets(x0, y0, pl) {
    const targets = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    dirs.forEach(([dx, dy]) => {
        let x = x0+dx, y = y0+dy, found = false;
        while (x>=0 && x<window.S && y>=0 && y<window.S) {
            if (window.board[y][x] !== window.EMP) {
                if (!found) found = true;
                else { if (isEnemy(window.board[y][x], pl)) targets.push({x,y}); break; }
            }
            x += dx; y += dy;
        }
    });
    return targets;
}
function canAttack(x0,y0,xt,yt,pl) {
    if ((x0!==xt && y0!==yt) || (x0===xt && y0===yt)) return false;
    let count = 0;
    if (x0 === xt) { for (let y=Math.min(y0,yt)+1; y<Math.max(y0,yt); y++) if (window.board[y][x0]!==window.EMP) count++; }
    else { for (let x=Math.min(x0,xt)+1; x<Math.max(x0,xt); x++) if (window.board[y0][x]!==window.EMP) count++; }
    return count === 1;
}
function showAttackTargets(x0,y0,pl) {
    getAttackTargets(x0,y0,pl).forEach(t => window.be.children[t.y*window.S+t.x].classList.add("attack-target"));
}
function clearAttackTargets() { document.querySelectorAll(".attack-target").forEach(c => c.classList.remove("attack-target")); }
function cannonAttack(x0,y0,xt,yt) {
    const type = window.cur===window.B ? window.B_CANNON : window.W_CANNON;
    window.board[yt][xt] = window.EMP;
    window.board[y0][x0] = window.EMP;
    window.board[yt][xt] = type;
    clearAttackTargets();
    window.selectedCannon = null;
    window.phase = "normal";
    render();
    addFx([{x:xt,y:yt}], "blast", 500);
    setStatus("炮攻击成功");
    const win = checkWin(xt, yt, window.cur);
    if (myTurn() && window.mode !== "local") sendGame("skill", {name:"cannonAttack", x0, y0, xt, yt, win});
    if (win) return endGame(window.cur);
    setTimeout(endTurn, 600);
}
function placeCannon(x,y) {
    if (window.board[y][x] !== window.EMP) return setStatus("只能在空位放置炮");
    window.board[y][x] = window.cur===window.B ? window.B_CANNON : window.W_CANNON;
    window.D[window.cur].c--;
    window.phase = "normal";
    if (myTurn() && window.mode !== "local") sendGame("skill", {name:"cannon", x, y});
    setStatus("炮召唤成功，下回合可攻击");
    render(); upUI(); endTurn();
}

// ==================== 坐杀 ====================
function toggleSitKill(x,y) {
    if (!isEnemy(window.board[y][x], window.cur)) return setStatus("只能选择敌方棋子");
    const i = window.sitKillSelected.findIndex(p => p.x===x && p.y===y);
    if (i > -1) window.sitKillSelected.splice(i,1);
    else { if (window.sitKillSelected.length >= 5) return setStatus("最多选择5颗"); window.sitKillSelected.push({x,y}); }
    render();
    setStatus(`已选择 ${window.sitKillSelected.length} 颗，再次点击按钮确认`);
}
function execSitKill() {
    const my = [];
    for (let y=0; y<window.S; y++) for (let x=0; x<window.S; x++) if (isOwn(window.board[y][x], window.cur)) my.push({x,y});
    const count = Math.min(window.sitKillSelected.length, my.length);
    const targets = window.sitKillSelected.slice(0, count);
    targets.forEach(p => window.board[p.y][p.x] = window.EMP);
    for (let i=my.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [my[i],my[j]]=[my[j],my[i]]; }
    const myRemoved = my.slice(0, count);
    myRemoved.forEach(p => window.board[p.y][p.x] = window.EMP);
    window.sitKillSelected = [];
    window.phase = "normal";
    window.D[window.cur].c--;
    render();
    const allRemoved = [...targets, ...myRemoved];
    addFx(allRemoved, "blast", 500);
    setStatus(`坐杀发动，双方各移除 ${count} 颗`);
    let win = false;
    for (let y=0; y<window.S; y++) for (let x=0; x<window.S; x++) if (isOwn(window.board[y][x], window.cur) && checkWin(x,y,window.cur)) { win=true; break; }
    if (myTurn() && window.mode !== "local") sendGame("skill", {name:"sitKill", removed: allRemoved, win});
    if (win) return endGame(window.cur);
    upUI(); setTimeout(endTurn, 600);
}

// ==================== 复制 ====================
function toggleCs(x,y) {
    if (!isOwn(window.board[y][x], window.cur)) return setStatus("请选择己方棋子");
    if (window.board[y][x] === window.B_CANNON || window.board[y][x] === window.W_CANNON) return setStatus("无法复制炮");
    const i = window.cs.findIndex(p => p.x===x && p.y===y);
    if (i > -1) window.cs.splice(i,1);
    else { if (window.cs.length >= window.copyMax) return setStatus(`最多选择${window.copyMax}颗`); window.cs.push({x,y}); }
    render();
    setStatus(`已选 ${window.cs.length} 颗，再次点击按钮确认`);
}
function showPrev(x,y) {
    clearPrev();
    const ts = window.co.map(o => ({x: x+o.dx, y: y+o.dy}));
    if (!ts.every(t => t.x>=0 && t.x<window.S && t.y>=0 && t.y<window.S)) return;
    ts.forEach(t => window.be.children[t.y*window.S+t.x].classList.add("preview"));
}
function clearPrev() { document.querySelectorAll(".cell.preview").forEach(c => c.classList.remove("preview")); }
function placeCopy(x,y) {
    const ts = window.co.map(o => ({x: x+o.dx, y: y+o.dy}));
    for (const t of ts) {
        if (t.x<0||t.x>=window.S||t.y<0||t.y>=window.S) return setStatus("超出棋盘范围");
        if (window.board[t.y][t.x] !== window.EMP || window.bombs.some(m=>m.x===t.x&&m.y===t.y)) return setStatus("目标位置必须为空");
    }
    let gap = 1;
    for (const s of window.cs) for (const t of ts) if (Math.abs(s.x-t.x)<=1 && Math.abs(s.y-t.y)<=1) { gap=0; break; }
    if (!gap) return setStatus("必须与原棋子间隔1格");
    ts.forEach(t => window.board[t.y][t.x] = window.cur);
    clearPrev(); render(); addFx(ts, "copy", 500);
    let win = false;
    for (const t of ts) if (checkWin(t.x,t.y,window.cur)) { win=true; break; }
    window.D[window.cur].c--;
    window.cs = []; window.co = [];
    window.phase = "normal";
    setStatus("复制成功");
    if (myTurn() && window.mode !== "local") sendGame("skill", {name:"copy", targets: ts, win});
    if (win) return endGame(window.cur);
    upUI(); endTurn();
}

// ==================== 落子 ====================
function drop(x,y) {
    if (window.board[y][x] !== window.EMP) return;
    window.board[y][x] = window.cur;
    render();
    const win = checkWin(x, y, window.cur);
    if (win) {
        if (myTurn() && window.mode !== "local") sendGame("move", {x,y, endTurn:false, win:true, extra:window.extra, dr:window.D[window.cur].dr});
        return endGame(window.cur);
    }
    let willEndTurn = true;
    if (window.extra > 0) {
        window.extra--;
        setStatus(window.wheelResult || `额外落子剩余 ${window.extra} 次`);
        willEndTurn = false;
    } else if (window.D[window.cur].s === "sediment" && window.D[window.cur].se > 0) {
        if (window.phase !== "sedimentBurst") { window.phase = "sedimentBurst"; window.D[window.cur].dr = window.D[window.cur].se; }
        window.D[window.cur].dr--;
        setStatus(`沉淀爆发！还需放置 ${window.D[window.cur].dr} 颗`);
        window.st.classList.add("glow");
        if (window.D[window.cur].dr <= 0) {
            window.D[window.cur].se = 0;
            window.phase = "normal";
            window.st.classList.remove("glow");
            willEndTurn = true;
        } else willEndTurn = false;
        upUI();
    }
    if (myTurn() && window.mode !== "local") sendGame("move", {x,y, endTurn:willEndTurn, win:false, extra:window.extra, dr:window.D[window.cur].dr});
    if (willEndTurn) endTurn();
    else if (window.D[window.cur].s === "redSpider" || (window.mode === "ai" && window.cur === window.W)) setTimeout(()=>autoPlay(window.cur), 500);
}
function sedDrop(x,y) { drop(x,y); }
function gamblerDrop(x,y) {
    if (window.board[y][x] !== window.EMP) return;
    window.board[y][x] = window.cur;
    render();
    const win = checkWin(x, y, window.cur);
    if (win) {
        if (myTurn() && window.mode !== "local") sendGame("move", {x,y, endTurn:false, win:true, extra:window.extra, dr:window.D[window.cur].dr});
        return endGame(window.cur);
    }
    let willEndTurn = false;
    window.extra--;
    if (window.extra <= 0) willEndTurn = true;
    else setStatus(`剩余落子 ${window.extra} 次，点击棋盘继续落子`);
    if (myTurn() && window.mode !== "local") sendGame("move", {x,y, endTurn:willEndTurn, win:false, extra:window.extra, dr:window.D[window.cur].dr});
    if (willEndTurn) endTurn();
    else if (window.D[window.cur].s === "redSpider" || (window.mode === "ai" && window.cur === window.W)) setTimeout(()=>autoPlay(window.cur), 500);
}

// ==================== 爆破 ====================
function placeB(x,y,isC) {
    if (window.board[y][x] !== window.EMP) return setStatus("只能在空位放置标记");
    if (window.bombs.some(m => m.x===x && m.y===y)) return setStatus("该位置已有标记");
    window.bombs.push({x,y, o:window.cur, l:1});
    if (isC) {
        window.D[window.cur].c--;
        window.phase = "normal";
        if (myTurn() && window.mode !== "local") sendGame("skill", {name:"blast", x, y});
        setStatus("爆破标记已放置");
        render(); upUI(); endTurn();
    }
}

// ==================== 引雷 ====================
function castT() {
    const n = Math.floor(Math.random()*16)+25;
    const all=[], posSet=new Set();
    while (all.length < n) {
        const x = Math.floor(Math.random()*window.S), y = Math.floor(Math.random()*window.S);
        const k = y*window.S+x;
        if (!posSet.has(k)) { posSet.add(k); all.push({x,y}); }
    }
    const hit = [];
    all.forEach(p => {
        const c = window.board[p.y][p.x];
        if (c === window.EMP) return;
        if (!(isOwn(c, window.cur) && Math.random() < 0.4)) hit.push(p);
    });
    let win = false;
    const backup = hit.map(p => ({...p, v: window.board[p.y][p.x]}));
    hit.forEach(p => window.board[p.y][p.x] = window.EMP);
    for (let y=0; y<window.S; y++) for (let x=0; x<window.S; x++) if (isOwn(window.board[y][x], window.cur) && checkWin(x,y,window.cur)) { win=true; break; }
    backup.forEach(p => window.board[p.y][p.x] = p.v);
    if (myTurn() && window.mode !== "local") sendGame("skill", {name:"thunder", hit, all, win});
    execT(hit, all, 1, win);
}
function execT(hit, all, isC, win=false) {
    hit.forEach(p => window.board[p.y][p.x] = window.EMP);
    window.bombs = window.bombs.filter(b => !hit.some(h => h.x===b.x && h.y===b.y));
    render(); addFx(all, "thunder", 700);
    if (isC) {
        window.D[window.cur].c--;
        setStatus(`引雷完成，击毁 ${hit.length} 颗棋子`);
        upUI();
        if (win) return endGame(window.cur);
        setTimeout(endTurn, 400);
    }
}

// ==================== 领域 ====================
function castD() {
    if (window.dom.a) return setStatus("领域已开启");
    if (myTurn() && window.mode !== "local") sendGame("domain", window.cur);
    openD(window.cur, 1);
}
function openD(o, isC) {
    window.dom = {a:1, o, l:8};
    window.be.classList.add("domain");
    if (isC) {
        window.D[window.cur].c--;
        window.extra += 1;
        setStatus("领域开启！获得1次额外落子机会，请落子");
        upUI();
        if (window.D[window.cur].s === "redSpider" || (window.mode === "ai" && window.cur === window.W)) setTimeout(()=>autoPlay(window.cur), 500);
    }
}
function closeD() { window.dom.a=0; window.be.classList.remove("domain"); setStatus("领域消散"); refBtn(); }

// ==================== 辅助 ====================
function addFx(ps, fc, dur) { ps.forEach(p => { const c=window.be.children[p.y*window.S+p.x]; c.classList.add(fc); setTimeout(()=>c.classList.remove(fc), dur); }); }
function render() {
    const cells = window.be.children;
    for (let i=0; i<cells.length; i++) {
        const x = i%window.S, y = Math.floor(i/window.S);
        const c = cells[i];
        const keepFx = ["blast","thunder","copy"].filter(f => c.classList.contains(f));
        c.className = "cell " + keepFx.join(" ");
        c.textContent = "";
        const v = window.board[y][x];
        if (v === window.B) c.classList.add("black");
        else if (v === window.W) c.classList.add("white");
        else if (v === window.B_CANNON) c.classList.add("cannon-black");
        else if (v === window.W_CANNON) c.classList.add("cannon-white");
        const m = window.bombs.find(b => b.x===x && b.y===y);
        if (m) { c.classList.add("bomb"); c.textContent = m.l; }
        if (window.cs.some(p => p.x===x && p.y===y)) c.classList.add("sel");
        if (window.sitKillSelected.some(p => p.x===x && p.y===y)) c.classList.add("sel");
    }
}
function upUI() {
    $("bc").textContent = window.D[window.B].s==="redSpider" ? "自动接管" : window.D[window.B].s==="sediment" ? `${window.D[window.B].se}/${getSedMax(window.B)}层` : window.D[window.B].c;
    $("wc").textContent = window.D[window.W].s==="redSpider" ? "自动接管" : window.D[window.W].s==="sediment" ? `${window.D[window.W].se}/${getSedMax(window.W)}层` : window.D[window.W].c;
    $("bs").classList.toggle("active", window.cur===window.B);
    $("ws").classList.toggle("active", window.cur===window.W);
    const s = window.D[window.cur].s;
    if (s && BTN[s]) {
        const btn = $(BTN[s]);
        btn.disabled = s==="sediment" ? window.D[window.cur].se>=getSedMax(window.cur) || window.phase!=="normal" : window.D[window.cur].c<=0 || window.phase!=="normal";
    }
}
function setStatus(t) { window.st.textContent=t; window.st.className = window.cur===window.B ? "status-black" : "status-white"; }
function updateStatusText() {
    let txt = (window.mode==="online" && !myTurn()) ? "等待对方操作..." : `当前回合：${window.cur===window.B?"黑方":"白方"}`;
    if (window.D[window.cur].s === "redSpider") txt += "\n红蜘蛛正在接管操作...";
    setStatus(txt);
}
function endTurn() {
    window.wheelResult = "";
    if (window.dom.a && window.cur===window.dom.o) { window.dom.l--; if (window.dom.l<=0) closeD(); }
    window.bombs.forEach(m => { if (m.o!==window.cur && !(window.dom.a && m.o!==window.dom.o)) m.l--; });
    const exp = window.bombs.filter(m => m.l<=0);
    let gameOver = false;
    exp.forEach(m => {
        if (gameOver) return;
        const r=window.blastRange;
        for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) { const x=m.x+dx, y=m.y+dy; if (x>=0&&x<window.S&&y>=0&&y<window.S) window.board[y][x]=window.EMP; }
        window.board[m.y][m.x] = m.o;
        window.bombs = window.bombs.filter(b => !(b.x===m.x && b.y===m.y));
        if (checkWin(m.x,m.y,m.o)) { gameOver=true; endGame(m.o); }
    });
    render();
    exp.forEach(m => { const a=[]; const r=window.blastRange; for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) { const x=m.x+dx, y=m.y+dy; if (x>=0&&x<window.S&&y>=0&&y<window.S) a.push({x,y}); } addFx(a,"blast",700); });
    if (gameOver) return;
    window.cur = window.cur===window.B ? window.W : window.B;
    window.extra = 0;
    window.phase = "normal";
    window.selectedCannon = null;
    window.sitKillSelected = [];
    refBtn(); upUI(); updateStatusText();
    if (!window.over) {
        if (window.D[window.cur].s === "redSpider") setTimeout(()=>autoPlay(window.cur), 800);
        else if (window.mode === "ai" && window.cur === window.W) setTimeout(()=>autoPlay(window.W), 800);
    }
}

// ==================== AI ====================
function getBestMove(pl, mistakeRate=0) {
    if (Math.random() < mistakeRate) {
        const empties = [];
        for (let y=0; y<window.S; y++) for (let x=0; x<window.S; x++) if (window.board[y][x]===window.EMP) empties.push({x,y});
        if (empties.length) return empties[Math.floor(Math.random()*empties.length)];
    }
    const diff = window.challengeMode && pl===window.W ? window.currentDifficulty : 5;
    const defWeight = [0.5,0.6,0.8,1,1,1.1,1.2,1.3,1.4,1.5][diff-1] || 1;
    let best=-Infinity, ms=[];
    const enemy = pl===window.B ? window.W : window.B;
    for (let y=0; y<window.S; y++) for (let x=0; x<window.S; x++) {
        if (window.board[y][x] !== window.EMP) continue;
        const sc = ev(x,y,pl) + ev(x,y,enemy)*defWeight*0.95;
        if (sc > best) { best=sc; ms=[{x,y}]; } else if (sc === best) ms.push({x,y});
    }
    return ms.length ? ms[Math.floor(Math.random()*ms.length)] : null;
}
function autoPlay(pl) {
    if (window.over || window.cur !== pl) return;
    if (window.phase === "sedimentBurst") { const pos=getBestMove(pl); if (pos) sedDrop(pos.x,pos.y); return; }
    if (window.phase === "gamblerDrop") { const pos=getBestMove(pl); if (pos) gamblerDrop(pos.x,pos.y); return; }
    if (window.phase !== "normal") return;
    const diff = window.challengeMode && pl===window.W ? window.currentDifficulty : 5;
    const mistakeRate = [0.4,0.25,0.15,0.05,0,0,0,0,0,0][diff-1] || 0;
    const skillObj = window.D[pl].s==="redSpider" ? window.D[pl].skills : null;
    const mainSkill = window.D[pl].s;
    if (!(window.dom.a && window.dom.o!==pl) && Math.random() < [0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9][diff-1]) {
        if (mainSkill === "redSpider") {
            const skills = [];
            if (skillObj.blast > 0) skills.push("blast");
            if (skillObj.thunder > 0) skills.push("thunder");
            if (skillObj.sediment && total()>10 && window.D[pl].se<getSedMax(pl)) skills.push("sediment");
            if (skills.length && Math.random()<0.4) {
                const s = skills[Math.floor(Math.random()*skills.length)];
                if (s==="blast") {
                    const p = bestBPos(pl===window.B?window.W:window.B);
                    if (p) { window.bombs.push({x:p.x,y:p.y,o:pl,l:1}); skillObj.blast--; setStatus("红蜘蛛放置了爆破标记"); render(); setTimeout(endTurn,600); return; }
                } else if (s==="thunder") { castTFor(pl); skillObj.thunder--; return; }
                else if (s==="sediment") { window.D[pl].se++; setStatus("红蜘蛛选择沉淀蓄力"); upUI(); setTimeout(endTurn,600); return; }
            }
        } else {
            if (mainSkill==="blast" && window.D[pl].c>0) { const p=bestBPos(pl===window.B?window.W:window.B); if (p) { placeB(p.x,p.y,1); return; } }
            if (mainSkill==="thunder" && window.D[pl].c>0 && total()>12) { if (Math.random()<0.4) { castT(); return; } }
            if (mainSkill==="domain" && window.D[pl].c>0 && total()>8) { if (Math.random()<0.35) { castD(); return; } }
            if (mainSkill==="sediment" && window.D[pl].se<getSedMax(pl) && total()>10) { if (Math.random()<0.3) { window.D[pl].se++; setStatus("AI选择沉淀蓄力"); upUI(); setTimeout(endTurn,600); return; } }
            if (mainSkill==="cannon" && window.D[pl].c>0 && total()>6) {
                if (Math.random()<0.3) {
                    const empties = [];
                    for (let y=3; y<window.S-3; y++) for (let x=3; x<window.S-3; x++) if (window.board[y][x]===window.EMP) empties.push({x,y});
                    if (empties.length) { const pos=empties[Math.floor(Math.random()*empties.length)]; placeCannon(pos.x,pos.y); return; }
                }
            }
        }
    }
    const pos = getBestMove(pl, mistakeRate);
    if (pos) drop(pos.x,pos.y);
    if (window.extra>0 && window.phase==="normal" && !window.over && window.cur===pl) setTimeout(()=>autoPlay(pl), 500);
}
function castTFor(pl) {
    const n = Math.floor(Math.random()*16)+25;
    const all=[], posSet=new Set();
    while (all.length < n) {
        const x=Math.floor(Math.random()*window.S), y=Math.floor(Math.random()*window.S);
        const k=y*window.S+x;
        if (!posSet.has(k)) { posSet.add(k); all.push({x,y}); }
    }
    const hit=[];
    all.forEach(p => {
        const c=window.board[p.y][p.x];
        if (c===window.EMP) return;
        if (!(isOwn(c,pl) && Math.random()<0.4)) hit.push(p);
    });
    execT(hit, all, 0);
    setStatus("红蜘蛛发动了引雷");
    setTimeout(endTurn, 700);
}

// ==================== 游戏结束 & 闯关 ====================
function endGame(w) {
    window.isInGame = false;
    window.over = 1;
    closeD();
    clearPrev(); clearAttackTargets();
    window.wheelResult = "";
    window.sitKillSelected = [];
    setStatus(`游戏结束！${w===window.B?"黑方":"白方"}获胜！`);
    document.querySelectorAll(".btn.skill").forEach(b => b.style.display = "none");
    if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
    if (window.challengeMode) setTimeout(()=>showChallengeResult(w===window.B), 800);
}
function showChallengeResult(win) {
    const title=$("resultTitle"), info=$("resultInfo"), btns=$("resultBtns");
    btns.innerHTML = "";
    if (win) {
        if (window.currentRound < 3) { showRewardSelect(); return; }
        title.className = "result-title win";
        title.textContent = "🎉 闯关成功！";
        info.innerHTML = `恭喜通过难度 ${window.baseDifficulty} 全部三局挑战！<br>获得增益：${window.activeBuffs.length} 个`;
        if (window.baseDifficulty === window.unlockedDiff && window.unlockedDiff < 10) {
            window.unlockedDiff++;
            info.innerHTML += `<br><br>解锁难度 ${window.unlockedDiff}！`;
        }
        const btn1 = document.createElement("button"); btn1.className="btn mode"; btn1.textContent="挑战下一关"; btn1.onclick=nextDiff; btns.appendChild(btn1);
        const btn2 = document.createElement("button"); btn2.className="btn cancel"; btn2.textContent="返回主菜单"; btn2.onclick=backToMenu; btns.appendChild(btn2);
    } else {
        title.className = "result-title lose";
        title.textContent = "挑战失败";
        info.innerHTML = `第 ${window.currentRound} 局失败<br>剩余重试次数：${window.retryLeft} 次`;
        if (window.retryLeft > 0) { const btn=document.createElement("button"); btn.className="btn mode"; btn.textContent="重试本局"; btn.onclick=retryRound; btns.appendChild(btn); }
        const back=document.createElement("button"); back.className="btn cancel"; back.textContent="退出闯关"; back.onclick=backToMenu; btns.appendChild(back);
    }
    $("resultModal").classList.add("show");
}
function showRewardSelect() {
    $("resultModal").classList.remove("show");
    const grid=$("rewardGrid");
    grid.innerHTML = "";
    let pool = [...REWARD_POOL];
    if (window.D[window.B].s !== "blast") pool = pool.filter(x=>x.id!=="blastPlus");
    if (window.D[window.B].s !== "copy") pool = pool.filter(x=>x.id!=="copyPlus");
    if (window.D[window.B].s !== "sediment") pool = pool.filter(x=>x.id!=="sedPlus");
    if (window.D[window.B].s === "redSpider") pool = pool.filter(x=>["extraDrop","shield"].includes(x.id));
    for (let i=pool.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const selected = pool.slice(0,3);
    selected.forEach(r => {
        const card=document.createElement("div"); card.className="reward-card";
        card.innerHTML=`<h4>${r.name}</h4><p>${r.desc}</p>`;
        card.onclick = ()=>selectReward(r.id);
        grid.appendChild(card);
    });
    $("rewardModal").classList.add("show");
}
function selectReward(id) {
    window.activeBuffs.push(id);
    if (id==="charge") window.D[window.B].c += 1;
    if (id==="blastPlus") window.blastRange = 2;
    if (id==="copyPlus") window.copyMax = 6;
    if (id==="shield") window.shieldActive = true;
    $("rewardModal").classList.remove("show");
    window.currentRound++;
    window.currentDifficulty = Math.min(window.baseDifficulty + window.currentRound - 1, 10);
    window.retryLeft = 1;
    updateChallengeBar();
    init(); selSkill();
}
function retryRound() { window.retryLeft--; $("resultModal").classList.remove("show"); init(); selSkill(); }
function nextDiff() {
    window.baseDifficulty = Math.min(window.baseDifficulty+1, 10);
    window.currentRound = 1;
    window.currentDifficulty = window.baseDifficulty;
    window.activeBuffs = [];
    window.retryLeft = 1;
    window.blastRange = 1;
    window.copyMax = 4;
    window.shieldActive = false;
    $("resultModal").classList.remove("show");
    updateChallengeBar();
    init(); selSkill();
}
function backToMenu() {
    window.isInGame = false;
    $("resultModal").classList.remove("show");
    $("rewardModal").classList.remove("show");
    $("challengeBar").style.display = "none";
    window.challengeMode = false;
    $("btnStartGame").style.display = "block";
    $("modeModal").classList.remove("show");
    window.phase = "modeSelect";
    if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
    init();
    setStatus("请选择游戏模式");
}

// ==================== 联机功能（复用 window.peer） ====================
function createRoom() {
    window.host = 1;
    window.mode = "online";
    initPeerConnection(null, true);
}

function initPeerConnection(targetId, isHost) {
    showConnStatus("connecting", "连接中...");

    // 关闭旧游戏连接
    if (window.conn) {
        try { window.conn.close(); } catch(e) {}
        window.conn = null;
    }

    // 确保消息 peer 存在
    if (!window.peer || window.peer.destroyed) {
        window.peer = new Peer(Account.currentUser.userId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.qq.com:3478' },
                    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
                ]
            }
        });
        // 设置消息监听（忽略游戏数据）
        window.peer.on("connection", (conn) => {
            conn.on("data", (data) => {
                if (data.type === "game") return;  // 游戏数据由游戏处理
                handlePeerData(data);
            });
        });
        window.peer.on("error", (err) => console.error("消息 Peer 错误:", err));
    }

    if (isHost) {
        // 房主：等待游戏连接（使用独立的监听器，不冲突）
        window._waitingGame = true;
        const onGameConn = (conn) => {
            if (!window._waitingGame) return;
            window._waitingGame = false;
            // 接收游戏连接
            window.conn = conn;
            // 监听游戏数据
            conn.on("data", (data) => {
                if (data.type === "game") {
                    handleGameMessage(data.data);
                }
            });
            // 绑定连接关闭事件
            conn.on("close", () => {
                showConnStatus("failed", "对方已断开");
                if (!window.over) {
                    setTimeout(() => { alert("对方已断开连接"); $("btnBack").click(); }, 1000);
                }
            });
            $("modeModal").classList.remove("show");
            selSkill();
            showConnStatus("connected", "已连接");
            // 移除临时监听
            window.peer.off("connection", onGameConn);
        };
        window.peer.on("connection", onGameConn);
        setTimeout(() => {
            if (window._waitingGame) {
                window._waitingGame = false;
                showConnStatus("failed", "等待连接超时");
                window.peer.off("connection", onGameConn);
            }
        }, 15000);
    } else {
        // 客户端：主动连接
        const conn = window.peer.connect(targetId, { reliable: true });
        const timeout = setTimeout(() => {
            if (conn.open) conn.close();
            showConnStatus("failed", "连接超时");
        }, 15000);
        conn.on("open", () => {
            clearTimeout(timeout);
            window.conn = conn;
            // 监听游戏数据
            conn.on("data", (data) => {
                if (data.type === "game") {
                    handleGameMessage(data.data);
                }
            });
            conn.on("close", () => {
                showConnStatus("failed", "对方已断开");
                if (!window.over) {
                    setTimeout(() => { alert("对方已断开连接"); $("btnBack").click(); }, 1000);
                }
            });
            $("modeModal").classList.remove("show");
            selSkill();
            showConnStatus("connected", "已连接");
        });
        conn.on("error", (err) => {
            clearTimeout(timeout);
            showConnStatus("failed", "连接失败");
            console.error(err);
        });
    }
}

function sendGame(type, payload) {
    if (!window.conn || !window.conn.open) return;
    window.conn.send({ type: "game", data: { type, payload } });
}

function handleGameMessage(d) {
    if (d.type === "move") {
        window.board[d.payload.y][d.payload.x] = window.cur;
        if (d.payload.extra !== undefined) window.extra = d.payload.extra;
        if (d.payload.dr !== undefined) window.D[window.cur].dr = d.payload.dr;
        if (!d.payload.endTurn) {
            if (window.extra > 0) {
                window.phase = "gamblerDrop";
                setStatus(`剩余额外落子 ${window.extra} 次，继续落子`);
            } else if (window.D[window.cur].se > 0 && window.D[window.cur].dr > 0) {
                window.phase = "sedimentBurst";
                setStatus(`沉淀爆发中，剩余 ${window.D[window.cur].dr} 颗`);
                window.st.classList.add("glow");
            }
        } else {
            if (window.D[window.cur].se > 0 && window.D[window.cur].dr <= 0) {
                window.D[window.cur].se = 0;
                window.phase = "normal";
                window.st.classList.remove("glow");
            }
        }
        render();
        if (d.payload.win || checkWin(d.payload.x, d.payload.y, window.cur)) {
            endGame(window.cur);
            return;
        }
        if (d.payload.endTurn) endTurn();
    } else if (d.type === "ss") {
        const o = window.host ? window.W : window.B;
        setPlayerSkill(o, d.payload);
        upDesc(); upUI();
        const me = window.host ? window.B : window.W;
        if (window.D[me].s && window.phase === "skillSelect") {
            $("skillModal").classList.remove("show");
            window.phase = "normal";
            ready();
        }
    } else if (d.type === "skill") {
        const s = d.payload;
        if (s.name === "blast") { placeB(s.x, s.y, 0); render(); upUI(); endTurn(); }
        else if (s.name === "cannon") { window.board[s.y][s.x] = window.cur===window.B ? window.B_CANNON : window.W_CANNON; render(); upUI(); endTurn(); }
        else if (s.name === "sediment") { window.D[window.cur].se++; upUI(); endTurn(); }
        else if (s.name === "thunder") { execT(s.hit, s.all, 0); upUI(); if (s.win) return endGame(window.cur); setTimeout(endTurn, 400); }
        else if (s.name === "copy") { s.targets.forEach(t => window.board[t.y][t.x] = window.cur); render(); addFx(s.targets, "copy", 500); upUI(); if (s.win) return endGame(window.cur); endTurn(); }
        else if (s.name === "sitKill") { s.removed.forEach(p => window.board[p.y][p.x] = window.EMP); window.bombs = window.bombs.filter(b => !s.removed.some(h => h.x===b.x && h.y===b.y)); render(); addFx(s.removed, "blast", 500); upUI(); if (s.win) return endGame(window.cur); setTimeout(endTurn, 600); }
        else if (s.name === "cannonAttack") {
            const type = window.cur===window.B ? window.B_CANNON : window.W_CANNON;
            window.board[s.yt][s.xt] = window.EMP;
            window.board[s.y0][s.x0] = window.EMP;
            window.board[s.yt][s.xt] = type;
            render(); addFx([{x:s.xt,y:s.yt}], "blast", 500);
            if (s.win) return endGame(window.cur);
            setTimeout(endTurn, 600);
        }
    } else if (d.type === "domain") {
        openD(d.payload, 0);
        upUI();
    }
}

function showConnStatus(type, text) {
    let el = document.getElementById("connStatus");
    if (!el) { el=document.createElement("div"); el.id="connStatus"; el.className="conn-status"; document.body.appendChild(el); }
    el.className = "conn-status " + type;
    el.textContent = text;
    if (type === "connected") setTimeout(()=>el.style.opacity="0", 2000);
    else el.style.opacity="1";
}

function myTurn() { return window.mode !== "online" || window.cur === (window.host ? window.B : window.W); }

// ==================== 统计（忽略错误） ====================
function fetchOnline() {
    fetch("https://api.countapi.xyz/hit/gomoku-skill-game/visitors")
        .then(r => r.json())
        .then(d => { const oc=document.getElementById("oc"); if (oc) oc.textContent=`累计游玩人次：${d.value} 人`; })
        .catch(()=>{});
}
fetchOnline();

// ==================== 辅助：鼠标事件 ====================
function bindMouse() {
    window.be.addEventListener("mousemove", e => {
        if (window.phase !== "selectingCopyTarget") return;
        const cell = e.target.closest(".cell");
        if (!cell) return;
        const i = Array.from(window.be.children).indexOf(cell);
        showPrev(i % window.S, Math.floor(i / window.S));
    });
    window.be.addEventListener("mouseleave", clearPrev);
}
function initDifficultyGrid() {
    const grid = $("diffGrid");
    grid.innerHTML = "";
    for (let i=1; i<=10; i++) {
        const btn=document.createElement("div");
        btn.className = "diff-btn" + (i>window.unlockedDiff ? " locked" : "");
        btn.textContent = i;
        btn.onclick = () => {
            if (i>window.unlockedDiff) { setStatus("该难度未解锁，请先通关前一难度"); return; }
            window.baseDifficulty = i;
            $("diffDesc").innerHTML = `<b>难度 ${i}</b><br>${DIFF_DESC[i-1]}<br><br>三局递进：第1局${i} → 第2局${Math.min(i+1,10)} → 第3局${Math.min(i+2,10)}`;
            document.querySelectorAll(".diff-btn").forEach(b=>b.style.borderColor="#ddd");
            btn.style.borderColor="#3498db";
            btn.style.background="#f0f8ff";
            $("startChallengeBtn").disabled = false;
            $("startChallengeBtn").style.opacity = 1;
        };
        grid.appendChild(btn);
    }
}