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
        const user = { username, userId, password: btoa(pwd) };
        userList.push(user);
        localStorage.setItem("userList", JSON.stringify(userList));
        this.currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        return { ok: true, user };
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

    _addFriendDirect(userId, remark) {
        const friends = this.getFriends();
        if (friends.find(f => f.userId === userId)) return false;
        friends.push({ userId, remark: remark || `玩家${userId}` });
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
                    item.innerHTML = `
                        <div style="flex:1; min-width:0; overflow:hidden;">
                            <div class="name">${f.remark}</div>
                            <div class="id">ID: ${f.userId}</div>
                        </div>
                        <div class="btn-group">
                            <button class="chat-btn" data-id="${f.userId}">💬</button>
                            <button class="invite-btn" data-id="${f.userId}">⚔️</button>
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
                    item.innerHTML = `
                        <div style="flex:1; min-width:0; overflow:hidden;">
                            <div class="name">${f.remark}</div>
                            <div class="id">ID: ${f.userId}</div>
                        </div>
                        <div class="btn-group">
                            <button class="chat-btn" data-id="${f.userId}">💬</button>
                            <button class="invite-btn" data-id="${f.userId}">⚔️</button>
                            <button class="del-btn" data-id="${f.userId}">×</button>
                        </div>
                    `;
                    this.bindFriendItemEvents(item, f);
                    mobileContainer.appendChild(item);
                });
            }
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