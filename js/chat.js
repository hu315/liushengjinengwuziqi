const Chat = {
    currentTarget: null,
    currentTargetName: "",

    open(userId, name) {
        this.currentTarget = userId;
        this.currentTargetName = name;
        document.getElementById("chatTargetName").textContent = name;
        document.getElementById("chatWindow").style.display = "flex";
        this.renderHistory();
    },

    close() {
        document.getElementById("chatWindow").style.display = "none";
        this.currentTarget = null;
    },

    getHistory(targetId) {
        return JSON.parse(localStorage.getItem(`chat_${Account.currentUser.userId}_${targetId}`) || "[]");
    },

    saveMsg(targetId, msg) {
        const history = this.getHistory(targetId);
        history.push(msg);
        localStorage.setItem(`chat_${Account.currentUser.userId}_${targetId}`, JSON.stringify(history.slice(-100)));
    },

    renderHistory() {
        const history = this.getHistory(this.currentTarget);
        const body = document.getElementById("chatBody");
        body.innerHTML = "";
        history.forEach(msg => {
            const div = document.createElement("div");
            div.className = `chat-msg ${msg.from === Account.currentUser.userId ? 'me' : 'other'}`;
            const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            div.innerHTML = `<div class="content">${this.escape(msg.content)}</div><div class="time">${time}</div>`;
            body.appendChild(div);
        });
        body.scrollTop = body.scrollHeight;
    },

    send(content) {
        if (!content.trim()) return;
        if (!window.conn || !window.conn.open) {
            this.sendChatMessage(this.currentTarget, content);
            return;
        }
        const msg = { from: Account.currentUser.userId, fromName: Account.currentUser.username, content: content.trim(), time: Date.now() };
        window.conn.send({ type: "chat", data: msg });
        this.saveMsg(this.currentTarget, msg);
        this.renderHistory();
        document.getElementById("friendChatInput").value = "";
    },

    sendChatMessage(targetId, content) {
        if (!window.peer) return;
        const conn = window.peer.connect(targetId, { reliable: true });
        const timeout = setTimeout(() => { if (conn.open) conn.close(); alert("发送失败，对方不在线"); }, 5000);
        conn.on("open", () => {
            clearTimeout(timeout);
            const msg = { from: Account.currentUser.userId, fromName: Account.currentUser.username, content: content.trim(), time: Date.now() };
            conn.send({ type: "chat", data: msg });
            this.saveMsg(targetId, msg);
            this.renderHistory();
            document.getElementById("friendChatInput").value = "";
            setTimeout(() => { if (conn.open) conn.close(); }, 500);
        });
        conn.on("error", () => { clearTimeout(timeout); alert("发送失败，对方不在线"); });
    },

    receive(msg) {
        const fromId = msg.from;
        this.saveMsg(fromId, msg);
        if (this.currentTarget === fromId) {
            this.renderHistory();
        } else {
            const friends = Account.getFriends();
            const f = friends.find(x => x.userId === fromId);
            const name = f ? f.remark : `玩家${fromId}`;
            setStatus(`收到来自 ${name} 的消息`);
            Account.addMessage({ type: "system", content: `💬 来自 ${name} 的消息：${msg.content}` });
        }
    },

    escape(str) { return str.replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
};

function showConfirmModal(title, message, onAccept, onReject) {
    const modal = document.getElementById("confirmModal");
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    const acceptBtn = document.getElementById("confirmAccept");
    const rejectBtn = document.getElementById("confirmReject");
    const newAccept = acceptBtn.cloneNode(true);
    const newReject = rejectBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
    rejectBtn.parentNode.replaceChild(newReject, rejectBtn);
    newAccept.onclick = () => { modal.classList.remove("show"); if (onAccept) onAccept(); };
    newReject.onclick = () => { modal.classList.remove("show"); if (onReject) onReject(); };
    modal.classList.add("show");
}

function handlePeerData(data, conn) {
    // 处理状态查询
    if (data.type === "statusQuery") {
        const status = window.isInGame ? 'playing' : 'online';
        if (conn && conn.open) {
            conn.send({ type: "statusReply", status });
        }
        return;
    }
    if (data.type === "friendRequest") {
        Account.addMessage({ type: "friendRequest", from: data.from, fromName: data.fromName, remark: data.remark, time: data.time, reply: false });
        Account.updateMessageBadge();
        setStatus(`收到来自 ${data.fromName} 的好友申请`);
        // 显示好友申请通知
        if (typeof showNotification === "function") {
            showNotification("好友申请", `${data.fromName} 申请添加您为好友`, 'friend');
        }
        showConfirmModal(
            "好友申请",
            `用户 ${data.fromName} (ID: ${data.from}) 申请添加您为好友，是否同意？`,
            () => {
                Account._addFriendDirect(data.from, data.remark || `玩家${data.from}`);
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: true, remark: Account.currentUser.username };
                Account.sendDataToUser(data.from, reply, () => {});
                const msgs = Account.getMessages();
                const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === data.from && !m.reply);
                if (idx !== -1) { msgs[idx].reply = true; msgs[idx].accepted = true; Account.saveMessages(msgs); }
                Account.renderFriendList();
                Account.updateMessageBadge();
                setStatus(`已添加 ${data.fromName} 为好友`);
                alert(`已与 ${data.fromName} 成为好友`);
            },
            () => {
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: false };
                Account.sendDataToUser(data.from, reply, () => {});
                const msgs = Account.getMessages();
                const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === data.from && !m.reply);
                if (idx !== -1) { msgs[idx].reply = true; msgs[idx].accepted = false; Account.saveMessages(msgs); }
                Account.updateMessageBadge();
                setStatus(`已拒绝 ${data.fromName} 的好友申请`);
            }
        );
    }
    else if (data.type === "friendRequestReply") {
        Account.handleFriendRequestReply(data);
    }
    else if (data.type === "invite") {
        Account.addMessage({ type: "invite", from: data.from, fromName: data.fromName, time: data.time, reply: false });
        Account.updateMessageBadge();
        // 显示对战邀请通知
        if (typeof showNotification === "function") {
            showNotification("对战邀请", `${data.fromName} 邀请您进行对战`, 'chat');
        }
        if (window.isInGame) {
            const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "对方正在游戏中" };
            Account.sendDataToUser(data.from, reply, () => {});
            setStatus(`自动拒绝 ${data.fromName} 的对战邀请（您正在游戏中）`);
            return;
        }
        showConfirmModal(
            "对战邀请",
            `用户 ${data.fromName} (ID: ${data.from}) 邀请您进行对战，是否接受？`,
            () => {
                window.mode = "online";
                window.host = 0;
                window._inviteFrom = data.from;  // 保存邀请者 ID
                if (typeof initPeerConnection === "function") {
                    initPeerConnection(data.from, false, () => {
                        // 连接建立成功后再发送回复
                        if (window.conn && window.conn.open) {
                            const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: true };
                            window.conn.send({ type: "game", data: { type: "inviteReply", payload: reply } });
                        }
                    });
                }
                setStatus("正在连接...");
            },
            () => {
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "用户拒绝" };
                Account.sendDataToUser(data.from, reply, () => {});
                setStatus(`已拒绝 ${data.fromName} 的对战邀请`);
            }
        );
    }
    else if (data.type === "inviteReply") {
        Account.handleInviteReply(data);
    }
    else if (data.type === "chat") {
        Chat.receive(data.data);
        // 显示聊天消息通知（如果不在游戏中）
        const senderName = data.fromName || `玩家${data.from}`;
        if (typeof showNotification === "function" && !window.isInGame) {
            showNotification(`💬 ${senderName}`, data.data.content, 'chat');
        }
    }
}

// ===== DOM 绑定 =====
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("chatClose").onclick = () => Chat.close();
    document.getElementById("btnSendChat").onclick = () => Chat.send(document.getElementById("friendChatInput").value);
    document.getElementById("friendChatInput").onkeydown = e => { if (e.key === "Enter") Chat.send(e.target.value); };

    document.getElementById("btnMessage").onclick = () => {
        renderMessageModal();
        document.getElementById("messageModal").classList.add("show");
    };
    document.getElementById("closeMessageModal").onclick = () => {
        document.getElementById("messageModal").classList.remove("show");
    };

    document.getElementById("loginModal").classList.add("show");
    const saved = localStorage.getItem("currentUser");
    if (saved) {
        try { document.getElementById("loginUser").value = JSON.parse(saved).username || ""; } catch(e) {}
    }
    
    // 头像上传事件处理
    const avatarUpload = document.getElementById("avatarUpload");
    if (avatarUpload) {
        avatarUpload.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            if (Account && Account.uploadCustomAvatar) {
                const result = await Account.uploadCustomAvatar(file);
                if (result.ok) {
                    updateRankDisplay();
                    updateSettingsPanel();
                    // 更新头像列表的选中状态
                    if (typeof renderAvatarList === 'function') {
                        renderAvatarList();
                    }
                } else {
                    alert(result.msg);
                }
            }
            // 重置文件输入
            e.target.value = "";
        });
    }

    document.querySelectorAll(".tab").forEach(t => {
        t.onclick = () => {
            document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
            t.classList.add("active");
            const tab = t.dataset.tab;
            document.getElementById("loginTab").style.display = tab === "login" ? "block" : "none";
            document.getElementById("registerTab").style.display = tab === "register" ? "block" : "none";
            document.getElementById("loginTip").textContent = "";
        };
    });

    document.getElementById("btnLogin").onclick = () => {
        const res = Account.login(
            document.getElementById("loginUser").value.trim(),
            document.getElementById("loginPwd").value
        );
        if (res.ok) {
            document.getElementById("loginModal").classList.remove("show");
            afterLogin();
        } else {
            document.getElementById("loginTip").textContent = res.msg;
        }
    };

    document.getElementById("btnRegister").onclick = () => {
        const u = document.getElementById("regUser").value.trim();
        const p1 = document.getElementById("regPwd").value;
        const p2 = document.getElementById("regPwd2").value;
        if (p1 !== p2) return document.getElementById("loginTip").textContent = "两次密码不一致";
        const res = Account.register(u, p1);
        if (res.ok) {
            document.getElementById("loginModal").classList.remove("show");
            afterLogin();
        } else {
            document.getElementById("loginTip").textContent = res.msg;
        }
    };

    document.getElementById("btnAddFriend").onclick = () => document.getElementById("addFriendModal").classList.add("show");
    document.getElementById("cancelAddFriend").onclick = () => document.getElementById("addFriendModal").classList.remove("show");
    document.getElementById("confirmAddFriend").onclick = () => {
        const id = document.getElementById("friendIdInput").value.trim();
        const remark = document.getElementById("friendRemark").value.trim();
        const res = Account.sendFriendRequest(id, remark);
        if (res.ok) {
            document.getElementById("addFriendModal").classList.remove("show");
            document.getElementById("friendIdInput").value = "";
            document.getElementById("friendRemark").value = "";
            document.getElementById("addFriendTip").textContent = "";
        } else {
            document.getElementById("addFriendTip").textContent = res.msg;
        }
    };

    document.getElementById("btnRefreshFriends").onclick = () => {
        if (typeof Account.checkAllFriendsOnlineStatus === 'function') {
            Account.checkAllFriendsOnlineStatus();
        }
    };

    document.getElementById("btnLogout").onclick = () => Account.logout();
    
    // 移动端好友面板事件绑定
    document.getElementById("mobileFriendToggle")?.addEventListener("click", () => {
        document.getElementById("mobileFriendPanel")?.classList.add("show");
    });
    
    document.getElementById("mobileFriendClose")?.addEventListener("click", () => {
        document.getElementById("mobileFriendPanel")?.classList.remove("show");
    });
    
    document.getElementById("mobileAddFriend")?.addEventListener("click", () => {
        document.getElementById("mobileFriendPanel")?.classList.remove("show");
        document.getElementById("addFriendModal")?.classList.add("show");
    });
    
    document.getElementById("mobileFriendPanel")?.addEventListener("click", (e) => {
        if (e.target.id === "mobileFriendPanel") {
            document.getElementById("mobileFriendPanel")?.classList.remove("show");
        }
    });
    
    // 响应式UI切换
    function toggleResponsiveUI() {
        const isMobile = window.innerWidth < 768;
        
        // 移动端UI
        const mobileToggle = document.getElementById("mobileFriendToggle");
        const mobilePanel = document.getElementById("mobileFriendPanel");
        // 桌面端好友面板
        const friendPanel = document.getElementById("friendPanel");
        const sidebar = document.getElementById("sidebar");
        
        if (mobileToggle) {
            mobileToggle.style.display = isMobile ? "flex" : "none";
        }
        
        if (friendPanel) {
            friendPanel.style.display = isMobile ? "none" : "block";
        }
        
        if (sidebar) {
            sidebar.style.display = isMobile ? "none" : "flex";
        }
        
        // 如果是桌面端，确保移动端面板关闭
        if (!isMobile && mobilePanel) {
            mobilePanel.classList.remove("show");
        }
    }
    
    // 页面加载时执行一次
    toggleResponsiveUI();
    // 监听窗口大小变化
    window.addEventListener("resize", toggleResponsiveUI);
});

function updateRankDisplay() {
    if (!Account || !Account.currentUser) return;
    
    const user = Account.currentUser;
    const rank = Account.getCurrentRank();
    const avatar = Account.getCurrentAvatar ? Account.getCurrentAvatar() : Account.getAvatar(user.avatarId);
    
    // 更新玩家头像
    const playerAvatar = document.getElementById("playerAvatar");
    if (playerAvatar) {
        if (avatar.custom) {
            playerAvatar.innerHTML = `<img src="${avatar.custom}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            playerAvatar.textContent = avatar.emoji || '👤';
        }
    }
    
    // 更新玩家名称
    const playerName = document.getElementById("playerName");
    if (playerName) {
        playerName.textContent = user.username || "玩家";
    }
    
    // 更新段位徽章
    const rankBadge = document.getElementById("userRankBadge");
    if (rankBadge) {
        rankBadge.textContent = `🏆 ${rank.name}`;
        rankBadge.style.background = `linear-gradient(135deg, ${rank.color}40, ${rank.color}20)`;
        rankBadge.style.border = `1px solid ${rank.color}`;
        rankBadge.style.color = rank.color;
    }
    
    // 更新统计数据
    const wins = document.getElementById("statWins");
    const losses = document.getElementById("statLosses");
    const draws = document.getElementById("statDraws");
    
    if (wins) wins.textContent = user.wins || 0;
    if (losses) losses.textContent = user.losses || 0;
    if (draws) draws.textContent = user.draws || 0;
    
    // 显示段位面板
    const rankPanel = document.getElementById("currentUserRank");
    if (rankPanel) {
        rankPanel.style.display = "block";
    }
    
    // 更新设置面板中的用户信息
    updateSettingsPanel();
}

function updateSettingsPanel() {
    if (!Account || !Account.currentUser) return;
    
    const user = Account.currentUser;
    const rank = Account.getCurrentRank();
    const avatar = Account.getCurrentAvatar ? Account.getCurrentAvatar() : Account.getAvatar(user.avatarId);
    
    // 更新设置面板中的头像
    const currentAvatarDisplay = document.getElementById("currentAvatarDisplay");
    if (currentAvatarDisplay) {
        if (avatar.custom) {
            currentAvatarDisplay.innerHTML = `<img src="${avatar.custom}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            currentAvatarDisplay.textContent = avatar.emoji || '👤';
        }
    }
    
    // 更新设置面板中的用户名
    const settingsUserName = document.getElementById("settingsUserName");
    if (settingsUserName) {
        settingsUserName.textContent = user.username || "玩家";
    }
    
    // 更新设置面板中的段位徽章
    const settingsRankBadge = document.getElementById("settingsRankBadge");
    if (settingsRankBadge) {
        settingsRankBadge.textContent = `🏆 ${rank.name}`;
        settingsRankBadge.style.background = `linear-gradient(135deg, ${rank.color}40, ${rank.color}20)`;
        settingsRankBadge.style.border = `1px solid ${rank.color}`;
        settingsRankBadge.style.color = rank.color;
    }
}

function openSettingsPanel() {
    // 更新设置面板内容
    updateSettingsPanel();
    
    // 渲染头像列表
    if (typeof renderAvatarList === 'function') {
        renderAvatarList();
    }
    
    // 渲染主题列表
    if (typeof renderThemeList === 'function') {
        renderThemeList();
    }
    
    // 显示设置面板
    document.getElementById("settingsModal").classList.add("show");
}

function afterLogin() {
    const isDev = Account.isDeveloper();
    document.getElementById("myUserId").textContent = Account.currentUser.userId;
    Account.renderFriendList();
    const gameContent = document.getElementById("gameContent");
    const adminPanel = document.getElementById("adminPanel");
    const startBtn = document.getElementById("btnStartGame");

    // 更新段位显示
    updateRankDisplay();
    
    // 延迟检查好友在线状态（等待 peer 初始化完成）
    setTimeout(() => {
        if (typeof Account.checkAllFriendsOnlineStatus === 'function') {
            Account.checkAllFriendsOnlineStatus();
        }
        // 启动状态定时刷新
        if (typeof Account.startStatusRefresh === 'function') {
            Account.startStatusRefresh();
        }
    }, 1000);
    
    // 初始化主题
    if (typeof applyTheme === 'function' && typeof getCurrentTheme === 'function') {
        const currentTheme = getCurrentTheme();
        applyTheme(currentTheme.id);
    }
    
    // 渲染头像列表
    if (typeof renderAvatarList === 'function') {
        renderAvatarList();
    }
    
    // 渲染主题列表
    if (typeof renderThemeList === 'function') {
        renderThemeList();
    }
    
    // 绑定头像点击事件（打开设置面板）
    const playerAvatar = document.getElementById("playerAvatar");
    if (playerAvatar) {
        playerAvatar.onclick = () => {
            openSettingsPanel();
        };
    }

    if (isDev) {
        if (gameContent) gameContent.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
        if (startBtn) startBtn.style.display = "none";
        setStatus("🔧 开发者模式 — 账号管理");
        Account.renderAdminPanel();
        hideAllModals();
    } else {
        if (gameContent) gameContent.style.display = "block";
        if (adminPanel) adminPanel.style.display = "none";
        if (startBtn) startBtn.style.display = "block";
        setStatus(`欢迎回来，${Account.currentUser.username}`);
        hideAllModals();

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
            // 注意：游戏对战连接由 game.js 的 initPeerConnection 处理
            // 这里只处理聊天和好友相关的连接
            window.peer.on("connection", (conn) => {
                // 如果游戏连接已存在，关闭这个聊天连接
                if (window.conn && window.conn.open) {
                    console.log("聊天连接忽略：游戏连接已存在");
                    conn.close();
                    return;
                }
                
                conn.on("data", (data) => {
                    // 游戏数据由 game.js 处理，这里只处理非游戏数据
                    if (data.type === "game") return;
                    
                    // 如果收到的是邀请回复，但游戏连接已存在，说明是重复消息，忽略
                    if (data.type === "inviteReply" && window.conn && window.conn.open) {
                        console.log("聊天连接收到 inviteReply，但游戏连接已存在，忽略");
                        return;
                    }
                    
                    console.log("聊天连接收到数据, type:", data.type, "data:", data);
                    
                    handlePeerData(data, conn);
                });
                conn.on("close", () => {
                    console.log("消息连接关闭");
                });
            });
            window.peer.on("error", (err) => console.error("消息 Peer 错误:", err));
        }

        Account.addMessage({ type: "system", content: "🎉 欢迎使用技能五子棋 v2.0！" });
        Account.updateMessageBadge();
        
        // 更新移动端用户信息
        const mobileUserInfo = document.getElementById("mobileUserInfo");
        if (mobileUserInfo) {
            mobileUserInfo.innerHTML = `
                <span>${Account.currentUser.username} · ID: ${Account.currentUser.userId}</span>
                <button class="btn-logout" onclick="Account.logout()">退出登录</button>
            `;
        }
    }
}

function hideAllModals() {
    ["modeModal", "skillModal", "diffModal", "resultModal", "rewardModal", "wheelModal"].forEach(id => {
        document.getElementById(id).classList.remove("show");
    });
}

function renderMessageModal() {
    const container = document.getElementById("messageList");
    const msgs = Account.getMessages();
    if (msgs.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无消息</p>';
        return;
    }
    msgs.forEach(msg => msg.read = true);
    Account.saveMessages(msgs);
    Account.updateMessageBadge();

    const sorted = [...msgs].reverse();
    let html = "";
    sorted.forEach((msg, idx) => {
        const realIdx = msgs.length - 1 - idx;
        let content = "", actions = "";
        if (msg.type === "friendRequest" && !msg.reply) {
            content = `📨 好友申请来自 ${msg.fromName || msg.from}`;
            actions = `<button class="admin-btn edit-btn" data-action="acceptFriend" data-index="${realIdx}">同意</button>
                       <button class="admin-btn delete-btn" data-action="rejectFriend" data-index="${realIdx}">拒绝</button>`;
        } else if (msg.type === "friendRequest" && msg.reply) {
            content = `好友申请 ${msg.accepted ? '已同意' : '已拒绝'} (${msg.fromName || msg.from})`;
        } else if (msg.type === "friendRequestSent") {
            content = msg.content;
        } else if (msg.type === "invite" && !msg.reply) {
            content = `⚔️ 对战邀请来自 ${msg.fromName || msg.from}`;
            if (window.isInGame) actions = `<span style="color:#e74c3c;">您正在游戏中</span>`;
            else actions = `<button class="admin-btn edit-btn" data-action="acceptInvite" data-index="${realIdx}">接受</button>
                            <button class="admin-btn delete-btn" data-action="rejectInvite" data-index="${realIdx}">拒绝</button>`;
        } else if (msg.type === "invite" && msg.reply) {
            content = `对战邀请 ${msg.accepted ? '已接受' : '已拒绝'} (${msg.fromName || msg.from})`;
        } else if (msg.type === "system") {
            content = `ℹ️ ${msg.content}`;
        } else {
            content = JSON.stringify(msg);
        }
        const timeStr = new Date(msg.time).toLocaleString();
        html += `<div style="background:#f8f9fa;border-radius:6px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #ddd;">
            <div style="display:flex;justify-content:space-between;"><span>${content}</span><span style="font-size:11px;color:#999;">${timeStr}</span></div>
            <div style="margin-top:6px;">${actions}
                <button class="admin-btn delete-btn" data-action="deleteMsg" data-index="${realIdx}" style="background:#999;">删除</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll("[data-action]").forEach(btn => {
        btn.onclick = () => {
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);
            const msgs = Account.getMessages();
            const msg = msgs[index];
            if (!msg) return;
            if (action === "deleteMsg") {
                msgs.splice(index, 1);
                Account.saveMessages(msgs);
                renderMessageModal();
                return;
            }
            if (action === "acceptFriend") {
                Account._addFriendDirect(msg.from, msg.remark || `玩家${msg.from}`);
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: true, remark: Account.currentUser.username };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true; msg.accepted = true;
                Account.saveMessages(msgs);
                Account.renderFriendList();
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已添加 ${msg.fromName || msg.from} 为好友`);
            } else if (action === "rejectFriend") {
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: false };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true; msg.accepted = false;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已拒绝 ${msg.fromName || msg.from} 的好友申请`);
            } else if (action === "acceptInvite") {
                if (window.isInGame) { alert("您已在游戏中"); return; }
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: true };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true; msg.accepted = true;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
                window.mode = "online";
                window.host = 0;
                if (typeof initPeerConnection === "function") {
                    initPeerConnection(msg.from, false);
                }
                document.getElementById("messageModal").classList.remove("show");
            } else if (action === "rejectInvite") {
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "用户拒绝" };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true; msg.accepted = false;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已拒绝 ${msg.fromName || msg.from} 的对战邀请`);
            }
        };
    });
}