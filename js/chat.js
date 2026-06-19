// 聊天系统 - 复用P2P连接
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
        const key = `chat_${Account.currentUser.userId}_${targetId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    saveMsg(targetId, msg) {
        const history = this.getHistory(targetId);
        history.push(msg);
        const key = `chat_${Account.currentUser.userId}_${targetId}`;
        localStorage.setItem(key, JSON.stringify(history.slice(-100)));
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
        const msg = {
            from: Account.currentUser.userId,
            content: content.trim(),
            time: Date.now()
        };
        window.conn.send({ type: "chat", data: msg });
        this.saveMsg(this.currentTarget, msg);
        this.renderHistory();
        document.getElementById("chatInput").value = "";
    },

    sendChatMessage(targetId, content) {
        if (!window.peer) return;
        const conn = window.peer.connect(targetId, { reliable: true });
        const timeout = setTimeout(() => {
            if (conn.open) conn.close();
            alert("发送失败，对方不在线");
        }, 5000);
        conn.on("open", () => {
            clearTimeout(timeout);
            const msg = {
                from: Account.currentUser.userId,
                content: content.trim(),
                time: Date.now()
            };
            conn.send({ type: "chat", data: msg });
            this.saveMsg(targetId, msg);
            this.renderHistory();
            document.getElementById("chatInput").value = "";
            setTimeout(() => { if (conn.open) conn.close(); }, 500);
        });
        conn.on("error", () => {
            clearTimeout(timeout);
            alert("发送失败，对方不在线");
        });
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
            Account.addMessage({
                type: "system",
                content: `💬 来自 ${name} 的消息：${msg.content}`
            });
        }
    },

    escape(str) {
        return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};

// ===== 处理通过 peer 连接收到的非游戏数据 =====
function handlePeerData(data) {
    if (data.type === "friendRequest") {
        Account.addMessage({
            type: "friendRequest",
            from: data.from,
            fromName: data.fromName,
            remark: data.remark,
            time: data.time,
            reply: false
        });
        Account.updateMessageBadge();
        setStatus(`收到来自 ${data.fromName} 的好友申请`);
        if (confirm(`收到好友申请来自 ${data.fromName} (ID: ${data.from})，是否同意？`)) {
            const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: true, remark: Account.currentUser.username };
            Account.sendDataToUser(data.from, reply, () => {});
            Account._addFriendDirect(data.from, data.remark || `玩家${data.from}`);
            const msgs = Account.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === data.from && !m.reply);
            if (idx !== -1) {
                msgs[idx].reply = true;
                msgs[idx].accepted = true;
                Account.saveMessages(msgs);
            }
            Account.renderFriendList();
            Account.updateMessageBadge();
            setStatus(`已添加 ${data.fromName} 为好友`);
        } else {
            const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: false };
            Account.sendDataToUser(data.from, reply, () => {});
            const msgs = Account.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === data.from && !m.reply);
            if (idx !== -1) {
                msgs[idx].reply = true;
                msgs[idx].accepted = false;
                Account.saveMessages(msgs);
            }
            Account.updateMessageBadge();
            setStatus(`已拒绝 ${data.fromName} 的好友申请`);
        }
    }
    else if (data.type === "invite") {
        // 记录到消息中心
        Account.addMessage({
            type: "invite",
            from: data.from,
            fromName: data.fromName,
            time: data.time,
            reply: false
        });
        Account.updateMessageBadge();

        // 第一步：弹出是否接受邀请（独立弹窗）
        if (!confirm(`收到对战邀请来自 ${data.fromName} (ID: ${data.from})，是否接受？`)) {
            // 用户拒绝
            const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "用户拒绝" };
            Account.sendDataToUser(data.from, reply, () => {});
            setStatus(`已拒绝 ${data.fromName} 的对战邀请`);
            return;
        }

        // 用户选择了接受，检查是否在游戏中
        if (window.isInGame) {
            // 询问是否退出当前游戏
            if (!confirm(`您正在游戏中，接受邀请将退出当前对局，是否继续？`)) {
                // 用户取消，相当于拒绝邀请
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "用户取消（游戏中）" };
                Account.sendDataToUser(data.from, reply, () => {});
                setStatus(`已拒绝 ${data.fromName} 的对战邀请（您在游戏中）`);
                return;
            }
            // 用户确认退出当前游戏
            // 清理当前游戏
            if (window.gamePeer) {
                try { window.gamePeer.destroy(); } catch(e) {}
                window.gamePeer = null;
            }
            if (window.conn) {
                try { window.conn.close(); } catch(e) {}
                window.conn = null;
            }
            // 重置游戏状态
            window.isInGame = false;
            // 可能还需要重置棋盘等，但 init 会在新游戏开始时执行
            // 这里不调用 init，因为即将开始新对局
            setStatus("已退出当前对局，准备接受邀请...");
        }

        // 发送接受回复
        const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: true };
        Account.sendDataToUser(data.from, reply, () => {});

        // 开始新游戏连接（作为客户端）
        window.mode = "online";
        window.host = 0;
        initPeerConnection(data.from, false);
    }
    else if (data.type === "chat") {
        Chat.receive(data.data);
    }
}

// ===== DOM 事件绑定 =====
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("chatClose").onclick = () => Chat.close();
    document.getElementById("btnSendChat").onclick = () => Chat.send(document.getElementById("chatInput").value);
    document.getElementById("chatInput").onkeydown = e => {
        if (e.key === "Enter") Chat.send(e.target.value);
    };

    document.getElementById("btnMessage").onclick = () => {
        renderMessageModal();
        document.getElementById("messageModal").classList.add("show");
    };
    // 右上角叉关闭
    document.getElementById("closeMessageModal").onclick = () => {
        document.getElementById("messageModal").classList.remove("show");
    };

    // 登录相关
    document.getElementById("loginModal").classList.add("show");
    const saved = localStorage.getItem("currentUser");
    if (saved) {
        try {
            const user = JSON.parse(saved);
            document.getElementById("loginUser").value = user.username || "";
        } catch (e) {}
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

    document.getElementById("btnLogout").onclick = () => Account.logout();
});

// ===== 登录后初始化 =====
function afterLogin() {
    const isDev = Account.isDeveloper();

    document.getElementById("myUserId").textContent = Account.currentUser.userId;
    Account.renderFriendList();

    const gameContent = document.getElementById("gameContent");
    const adminPanel = document.getElementById("adminPanel");
    const startBtn = document.getElementById("btnStartGame");

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

        // 初始化消息 peer
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
            window.peer.on("connection", (conn) => {
                conn.on("data", (data) => {
                    if (data.type === "game") return;
                    handlePeerData(data);
                });
            });
            window.peer.on("error", (err) => console.error("消息 Peer 错误:", err));
        }

        Account.addMessage({
            type: "system",
            content: "🎉 欢迎使用技能五子棋 v2.0！新增消息中心、好友申请、对战邀请功能，优化联机体验。"
        });
        Account.updateMessageBadge();
    }
}

function hideAllModals() {
    ["modeModal", "skillModal", "diffModal", "resultModal", "rewardModal", "wheelModal"].forEach(id => {
        document.getElementById(id).classList.remove("show");
    });
}

// ===== 渲染消息面板（已读标记 + 删除功能） =====
function renderMessageModal() {
    const container = document.getElementById("messageList");
    const msgs = Account.getMessages();
    if (msgs.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无消息</p>';
        return;
    }
    // 标记所有消息为已读，红点消失
    msgs.forEach(msg => { msg.read = true; });
    Account.saveMessages(msgs);
    Account.updateMessageBadge();

    const sorted = [...msgs].reverse();
    let html = "";
    sorted.forEach((msg, idx) => {
        const realIdx = msgs.length - 1 - idx;
        let content = "";
        let actions = "";
        if (msg.type === "friendRequest" && !msg.reply) {
            content = `📨 好友申请来自 ${msg.fromName || msg.from}`;
            actions = `
                <button class="admin-btn edit-btn" data-action="acceptFriend" data-index="${realIdx}" style="margin-right:5px;">同意</button>
                <button class="admin-btn delete-btn" data-action="rejectFriend" data-index="${realIdx}">拒绝</button>
            `;
        } else if (msg.type === "friendRequest" && msg.reply) {
            content = `好友申请 ${msg.accepted ? '已同意' : '已拒绝'} (${msg.fromName || msg.from})`;
        } else if (msg.type === "friendRequestSent") {
            content = msg.content;
        } else if (msg.type === "invite" && !msg.reply) {
            content = `⚔️ 对战邀请来自 ${msg.fromName || msg.from}`;
            if (window.isInGame) {
                actions = `<span style="color:#e74c3c;">您正在游戏中</span>`;
            } else {
                actions = `
                    <button class="admin-btn edit-btn" data-action="acceptInvite" data-index="${realIdx}" style="margin-right:5px;">接受</button>
                    <button class="admin-btn delete-btn" data-action="rejectInvite" data-index="${realIdx}">拒绝</button>
                `;
            }
        } else if (msg.type === "invite" && msg.reply) {
            content = `对战邀请 ${msg.accepted ? '已接受' : '已拒绝'} (${msg.fromName || msg.from})`;
        } else if (msg.type === "system") {
            content = `ℹ️ ${msg.content}`;
        } else {
            content = JSON.stringify(msg);
        }
        const timeStr = new Date(msg.time).toLocaleString();
        html += `
            <div style="background:#f8f9fa;border-radius:6px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #ddd; position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:14px;">${content}</span>
                    <span style="font-size:11px;color:#999;">${timeStr}</span>
                </div>
                <div style="margin-top:6px;">
                    ${actions}
                    <button class="admin-btn delete-btn" data-action="deleteMsg" data-index="${realIdx}" style="margin-left:5px; background:#999;">删除</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    // 绑定操作事件
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
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: true, remark: Account.currentUser.username };
                Account.sendDataToUser(msg.from, reply, () => {});
                Account._addFriendDirect(msg.from, msg.remark || `玩家${msg.from}`);
                msg.reply = true;
                msg.accepted = true;
                Account.saveMessages(msgs);
                Account.renderFriendList();
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已添加 ${msg.fromName || msg.from} 为好友`);
            } else if (action === "rejectFriend") {
                const reply = { type: "friendRequestReply", from: Account.currentUser.userId, accepted: false };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true;
                msg.accepted = false;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已拒绝 ${msg.fromName || msg.from} 的好友申请`);
            } else if (action === "acceptInvite") {
                if (window.isInGame) {
                    if (!confirm("您正在游戏中，接受邀请将退出当前对局，是否继续？")) {
                        return; // 用户取消，不发送任何回复（既未接受也未拒绝）
                    }
                    // 清理当前游戏
                    if (window.gamePeer) {
                        try { window.gamePeer.destroy(); } catch(e) {}
                        window.gamePeer = null;
                    }
                    if (window.conn) {
                        try { window.conn.close(); } catch(e) {}
                        window.conn = null;
                    }
                    window.isInGame = false;
                    setStatus("已退出当前对局");
                }
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: true };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true;
                msg.accepted = true;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                window.mode = "online";
                window.host = 0;
                initPeerConnection(msg.from, false);
                document.getElementById("messageModal").classList.remove("show");
            } else if (action === "rejectInvite") {
                const reply = { type: "inviteReply", from: Account.currentUser.userId, accepted: false, reason: "用户拒绝" };
                Account.sendDataToUser(msg.from, reply, () => {});
                msg.reply = true;
                msg.accepted = false;
                Account.saveMessages(msgs);
                Account.updateMessageBadge();
                renderMessageModal();
                setStatus(`已拒绝 ${msg.fromName || msg.from} 的对战邀请`);
            }
        };
    });
}