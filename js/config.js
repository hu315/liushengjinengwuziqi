// 棋盘常量
window.S = 15;
window.EMP = 0;
window.B = 1;
window.W = 2;
window.B_CANNON = 3;
window.W_CANNON = 4;

// 技能配置
window.CFG = {
    blast: { n: "爆破专家", d: "3×3爆炸清场，中心落子", l: "首回合禁用" },
    copy: { n: "复制", d: "复制己棋到空位，需间隔1格", l: "开局前3手禁用" },
    sediment: { n: "沉淀", d: "蓄力后连续落多子", l: "首回合禁用" },
    thunder: { n: "引雷", d: "大范围落雷，己方40%免疫", l: "开局前3手禁用" },
    domain: { n: "绝对领域", d: "封敌技能8回合，+1次落子", l: "1次，持续8回合" },
    cannon: { n: "天上来敌", d: "象棋炮隔子吃子", l: "先手2次/后手3次" },
    sitKill: { n: "坐杀", d: "删敌子等量删己子", l: "双方各2次" },
    gambler: { n: "赌徒", d: "转盘抽奖，占用一回合", l: "开局前2手禁用" },
    redSpider: { n: "红蜘蛛", d: "自动下棋，自带3技能", l: "全程自动，无法手动" }
};

// 技能按钮ID映射
window.BTN = {
    blast: "btnBlast",
    copy: "btnCopy",
    sediment: "btnSed",
    thunder: "btnThunder",
    domain: "btnDomain",
    cannon: "btnCannon",
    sitKill: "btnSitKill",
    gambler: "btnRps"
};

// 奖励池
window.REWARD_POOL = [
    { id: "charge", name: "技能充能", desc: "当前技能次数+1" },
    { id: "extraDrop", name: "先手优势", desc: "下局开局额外1次落子" },
    { id: "shield", name: "免疫护盾", desc: "免疫敌方首次技能" },
    { id: "sedPlus", name: "沉淀强化", desc: "沉淀上限+1" },
    { id: "blastPlus", name: "爆破增幅", desc: "爆炸范围5×5" },
    { id: "copyPlus", name: "复制强化", desc: "可复制上限+2" }
];

// 难度描述
window.DIFF_DESC = [
    "AI仅堵五连，高失误率，不用技能",
    "AI会堵活四，低概率用简单技能",
    "AI攻守平衡，正常使用技能",
    "标准AI，低失误率，技能有逻辑",
    "零失误AI，优先防守，技能精准",
    "预判2步，进攻性增强，技能更频繁",
    "高级AI，活三活四全封堵，玩家技能-1",
    "大师级AI，攻守无破绽，玩家首回合禁技能",
    "职业级难度，全局最优解，玩家沉淀上限-1",
    "地狱级难度，无解进攻+完美防守"
];

// 转盘效果（执行时读取全局状态）
window.WHEEL_EFFECTS = [
    { name: "额外落2子", fn: p => { window.extra += 2; return "额外落2子"; } },
    { name: "扣除1次技能", fn: p => { window.D[p].c = Math.max(0, window.D[p].c - 1); return "扣除1次技能"; } },
    { name: "恢复2次技能", fn: p => { const max = window.getMaxCount(p, window.D[p].s); window.D[p].c = Math.min(max, window.D[p].c + 2); return "恢复2次技能"; } },
    { name: "本回合跳过", fn: p => { return "本回合跳过"; } },
    { name: "落子+1技能+1", fn: p => { window.extra += 1; const max = window.getMaxCount(p, window.D[p].s); window.D[p].c = Math.min(max, window.D[p].c + 1); return "落子+1技能+1"; } },
    { name: "削弱效果", fn: p => { if (window.D[p].se > 0) { window.D[p].se = 0; return "沉淀层数清零"; } window.D[p].c = Math.max(0, window.D[p].c - 1); return "扣除1次技能次数"; } }
];