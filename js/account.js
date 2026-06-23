// 账号系统 - 本地存储 + 6位短ID
const Account = {
    currentUser: null,
    DEV_USER: { username: "LIU", userId: "000001", password: btoa("Lpx101146"), isDev: true },

    init() {
        const saved = localStorage.getItem("currentUser");
        if (saved) {
            this.currentUser = JSON.parse(saved);
            if (this.currentUser.username === this.DEV_USER.username) {
                this.currentUser.isDev = true;
            }
            return true;
        }
        return false;
    },

    // 段位等级配置
    RANK_LEVELS: [
        { level: 1, name: "入门", color: "#94a3b8", minScore: 0 },
        { level: 2, name: "业余", color: "#22c55e", minScore: 100 },
        { level: 3, name: "业余二段", color: "#10b981", minScore: 200 },
        { level: 4, name: "业余三段", color: "#06b6d4", minScore: 400 },
        { level: 5, name: "业余四段", color: "#3b82f6", minScore: 600 },
        { level: 6, name: "业余五段", color: "#8b5cf6", minScore: 800 },
        { level: 7, name: "业余六段", color: "#d946ef", minScore: 1000 },
        { level: 8, name: "专业", color: "#f59e0b", minScore: 1500 },
        { level: 9, name: "专业二段", color: "#f97316", minScore: 2000 },
        { level: 10, name: "专业三段", color: "#ef4444", minScore: 3000 },
        { level: 11, name: "大师", color: "#00f0ff", minScore: 5000 },
        { level: 12, name: "棋圣", color: "#ffd700", minScore: 8000 }
    ],

    getRankByScore(score) {
        for (let i = this.RANK_LEVELS.length - 1; i >= 0; i--) {
            if (score >= this.RANK_LEVELS[i].minScore) {
                return this.RANK_LEVELS[i];
            }
        }
        return this.RANK_LEVELS[0];
    },

    // 可用头像列表
    AVATARS: [
        { id: 1, emoji: "👨‍💼", name: "商务人士" },
        { id: 2, emoji: "👩‍💼", name: "职场女性" },
        { id: 3, emoji: "🧑‍🎨", name: "艺术家" },
        { id: 4, emoji: "🧑‍💻", name: "程序员" },
        { id: 5, emoji: "👨‍🔬", name: "科学家" },
        { id: 6, emoji: "🧑‍⚕️", name: "医生" },
        { id: 7, emoji: "👩‍🔧", name: "工程师" },
        { id: 8, emoji: "🧑‍🎓", name: "学生" },
        { id: 9, emoji: "🦸", name: "超级英雄" },
        { id: 10, emoji: "🧙", name: "法师" },
        { id: 11, emoji: "🦋", name: "蝴蝶" },
        { id: 12, emoji: "🐱", name: "猫咪" },
        { id: 13, emoji: "🐶", name: "狗狗" },
        { id: 14, emoji: "🦊", name: "狐狸" },
        { id: 15, emoji: "🐼", name: "熊猫" },
        { id: 16, emoji: "🐸", name: "青蛙" }
    ],

    register(username, pwd) {
        if (!username || !pwd) return { ok: false, msg: "用户名和密码不能为空" };
        if (username.length < 2) return { ok: false, msg: "用户名至少2位" };
        if (pwd.length < 4) return { ok: false, msg: "密码至少4位" };
        if (username === this.DEV_USER.username) return { ok: false, msg: "该用户名已被占用" };
        let userList = JSON.parse(localStorage.getItem("userList") || "[]");
        if (userList.find(u => u.username === username)) return { ok: false, msg: "用户名已存在" };
        let userId;
        do { userId = Math.floor(100000 + Math.random() * 900000).toString(); }
        while (userList.find(u => u.userId === userId));
        // 随机选择一个头像
        const randomAvatar = this.AVATARS[Math.floor(Math.random() * this.AVATARS.length)];
        const user = { 
            username, 
            userId, 
            password: btoa(pwd),
            rankScore: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            avatarId: randomAvatar.id
        };
        userList.push(user);
        localStorage.setItem("userList", JSON.stringify(userList));
        this.currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        return { ok: true, user };
    },

    getAvatar(avatarId) {
        return this.AVATARS.find(a => a.id === avatarId) || this.AVATARS[0];
    },

    changeAvatar(avatarId) {
        if (!this.currentUser) return { ok: false, msg: "请先登录" };
        const avatar = this.getAvatar(avatarId);
        if (!avatar) return { ok: false, msg: "无效的头像ID" };
        this.currentUser.avatarId = avatarId;
        this.currentUser.customAvatar = null;
        this.saveUser(this.currentUser);
        return { ok: true, avatar };
    },

    uploadCustomAvatar(imageFile) {
        return new Promise((resolve) => {
            if (!this.currentUser) {
                resolve({ ok: false, msg: "请先登录" });
                return;
            }
            
            if (!imageFile || !imageFile.type.startsWith('image/')) {
                resolve({ ok: false, msg: "请选择有效的图片文件" });
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Data = e.target.result;
                // 限制图片大小（约 100KB）
                if (base64Data.length > 133120) {
                    resolve({ ok: false, msg: "图片大小不能超过 100KB" });
                    return;
                }
                
                this.currentUser.customAvatar = base64Data;
                this.currentUser.avatarId = 0; // 标记为自定义头像
                this.saveUser(this.currentUser);
                resolve({ ok: true, avatar: { emoji: null, custom: base64Data } });
            };
            reader.onerror = () => {
                resolve({ ok: false, msg: "图片读取失败" });
            };
            reader.readAsDataURL(imageFile);
        });
    },

    getCurrentAvatar() {
        if (!this.currentUser) return this.AVATARS[0];
        if (this.currentUser.customAvatar) {
            return { id: 0, emoji: null, custom: this.currentUser.customAvatar, name: "自定义头像" };
        }
        return this.getAvatar(this.currentUser.avatarId);
    },

    getFriendAvatar(userId) {
        // 从好友信息中获取头像数据
        const friends = this.getFriends();
        const friend = friends.find(f => f.userId === userId);
        if (friend && friend.avatar) {
            return friend.avatar;
        }
        // 如果没有自定义头像，返回默认头像
        return { id: 1, emoji: '👤', custom: null, name: "默认头像" };
    },

    updateUserStats(isWin, isDraw = false) {
        if (!this.currentUser) return;
        if (isDraw) {
            this.currentUser.draws = (this.currentUser.draws || 0) + 1;
        } else if (isWin) {
            this.currentUser.wins = (this.currentUser.wins || 0) + 1;
            this.currentUser.rankScore = (this.currentUser.rankScore || 0) + 100;
        } else {
            this.currentUser.losses = (this.currentUser.losses || 0) + 1;
            const newScore = Math.max(0, (this.currentUser.rankScore || 0) - 20);
            this.currentUser.rankScore = newScore;
        }
        // 更新本地存储
        this.saveUser(this.currentUser);
    },

    saveUser(user) {
        // 更新当前用户
        localStorage.setItem("currentUser", JSON.stringify(user));
        // 更新用户列表
        let userList = JSON.parse(localStorage.getItem("userList") || "[]");
        const index = userList.findIndex(u => u.userId === user.userId);
        if (index !== -1) {
            userList[index] = user;
            localStorage.setItem("userList", JSON.stringify(userList));
        }
    },

    getCurrentRank() {
        if (!this.currentUser) return this.RANK_LEVELS[0];
        return this.getRankByScore(this.currentUser.rankScore || 0);
    },

    login(username, pwd) {
        if (username === this.DEV_USER.username && btoa(pwd) === this.DEV_USER.password) {
            const devUser = { ...this.DEV_USER, isDev: true };
            this.currentUser = devUser;
            localStorage.setItem("currentUser", JSON.stringify(devUser));
            return { ok: true, user: devUser };
        }
        const userList = JSON.parse(localStorage.getItem("userList") || "[]");
        const user = userList.find(u => u.username === username && u.password === btoa(pwd));
        if (!user) return { ok: false, msg: "用户名或密码错误" };
        this.currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        return { ok: true, user };
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem("currentUser");
        location.reload();
    },

    isDeveloper() { return this.currentUser && this.currentUser.username === this.DEV_USER.username; },

    // ===== 好友管理 =====
    getFriends() {
        if (!this.currentUser) return [];
        return JSON.parse(localStorage.getItem(`friends_${this.currentUser.userId}`) || "[]");
    },

    _addFriendDirect(userId, remark, avatar = null) {
        const friends = this.getFriends();
        if (friends.find(f => f.userId === userId)) return false;
        friends.push({ 
            userId, 
            remark: remark || `玩家${userId}`,
            avatar: avatar || { id: 1, emoji: '👤', custom: null, name: "默认头像" }
        });
        localStorage.setItem(`friends_${this.currentUser.userId}`, JSON.stringify(friends));
        this.renderFriendList();
        return true;
    },

    removeFriend(userId) {
        let friends = this.getFriends().filter(f => f.userId !== userId);
        localStorage.setItem(`friends_${this.currentUser.userId}`, JSON.stringify(friends));
        this.renderFriendList();
    },

    renderFriendList() {
        const list = this.getFriends();
        
        // 渲染桌面端好友列表
        const container = document.getElementById("friendList");
        if (container) {
            container.innerHTML = "";
            if (list.length === 0) {
                container.innerHTML = '<p style="text-align:center;color:#999;font-size:12px;padding:20px 0">暂无好友</p>';
            } else {
                list.forEach(f => {
                    const item = document.createElement("div");
                    item.className = "friend-item";
                    // 获取好友头像
                    const friendAvatar = this.getFriendAvatar(f.userId);
                    const avatarHtml = friendAvatar.custom 
                        ? `<img src="${friendAvatar.custom}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                        : (friendAvatar.emoji || '👤');
                    // 获取好友状态
                    const status = this.getFriendStatus(f.userId);
                    const statusText = this.getStatusText(status);
                    const statusClass = this.getStatusClass(status);
                    
                    item.innerHTML = `
                        <div class="friend-avatar-display">
                            ${avatarHtml}
                            <div class="status-indicator ${statusClass}"></div>
                        </div>
                        <div class="friend-info">
                            <div class="name">${f.remark}</div>
                            <div class="id">ID: ${f.userId}</div>
                            <div class="status-badge ${statusClass}">${statusText}</div>
                        </div>
                        <div class="btn-group">
                            <button class="chat-btn" data-id="${f.userId}">💬</button>
                            <button class="invite-btn" data-id="${f.userId}" ${status === 'offline' ? 'disabled' : ''}>⚔️</button>
                            <button class="del-btn" data-id="${f.userId}">×</button>
                        </div>
                    `;
                    this.bindFriendItemEvents(item, f);
                    container.appendChild(item);
                });
            }
        }
        
        // 渲染移动端好友列表
        const mobileContainer = document.getElementById("mobileFriendList");
        if (mobileContainer) {
            mobileContainer.innerHTML = "";
            if (list.length === 0) {
                mobileContainer.innerHTML = '<p style="text-align:center;color:#999;font-size:14px;padding:40px 0">暂无好友</p>';
            } else {
                list.forEach(f => {
                    const item = document.createElement("div");
                    item.className = "friend-item";
                    // 获取好友头像
                    const friendAvatar = this.getFriendAvatar(f.userId);
                    const avatarHtml = friendAvatar.custom 
                        ? `<img src="${friendAvatar.custom}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                        : (friendAvatar.emoji || '👤');
                    // 获取好友状态
                    const status = this.getFriendStatus(f.userId);
                    const statusText = this.getStatusText(status);
                    const statusClass = this.getStatusClass(status);
                    
                    item.innerHTML = `
                        <div class="friend-avatar-display">
                            ${avatarHtml}
                            <div class="status-indicator ${statusClass}"></div>
                        </div>
                        <div class="friend-info">
                            <div class="name">${f.remark}</div>
                            <div class="id">ID: ${f.userId}</div>
                            <div class="status-badge ${statusClass}">${statusText}</div>
                        </div>
                        <div class="btn-group">
                            <button class="chat-btn" data-id="${f.userId}">💬</button>
                            <button class="invite-btn" data-id="${f.userId}" ${status === 'offline' ? 'disabled' : ''}>⚔️</button>
                            <button class="del-btn" data-id="${f.userId}">×</button>
                        </div>
                    `;
                    this.bindFriendItemEvents(item, f);
                    mobileContainer.appendChild(item);
                });
            }
        }
    },
    
    getFriendStatus(userId) {
        // 如果正在检查状态，返回检查中
        if (this._checkingStatus && this._checkingStatus[userId]) {
            return 'checking';
        }
        if (!window.peer || window.peer.destroyed) {
            return 'offline';
        }
        // 检查是否有活跃连接
        if (window.conn && window.conn.peer === userId) {
            return window.isInGame ? 'playing' : 'online';
        }
        // 检查缓存的状态
        const statusCache = localStorage.getItem(`friendStatus_${userId}`);
        if (statusCache) {
            const parsed = JSON.parse(statusCache);
            // 状态缓存有效期2分钟
            if (Date.now() - parsed.time < 120000) {
                return parsed.status;
            }
        }
        return 'offline';
    },
    
    getStatusText(status) {
        switch (status) {
            case 'online':
                return '空闲';
            case 'playing':
                return '游戏中';
            case 'offline':
            default:
                return '已下线';
        }
    },
    
    getStatusClass(status) {
        switch (status) {
            case 'online':
                return 'status-online';
            case 'playing':
                return 'status-playing';
            case 'offline':
            default:
                return 'status-offline';
        }
    },
    
    updateFriendStatus(userId, status) {
        localStorage.setItem(`friendStatus_${userId}`, JSON.stringify({
            status,
            time: Date.now()
        }));
        this.renderFriendList();
    },
    
    checkFriendOnlineStatus(userId) {
        if (!window.peer || window.peer.destroyed) return;
        
        // 避免重复检查
        if (!this._checkingStatus) this._checkingStatus = {};
        if (this._checkingStatus[userId]) return;
        this._checkingStatus[userId] = true;
        
        const conn = window.peer.connect(userId, { reliable: true });
        const timeout = setTimeout(() => {
            if (conn.open) conn.close();
            this._checkingStatus[userId] = false;
            this.updateFriendStatus(userId, 'offline');
        }, 3000);
        
        conn.on("open", () => {
            clearTimeout(timeout);
            // 发送状态查询
            conn.send({ type: "statusQuery" });
            setTimeout(() => {
                if (conn.open) conn.close();
                this._checkingStatus[userId] = false;
            }, 500);
        });
        
        conn.on("data", (data) => {
            if (data.type === "statusReply") {
                this._checkingStatus[userId] = false;
                this.updateFriendStatus(userId, data.status);
            }
        });
        
        conn.on("error", () => {
            clearTimeout(timeout);
            this._checkingStatus[userId] = false;
            this.updateFriendStatus(userId, 'offline');
        });
        
        conn.on("close", () => {
            this._checkingStatus[userId] = false;
        });
    },
    
    checkAllFriendsOnlineStatus() {
        const friends = this.getFriends();
        friends.forEach(f => {
            this.checkFriendOnlineStatus(f.userId);
        });
    },
    
    startStatusRefresh() {
        // 每30秒刷新一次好友状态
        if (this._statusRefreshTimer) {
            clearInterval(this._statusRefreshTimer);
        }
        this._statusRefreshTimer = setInterval(() => {
            if (window.peer && !window.peer.destroyed) {
                this.checkAllFriendsOnlineStatus();
            }
        }, 30000);
    },
    
    stopStatusRefresh() {
        if (this._statusRefreshTimer) {
            clearInterval(this._statusRefreshTimer);
            this._statusRefreshTimer = null;
        }
    },
    
    bindFriendItemEvents(item, f) {
        item.querySelector(".chat-btn").onclick = (e) => {
            e.stopPropagation();
            // 关闭移动端面板
            document.getElementById("mobileFriendPanel")?.classList.remove("show");
            Chat.open(f.userId, f.remark);
        };
        item.querySelector(".invite-btn").onclick = (e) => {
            e.stopPropagation();
            // 关闭移动端面板
            document.getElementById("mobileFriendPanel")?.classList.remove("show");
            Account.sendInvite(f.userId);
        };
        item.querySelector(".del-btn").onclick = (e) => {
            e.stopPropagation();
            if (confirm(`确定删除好友“${f.remark}”吗？`)) {
                this.removeFriend(f.userId);
            }
        };
    },

    // ===== 消息系统 =====
    getMessages() {
        if (!this.currentUser) return [];
        return JSON.parse(localStorage.getItem(`msgs_${this.currentUser.userId}`) || "[]");
    },
    saveMessages(msgs) {
        if (!this.currentUser) return;
        localStorage.setItem(`msgs_${this.currentUser.userId}`, JSON.stringify(msgs));
    },
    addMessage(msg) {
        const msgs = this.getMessages();
        msgs.push({ ...msg, time: Date.now(), read: false });
        this.saveMessages(msgs);
        this.updateMessageBadge();
    },
    getUnreadCount() { return this.getMessages().filter(m => !m.read).length; },
    updateMessageBadge() {
        const badge = document.getElementById("msgBadge");
        const count = this.getUnreadCount();
        if (count > 0) { badge.style.display = "inline"; badge.textContent = count; }
        else badge.style.display = "none";
    },

    // ===== 发送好友申请 =====
    sendFriendRequest(targetUserId, remark) {
        if (!this.currentUser) return { ok: false, msg: "请先登录" };
        if (targetUserId === this.currentUser.userId) return { ok: false, msg: "不能添加自己" };
        if (this.getFriends().find(f => f.userId === targetUserId)) return { ok: false, msg: "已是好友" };
        const msgs = this.getMessages();
        if (msgs.find(m => m.type === "friendRequest" && m.from === targetUserId && !m.reply))
            return { ok: false, msg: "已发送过申请，请等待回复" };
        this.sendDataToUser(targetUserId, {
            type: "friendRequest",
            from: this.currentUser.userId,
            fromName: this.currentUser.username,
            remark: remark || this.currentUser.username,
            time: Date.now()
        }, (success) => {
            if (success) {
                this.addMessage({ type: "friendRequestSent", content: `已向 ${targetUserId} 发送好友申请` });
                alert("好友申请已发送，等待对方确认");
            } else {
                alert("对方不在线，无法发送申请");
            }
        });
        return { ok: true };
    },

    // ===== 发送对战邀请（与房间联机完全一致） =====
    sendInvite(targetUserId) {
        if (!this.currentUser) return;
        if (window.isInGame) { alert("您已在游戏中"); return; }
        if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
        window.mode = "online";
        window.host = 1;
        if (typeof initPeerConnection === "function") {
            initPeerConnection(null, true); // 成为房主，开始监听
        } else {
            alert("游戏组件未加载，请刷新");
            return;
        }
        this.sendDataToUser(targetUserId, {
            type: "invite",
            from: this.currentUser.userId,
            fromName: this.currentUser.username,
            time: Date.now()
        }, (success) => {
            if (!success) {
                alert("对方不在线或无法连接，请稍后再试");
                if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
                if (window._hostTimer) clearTimeout(window._hostTimer);
                if (typeof $ === "function") $("btnBack").click();
            }
        });
    },

    // ===== 底层数据发送 =====
    sendDataToUser(targetUserId, data, callback) {
        if (!window.peer || window.peer.destroyed) {
            console.error("Peer未初始化");
            if (callback) callback(false);
            return;
        }
        const conn = window.peer.connect(targetUserId, { reliable: true });
        let connected = false;
        const timeout = setTimeout(() => {
            if (!connected) { conn.close(); if (callback) callback(false); }
        }, 5000);
        conn.on("open", () => {
            connected = true;
            clearTimeout(timeout);
            conn.send(data);
            conn.on("data", (reply) => {
                if (reply.type === "friendRequestReply") Account.handleFriendRequestReply(reply);
                else if (reply.type === "inviteReply") Account.handleInviteReply(reply);
                setTimeout(() => { if (conn.open) conn.close(); }, 300);
            });
            if (callback) callback(true);
        });
        conn.on("error", () => { clearTimeout(timeout); if (callback) callback(false); });
    },

    // ===== 处理好友申请回复 =====
    handleFriendRequestReply(reply) {
        const fromId = reply.from;
        if (reply.accepted) {
            this._addFriendDirect(fromId, reply.remark || `玩家${fromId}`);
            const msgs = this.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === fromId && !m.reply);
            if (idx !== -1) { msgs[idx].reply = true; msgs[idx].accepted = true; this.saveMessages(msgs); }
            this.addMessage({ type: "system", content: `已与 ${reply.remark || fromId} 成为好友` });
            this.renderFriendList();
            this.updateMessageBadge();
            alert(`已与 ${reply.remark || fromId} 成为好友`);
        } else {
            const msgs = this.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === fromId && !m.reply);
            if (idx !== -1) { msgs[idx].reply = true; msgs[idx].accepted = false; this.saveMessages(msgs); }
            this.updateMessageBadge();
            alert(`对方拒绝了您的好友申请`);
        }
    },

    // ===== 处理对战邀请回复 =====
    handleInviteReply(reply) {
        console.log("handleInviteReply: 收到邀请回复, accepted:", reply.accepted);
        if (reply.accepted) {
            // 如果连接已经建立（对方已连接），就不需要再显示提示
            if (window.conn && window.conn.open) {
                console.log("收到邀请回复，但连接已建立，忽略");
                return;
            }
            // 如果游戏已经开始（技能选择阶段），忽略这个回复
            if (window.phase === "skillSelect" || window.phase === "normal") {
                console.log("收到邀请回复，但游戏已开始，忽略");
                return;
            }
            // 连接已经在 sendInvite 中初始化，这里不需要再次初始化
            // 只需等待对方连接即可
            $("modeModal").classList.remove("show");
            setStatus("对方已接受邀请，等待连接...");
        } else {
            const reason = reply.reason || "";
            alert(`对方拒绝了您的对战邀请${reason ? "：" + reason : ""}`);
            
            // 立即移除连接监听器（关键修复：防止后续触发 selSkill）
            if (window._connHandler && window.peer && !window.peer.destroyed) {
                try {
                    // 使用 removeListener 确保正确移除 once 添加的监听器
                    window.peer.removeListener("connection", window._connHandler);
                    console.log("handleInviteReply: 已移除连接监听器");
                } catch(e) {
                    console.error("handleInviteReply: 移除监听器失败:", e);
                }
            }
            window._connHandler = null;
            
            // 彻底清理所有连接资源
            if (typeof cleanupConnection === "function") {
                cleanupConnection();
            } else {
                // 如果 cleanupConnection 不可用，手动清理
                if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
                if (window._hostTimer) clearTimeout(window._hostTimer);
                window._hostTimer = null;
                if (window._heartbeat) { clearInterval(window._heartbeat); window._heartbeat = null; }
            }
            
            // 关闭技能选择弹窗（如果打开的话）
            if (typeof $ === "function") {
                $("skillModal").classList.remove("show");
            }
            
            // 重置游戏状态
            window.mode = "local";
            window.host = 0;
            window.phase = "modeSelect";
            window.isInGame = false;
            window._skillSelectedSent = false;
            
            if (typeof $ === "function") {
                $("modeModal").classList.remove("show");
                $("createArea").style.display = "none";
                $("joinArea").style.display = "none";
                $("btnBack").click();
            }
        }
    },

    // ===== 开发者管理 =====
    getAllUsers() { return JSON.parse(localStorage.getItem("userList") || "[]"); },
    deleteUser(username) {
        if (username === this.DEV_USER.username) return { ok: false, msg: "不能删除开发者账号" };
        let list = this.getAllUsers().filter(u => u.username !== username);
        localStorage.setItem("userList", JSON.stringify(list));
        return { ok: true };
    },
    updateUser(username, newData) {
        if (username === this.DEV_USER.username) return { ok: false, msg: "不能修改开发者账号" };
        let list = this.getAllUsers();
        const idx = list.findIndex(u => u.username === username);
        if (idx === -1) return { ok: false, msg: "用户不存在" };
        if (newData.username && newData.username !== username && list.find(u => u.username === newData.username))
            return { ok: false, msg: "用户名已被占用" };
        list[idx] = { ...list[idx], ...newData };
        localStorage.setItem("userList", JSON.stringify(list));
        if (this.currentUser && this.currentUser.username === username) {
            this.currentUser = { ...this.currentUser, ...newData };
            localStorage.setItem("currentUser", JSON.stringify(this.currentUser));
        }
        return { ok: true };
    },
    renderAdminPanel() {
        const container = document.getElementById("adminUserList");
        if (!container) return;
        const users = this.getAllUsers();
        document.getElementById("adminTotalCount").textContent = users.length;
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">暂无注册账号</p>';
            return;
        }
        let html = `<table><thead><tr><th>序号</th><th>用户名</th><th>用户ID</th><th>密码</th><th>操作</th></tr></thead><tbody>`;
        users.forEach((u, i) => {
            const pwdDisplay = u.password ? u.password.substring(0,6)+'***' : '***';
            html += `<tr><td>${i+1}</td><td>${u.username}</td><td>${u.userId}</td><td>${pwdDisplay}</td>
                <td><button class="admin-btn edit-btn" data-username="${u.username}">修改</button>
                <button class="admin-btn delete-btn" data-username="${u.username}">删除</button></td></tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
        container.querySelectorAll(".delete-btn").forEach(btn => {
            btn.onclick = () => {
                if (confirm(`确定删除账号 "${btn.dataset.username}" 吗？`)) {
                    const result = this.deleteUser(btn.dataset.username);
                    if (result.ok) { alert("删除成功"); this.renderAdminPanel(); }
                    else alert(result.msg);
                }
            };
        });
        container.querySelectorAll(".edit-btn").forEach(btn => {
            btn.onclick = () => showEditUserModal(btn.dataset.username);
        });
    }
};

function showEditUserModal(username) {
    document.getElementById("editUserTitle").textContent = `修改账号：${username}`;
    document.getElementById("editUsername").value = "";
    document.getElementById("editPassword").value = "";
    document.getElementById("editUserTip").textContent = "";
    document.getElementById("editUserModal").classList.add("show");
    const confirmBtn = document.getElementById("confirmEditUser");
    const cancelBtn = document.getElementById("cancelEditUser");
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.onclick = () => document.getElementById("editUserModal").classList.remove("show");
    newConfirm.onclick = () => {
        const newUsername = document.getElementById("editUsername").value.trim();
        const newPwd = document.getElementById("editPassword").value;
        const tip = document.getElementById("editUserTip");
        if (!newUsername && !newPwd) { tip.textContent = "请至少填写一项"; return; }
        const updateData = {};
        if (newUsername) updateData.username = newUsername;
        if (newPwd) {
            if (newPwd.length < 4) { tip.textContent = "密码至少4位"; return; }
            updateData.password = btoa(newPwd);
        }
        const result = Account.updateUser(username, updateData);
        if (result.ok) { alert("修改成功"); document.getElementById("editUserModal").classList.remove("show"); Account.renderAdminPanel(); }
        else tip.textContent = result.msg;
    };
}