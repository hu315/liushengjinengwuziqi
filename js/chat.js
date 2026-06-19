// 聊天系统 - 复用P2P连接
const Chat = {
    currentTarget: null,
    currentTargetName: "",

    // 打开聊天窗口
    open(userId, name){
        this.currentTarget = userId;
        this.currentTargetName = name;
        $("chatTargetName").textContent = name;
        $("chatWindow").style.display = "flex";
        this.renderHistory();
        
        // 如果没有连接，尝试建立连接
        if(!window.conn || window.conn.peer !== userId){
            // 这里复用游戏连接逻辑，非游戏状态下也建立纯聊天连接
            initPeerConnection(userId, false);
        }
    },

    // 关闭
    close(){
        $("chatWindow").style.display = "none";
        this.currentTarget = null;
    },

    // 获取聊天记录
    getHistory(targetId){
        const key = `chat_${Account.currentUser.userId}_${targetId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    // 保存消息
    saveMsg(targetId, msg){
        const history = this.getHistory(targetId);
        history.push(msg);
        const key = `chat_${Account.currentUser.userId}_${targetId}`;
        localStorage.setItem(key, JSON.stringify(history.slice(-100))); // 保留最近100条
    },

    // 渲染历史
    renderHistory(){
        const history = this.getHistory(this.currentTarget);
        const body = $("chatBody");
        body.innerHTML = "";
        history.forEach(msg => {
            const div = document.createElement("div");
            div.className = `chat-msg ${msg.from === Account.currentUser.userId ? 'me' : 'other'}`;
            const time = new Date(msg.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            div.innerHTML = `<div class="content">${this.escape(msg.content)}</div><div class="time">${time}</div>`;
            body.appendChild(div);
        });
        body.scrollTop = body.scrollHeight;
    },

    // 发送消息
    send(content){
        if(!content.trim() || !window.conn || !window.conn.open) return;
        const msg = {
            from: Account.currentUser.userId,
            content: content.trim(),
            time: Date.now()
        };
        
        // 发送
        window.conn.send({type: "chat", data: msg});
        
        // 本地保存
        this.saveMsg(this.currentTarget, msg);
        this.renderHistory();
        $("chatInput").value = "";
    },

    // 接收消息
    receive(msg){
        const fromId = msg.from;
        // 保存
        this.saveMsg(fromId, msg);
        
        // 如果当前正在和对方聊天，直接刷新
        if(this.currentTarget === fromId){
            this.renderHistory();
        } else {
            // 未读提示
            const friends = Account.getFriends();
            const f = friends.find(x => x.userId === fromId);
            const name = f ? f.remark : `玩家${fromId}`;
            // 简单提示
            setStatus(`收到来自 ${name} 的消息`);
        }
    },

    escape(str){
        return str.replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
};

// 聊天事件绑定
document.addEventListener("DOMContentLoaded", ()=>{
    $("chatClose").onclick = () => Chat.close();
    $("btnSendChat").onclick = () => Chat.send($("chatInput").value);
    $("chatInput").onkeydown = e => {
        if(e.key === "Enter") Chat.send(e.target.value);
    };

    // 登录相关
    if(!Account.init()){
        $("loginModal").classList.add("show");
    } else {
        afterLogin();
    }

    // 标签切换
    document.querySelectorAll(".tab").forEach(t => {
        t.onclick = () => {
            document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
            t.classList.add("active");
            const tab = t.dataset.tab;
            $("loginTab").style.display = tab === "login" ? "block" : "none";
            $("registerTab").style.display = tab === "register" ? "block" : "none";
            $("loginTip").textContent = "";
        };
    });

    // 登录按钮
    $("btnLogin").onclick = () => {
        const res = Account.login($("loginUser").value.trim(), $("loginPwd").value);
        if(res.ok){
            $("loginModal").classList.remove("show");
            afterLogin();
        } else {
            $("loginTip").textContent = res.msg;
        }
    };

    // 注册按钮
    $("btnRegister").onclick = () => {
        const u = $("regUser").value.trim();
        const p1 = $("regPwd").value;
        const p2 = $("regPwd2").value;
        if(p1 !== p2) return $("loginTip").textContent = "两次密码不一致";
        const res = Account.register(u, p1);
        if(res.ok){
            $("loginModal").classList.remove("show");
            afterLogin();
        } else {
            $("loginTip").textContent = res.msg;
        }
    };

    // 添加好友
    $("btnAddFriend").onclick = () => $("addFriendModal").classList.add("show");
    $("cancelAddFriend").onclick = () => $("addFriendModal").classList.remove("show");
    $("confirmAddFriend").onclick = () => {
        const id = $("friendIdInput").value.trim();
        const remark = $("friendRemark").value.trim();
        const res = Account.addFriend(id, remark);
        if(res.ok){
            $("addFriendModal").classList.remove("show");
            Account.renderFriendList();
            $("friendIdInput").value = "";
            $("friendRemark").value = "";
        } else {
            $("addFriendTip").textContent = res.msg;
        }
    };

    // 登出
    $("btnLogout").onclick = () => Account.logout();
});

// 登录后初始化
function afterLogin(){
    $("myUserId").textContent = Account.currentUser.userId;
    Account.renderFriendList();
    setStatus(`欢迎回来，${Account.currentUser.username}`);
}