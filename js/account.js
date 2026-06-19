// 账号系统 - 本地存储 + 6位短ID
const Account = {
    currentUser: null,

    init(){
        // 检查登录状态
        const saved = localStorage.getItem("currentUser");
        if(saved){
            this.currentUser = JSON.parse(saved);
            return true;
        }
        return false;
    },

    // 注册
    register(username, pwd){
        if(!username || !pwd) return {ok:false, msg:"用户名和密码不能为空"};
        if(username.length < 2) return {ok:false, msg:"用户名至少2位"};
        if(pwd.length < 4) return {ok:false, msg:"密码至少4位"};

        let userList = JSON.parse(localStorage.getItem("userList") || "[]");
        if(userList.find(u => u.username === username)){
            return {ok:false, msg:"用户名已存在"};
        }

        // 生成6位唯一短ID
        let userId;
        do {
            userId = Math.floor(100000 + Math.random() * 900000).toString();
        } while(userList.find(u => u.userId === userId));

        const user = {username, userId, password: btoa(pwd)};
        userList.push(user);
        localStorage.setItem("userList", JSON.stringify(userList));
        
        // 自动登录
        this.currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        return {ok:true, user};
    },

    // 登录
    login(username, pwd){
        const userList = JSON.parse(localStorage.getItem("userList") || "[]");
        const user = userList.find(u => u.username === username && u.password === btoa(pwd));
        if(!user) return {ok:false, msg:"用户名或密码错误"};
        
        this.currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        return {ok:true, user};
    },

    // 登出
    logout(){
        this.currentUser = null;
        localStorage.removeItem("currentUser");
        location.reload();
    },

    // 好友管理
    getFriends(){
        if(!this.currentUser) return [];
        const key = `friends_${this.currentUser.userId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    addFriend(userId, remark){
        if(!/^\d{6}$/.test(userId)) return {ok:false, msg:"请输入正确的6位ID"};
        if(userId === this.currentUser.userId) return {ok:false, msg:"不能添加自己"};
        
        const friends = this.getFriends();
        if(friends.find(f => f.userId === userId)){
            return {ok:false, msg:"该好友已存在"};
        }

        friends.push({userId, remark: remark || `玩家${userId}`});
        const key = `friends_${this.currentUser.userId}`;
        localStorage.setItem(key, JSON.stringify(friends));
        return {ok:true};
    },

    removeFriend(userId){
        let friends = this.getFriends().filter(f => f.userId !== userId);
        const key = `friends_${this.currentUser.userId}`;
        localStorage.setItem(key, JSON.stringify(friends));
    },

    renderFriendList(){
        const list = this.getFriends();
        const container = $("friendList");
        container.innerHTML = "";
        if(list.length === 0){
            container.innerHTML = '<p style="text-align:center;color:#999;font-size:12px;padding:20px 0">暂无好友</p>';
            return;
        }
        list.forEach(f => {
            const item = document.createElement("div");
            item.className = "friend-item";
            item.innerHTML = `
                <div>
                    <div class="name">${f.remark}</div>
                    <div class="id">ID: ${f.userId}</div>
                </div>
                <button class="invite-btn" data-id="${f.userId}">对战</button>
            `;
            item.querySelector(".name").onclick = () => Chat.open(f.userId, f.remark);
            item.querySelector(".invite-btn").onclick = (e) => {
                e.stopPropagation();
                // 邀请对战
                window.mode = "online";
                window.host = 1;
                initPeerConnection(f.userId, true);
            };
            container.appendChild(item);
        });
    }
};