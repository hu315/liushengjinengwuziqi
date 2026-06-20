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
        if (userList.find(u => u.username === username)) {
            return { ok: false, msg: "用户名已存在" };
        }

        let userId;
        do {
            userId = Math.floor(100000 + Math.random() * 900000).toString();
        } while (userList.find(u => u.userId === userId));

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

    isDeveloper() {
        return this.currentUser && this.currentUser.username === this.DEV_USER.username;
    },

    // ===== 好友管理 =====
    getFriends() {
        if (!this.currentUser) return [];
        const key = `friends_${this.currentUser.userId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    _addFriendDirect(userId, remark) {
        const friends = this.getFriends();
        if (friends.find(f => f.userId === userId)) return false;
        friends.push({ userId, remark: remark || `玩家${userId}` });
        const key = `friends_${this.currentUser.userId}`;
        localStorage.setItem(key, JSON.stringify(friends));
        this.renderFriendList();
        return true;
    },

    removeFriend(userId) {
        let friends = this.getFriends().filter(f => f.userId !== userId);
        const key = `friends_${this.currentUser.userId}`;
        localStorage.setItem(key, JSON.stringify(friends));
        this.renderFriendList();
    },

    renderFriendList() {
        const list = this.getFriends();
        const container = document.getElementById("friendList");
        if (!container) return;
        container.innerHTML = "";
        if (list.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;font-size:12px;padding:20px 0">暂无好友</p>';
            return;
        }
        list.forEach(f => {
            const item = document.createElement("div");
            item.className = "friend-item";
            item.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <div class="name">${f.remark}</div>
                    <div class="id">ID: ${f.userId}</div>
                </div>
                <div style="display:flex; gap:4px; flex-shrink:0;">
                    <button class="chat-btn" data-id="${f.userId}" style="background:#2ecc71;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">💬 聊天</button>
                    <button class="invite-btn" data-id="${f.userId}" style="background:#3498db;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">⚔️ 对战</button>
                    <button class="del-btn" data-id="${f.userId}" style="background:#e74c3c;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;">×</button>
                </div>
            `;
            item.querySelector(".chat-btn").onclick = (e) => {
                e.stopPropagation();
                Chat.open(f.userId, f.remark);
            };
            item.querySelector(".invite-btn").onclick = (e) => {
                e.stopPropagation();
                Account.sendInvite(f.userId);
            };
            item.querySelector(".del-btn").onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定删除好友“${f.remark}”吗？`)) {
                    this.removeFriend(f.userId);
                }
            };
            container.appendChild(item);
        });
    },

    // ===== 消息系统 =====
    getMessages() {
        if (!this.currentUser) return [];
        const key = `msgs_${this.currentUser.userId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    saveMessages(msgs) {
        if (!this.currentUser) return;
        const key = `msgs_${this.currentUser.userId}`;
        localStorage.setItem(key, JSON.stringify(msgs));
    },

    addMessage(msg) {
        const msgs = this.getMessages();
        msgs.push({ ...msg, time: Date.now(), read: false });
        this.saveMessages(msgs);
        this.updateMessageBadge();
    },

    markMessageRead(index) {
        const msgs = this.getMessages();
        if (msgs[index]) msgs[index].read = true;
        this.saveMessages(msgs);
        this.updateMessageBadge();
    },

    getUnreadCount() {
        return this.getMessages().filter(m => !m.read).length;
    },

    updateMessageBadge() {
        const badge = document.getElementById("msgBadge");
        const count = this.getUnreadCount();
        if (count > 0) {
            badge.style.display = "inline";
            badge.textContent = count;
        } else {
            badge.style.display = "none";
        }
    },

    // ===== 发送好友申请 =====
    sendFriendRequest(targetUserId, remark) {
        if (!this.currentUser) return { ok: false, msg: "请先登录" };
        if (targetUserId === this.currentUser.userId) return { ok: false, msg: "不能添加自己" };
        if (this.getFriends().find(f => f.userId === targetUserId)) {
            return { ok: false, msg: "已是好友" };
        }
        const msgs = this.getMessages();
        const existing = msgs.find(m => m.type === "friendRequest" && m.from === targetUserId && !m.reply);
        if (existing) return { ok: false, msg: "已发送过申请，请等待对方回复" };

        this.sendDataToUser(targetUserId, {
            type: "friendRequest",
            from: this.currentUser.userId,
            fromName: this.currentUser.username,
            remark: remark || this.currentUser.username,
            time: Date.now()
        }, (success) => {
            if (success) {
                this.addMessage({
                    type: "friendRequestSent",
                    content: `已向 ${targetUserId} 发送好友申请`,
                });
                alert("好友申请已发送，等待对方确认");
            } else {
                alert("对方不在线，无法发送申请");
            }
        });
        return { ok: true };
    },

    // ===== 发送对战邀请 =====
    sendInvite(targetUserId) {
        if (!this.currentUser) return;
        if (window.isInGame) {
            alert("您已在游戏中，无法发送邀请");
            return;
        }
        // 清理旧连接
        if (window.conn) {
            try { window.conn.close(); } catch(e) {}
            window.conn = null;
        }
        // 先成为房主（开始监听）
        window.mode = "online";
        window.host = 1;
        if (typeof initPeerConnection === "function") {
            initPeerConnection(null, true);
        } else {
            alert("游戏组件未加载，请刷新页面");
            return;
        }
        // 发送邀请消息（通过临时数据连接）
        this.sendDataToUser(targetUserId, {
            type: "invite",
            from: this.currentUser.userId,
            fromName: this.currentUser.username,
            time: Date.now()
        }, (success) => {
            if (!success) {
                alert("对方不在线或无法连接，请稍后再试");
                // 取消房主状态
                if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
                if (window._hostTimer) { clearTimeout(window._hostTimer); window._hostTimer = null; }
                if (typeof $ === "function") $("btnBack").click();
            }
        });
    },

    // ===== 底层数据发送（使用全局 peer） =====
    sendDataToUser(targetUserId, data, callback) {
        if (!window.peer || window.peer.destroyed) {
            console.error("Peer 未初始化，请重新登录");
            if (callback) callback(false);
            return;
        }
        const conn = window.peer.connect(targetUserId, { reliable: true });
        let connected = false;
        const timeout = setTimeout(() => {
            if (!connected) {
                conn.close();
                if (callback) callback(false);
            }
        }, 5000);

        conn.on("open", () => {
            connected = true;
            clearTimeout(timeout);
            conn.send(data);
            conn.on("data", (reply) => {
                if (reply.type === "friendRequestReply") {
                    Account.handleFriendRequestReply(reply);
                } else if (reply.type === "inviteReply") {
                    Account.handleInviteReply(reply);
                }
                setTimeout(() => { if (conn.open) conn.close(); }, 300);
            });
            if (callback) callback(true);
        });
        conn.on("error", (err) => {
            clearTimeout(timeout);
            if (callback) callback(false);
        });
    },

    // ===== 处理好友申请回复（双方互加） =====
    handleFriendRequestReply(reply) {
        const fromId = reply.from;
        if (reply.accepted) {
            // 发起方添加对方（接收方已在同意时添加了发起方，但这里再次确保）
            this._addFriendDirect(fromId, reply.remark || `玩家${fromId}`);
            const msgs = this.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === fromId && !m.reply);
            if (idx !== -1) {
                msgs[idx].reply = true;
                msgs[idx].accepted = true;
                this.saveMessages(msgs);
            }
            this.addMessage({
                type: "system",
                content: `已与 ${reply.remark || fromId} 成为好友`
            });
            this.renderFriendList();
            this.updateMessageBadge();
            alert(`已与 ${reply.remark || fromId} 成为好友`);
        } else {
            const msgs = this.getMessages();
            const idx = msgs.findIndex(m => m.type === "friendRequest" && m.from === fromId && !m.reply);
            if (idx !== -1) {
                msgs[idx].reply = true;
                msgs[idx].accepted = false;
                this.saveMessages(msgs);
            }
            this.updateMessageBadge();
            alert(`对方拒绝了您的好友申请`);
        }
    },

    // ===== 处理对战邀请回复 =====
    handleInviteReply(reply) {
        const fromId = reply.from;
        if (reply.accepted) {
            if (window.isInGame) {
                alert("您已在游戏中，无法开始新对局");
                return;
            }
            // 对方已接受，我方作为房主已经处于等待状态，无需额外操作
            // 但若连接尚未建立，则继续等待（由 initPeerConnection 处理）
        } else {
            const reason = reply.reason || "";
            alert(`对方拒绝了您的对战邀请${reason ? "：" + reason : ""}`);
            // 取消房主状态
            if (window.conn) { try { window.conn.close(); } catch(e) {} window.conn = null; }
            if (window._hostTimer) { clearTimeout(window._hostTimer); window._hostTimer = null; }
            if (typeof $ === "function") $("btnBack").click();
        }
    },

    // ===== 开发者账号管理 =====
    getAllUsers() {
        return JSON.parse(localStorage.getItem("userList") || "[]");
    },

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

        if (newData.username && newData.username !== username) {
            if (list.find(u => u.username === newData.username)) {
                return { ok: false, msg: "用户名已被占用" };
            }
        }

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

        let html = `
            <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background:#2c3e50;color:#fff;">
                        <th style="padding:10px 12px;text-align:left;">序号</th>
                        <th style="padding:10px 12px;text-align:left;">用户名</th>
                        <th style="padding:10px 12px;text-align:left;">用户ID</th>
                        <th style="padding:10px 12px;text-align:left;">密码</th>
                        <th style="padding:10px 12px;text-align:center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach((u, i) => {
            const pwdDisplay = u.password ? u.password.substring(0, 6) + '***' : '***';
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px 12px;">${i + 1}</td>
                    <td style="padding:10px 12px;font-weight:500;">${u.username}</td>
                    <td style="padding:10px 12px;color:#666;">${u.userId}</td>
                    <td style="padding:10px 12px;color:#999;font-family:monospace;">${pwdDisplay}</td>
                    <td style="padding:10px 12px;text-align:center;">
                        <button class="admin-btn edit-btn" data-username="${u.username}" style="background:#3498db;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:12px;margin-right:4px;">修改</button>
                        <button class="admin-btn delete-btn" data-username="${u.username}" style="background:#e74c3c;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:12px;">删除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        container.querySelectorAll(".delete-btn").forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.username;
                if (confirm(`确定要删除账号 "${username}" 吗？此操作不可恢复！`)) {
                    const result = this.deleteUser(username);
                    if (result.ok) {
                        alert("删除成功");
                        this.renderAdminPanel();
                    } else {
                        alert(result.msg);
                    }
                }
            };
        });

        container.querySelectorAll(".edit-btn").forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.username;
                showEditUserModal(username);
            };
        });
    }
};

// ===== 修改账号弹窗 =====
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

    newCancel.onclick = () => {
        document.getElementById("editUserModal").classList.remove("show");
    };

    newConfirm.onclick = () => {
        const newUsername = document.getElementById("editUsername").value.trim();
        const newPwd = document.getElementById("editPassword").value;
        const tip = document.getElementById("editUserTip");

        if (!newUsername && !newPwd) {
            tip.textContent = "请至少填写一项修改内容";
            return;
        }

        const updateData = {};
        if (newUsername) updateData.username = newUsername;
        if (newPwd) {
            if (newPwd.length < 4) {
                tip.textContent = "密码至少4位";
                return;
            }
            updateData.password = btoa(newPwd);
        }

        const result = Account.updateUser(username, updateData);
        if (result.ok) {
            alert("修改成功");
            document.getElementById("editUserModal").classList.remove("show");
            Account.renderAdminPanel();
        } else {
            tip.textContent = result.msg;
        }
    };
}