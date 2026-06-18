// DOM选择器
window.$ = id => document.getElementById(id);

// 获取技能最大次数
window.getMaxCount = function(p, skill){
    let base = skill==="blast" ? (p===B?4:5) : skill==="domain" ? 1 : skill==="cannon" ? (p===B?2:3) : skill==="sitKill" ? 2 : skill==="sediment" ? Infinity : 3;
    if(window.challengeMode && p===W){ if(window.currentDifficulty>=7) base++; if(window.currentDifficulty>=9) base++; }
    if(window.challengeMode && p===B && skill!=="sediment"){
        if(window.currentDifficulty>=7) base--;
        if(window.currentDifficulty>=10) base--;
        base = Math.max(1, base);
    }
    if(p===B && window.activeBuffs.includes("charge")) base++;
    return base;
};

// 获取沉淀最大层数
window.getSedMax = function(p){
    let max = 4;
    if(window.challengeMode && p===B && window.currentDifficulty>=9) max=3;
    if(window.activeBuffs.includes("sedPlus")) max++;
    return max;
};

// 判断是否己方棋子
window.isOwn = (p, pl) => pl===B ? (p===B||p===B_CANNON) : (p===W||p===W_CANNON);

// 判断是否敌方棋子
window.isEnemy = (p, pl) => pl===B ? (p===W||p===W_CANNON) : (p===B||p===B_CANNON);

// 是否我方回合
window.myTurn = () => window.mode !== "online" || window.cur === (window.host ? B : W);

// 场上总棋子数
window.total = () => window.board.flat().filter(c => c !== EMP).length;

// 检查胜利
window.checkWin = function(x, y, p){
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for(const [dx, dy] of dirs){
        let c = 1;
        let nx = x+dx, ny = y+dy;
        while(nx>=0 && nx<S && ny>=0 && ny<S && isOwn(window.board[ny][nx], p)){ c++; nx += dx; ny += dy; }
        nx = x-dx; ny = y-dy;
        while(nx>=0 && nx<S && ny>=0 && ny<S && isOwn(window.board[ny][nx], p)){ c++; nx -= dx; ny -= dy; }
        if(c >= 5) return 1;
    }
    return 0;
};

// 位置评分
window.ev = function(x, y, p){
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    let t = 0;
    for(const [dx, dy] of dirs){
        let c = 1, bl = 0;
        let nx = x+dx, ny = y+dy;
        while(nx>=0 && nx<S && ny>=0 && ny<S){
            if(isOwn(window.board[ny][nx], p)) c++;
            else if(window.board[ny][nx] === EMP) break;
            else { bl++; break; }
            nx += dx; ny += dy;
        }
        if(nx<0||nx>=S||ny<0||ny>=S) bl++;
        nx = x-dx; ny = y-dy;
        while(nx>=0 && nx<S && ny>=0 && ny<S){
            if(isOwn(window.board[ny][nx], p)) c++;
            else if(window.board[ny][nx] === EMP) break;
            else { bl++; break; }
            nx -= dx; ny -= dy;
        }
        if(nx<0||nx>=S||ny<0||ny>=S) bl++;
        if(c >= 5) t += 100000;
        else if(c === 4 && !bl) t += 10000;
        else if(c === 4 && bl===1) t += 1000;
        else if(c === 3 && !bl) t += 1000;
        else if(c === 3 && bl===1) t += 100;
        else if(c === 2 && !bl) t += 100;
        else if(c === 2 && bl===1) t += 10;
    }
    t += (14 - Math.abs(x-7) - Math.abs(y-7)) * 2;
    return t;
};

// 找最佳爆破位置
window.bestBPos = function(enemy){
    let max = 0, best = null;
    for(let y=1; y<S-1; y++){
        for(let x=1; x<S-1; x++){
            if(window.board[y][x] !== EMP) continue;
            let c = 0;
            for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++){
                if(isOwn(window.board[y+dy][x+dx], enemy)) c++;
            }
            if(c >= 3 && c > max){ max = c; best = {x, y}; }
        }
    }
    return best;
};