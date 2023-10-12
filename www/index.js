"use strict";

let socket, sid;
let first = true;
let pseudo;
let color = "";
let current;
let emojimap = {};

fetch('./emojimap.json')
    .then(x => x.json())
    .then(emap => {
		for(let [k,v] of Object.entries(emap)){
			let m=k.split(",");
			for(let n of m)emojimap[n]=v;
		}
	});

function s_send(type, ...arg) {
    socket?.send?.(`${type}\0${JSON.stringify(arg)}`);
}
let ws_url = localStorage.ws_url ? new URL(localStorage.ws_url) : new URL("ws",location.href);
ws_url.protocol = ws_url.protocol.replace("http", "ws");

function s_connect() {
    socket = new WebSocket(ws_url);
    socket.addEventListener("message", e => {
        let [ type, json ] = e.data.split("\0");
        json = JSON.parse(json);
        // if(type != "MOUSE") console.log(type, json);
        switch(type) {
            case "MESSAGE": ss_current_tab.printMsg(json[0]); break;
            case "HELLO": {
               if(current && current != json[0]) {
                    connectprompt.querySelector(".tbprompt_title").textContent = "Reloading!";
                    return setTimeout(()=>location.reload(), 50);
                }
                current = json[0];
                sid = json[1];
                s_send("USER_JOINED", pseudo, color, current_tab.key);
                connectprompt.classList.remove("show");
            }; break;
            case "MOUSE": {
                let tsid = json[0];
                if(!ss_current_tab.users[tsid] || sid == tsid) break;
                let mouse = document.getElementById("mouse-"+tsid);
                if(!mouse) {
                    mouse = document.createElement("div");
                    mouse.className = "mouse";
                    mouse.id = "mouse-"+tsid;
                    mouse.appendChild(document.createElement("span"));
                    mice.appendChild(mouse);
                }
                mouse.children[0].textContent = ss_current_tab.users[tsid].nick;
                mouse.children[0].style.color = ss_current_tab.users[tsid].color;
                mouse.style.left = json[1] * 100 + "%";
                mouse.style.top = json[2] * 100 + "%";
            }; break;
            case "TYPING": {
				ss_current_tab.typing = json[0];
            }; break;
            case "USER_UPDATE": {
				for(let i of document.querySelectorAll(".mouse")) {
					if(!json[0].find(x=>x.sid==i.id.slice(6)))
						i.remove();
				}
				ss_current_tab.updateUsers(json[0]);
            }; break;
            case "USER_JOINED": {
                ss_current_tab.printMsg({
                    sid: "system",
                    html: true,
                    time: json[0].time,
                    content: printNick(json[0]).outerHTML + "<em> entered teh trollbox"
                })
            }; break;
            case "USER_LEFT": {
                ss_current_tab.printMsg({
                    sid: "system",
                    html: true,
                    time: json[1],
                    content: printNick(ss_current_tab.users[json[0]]).outerHTML + "<em> left teh trollbox"
                });
                //document.getElementById("mouse-"+json[0])?.remove();
            }; break;
            case "USER_CHANGE_NICK": {
                ss_current_tab.printMsg({
                    sid: "system",
                    html: true,
                    time: json[3],
                    content: printNick({nick:json[1][0],color:json[1][1]}).outerHTML + "<em> is now known as </em>" + printNick({nick:json[2][0],color:json[2][1]}).outerHTML
                })
            }; break
            case "HISTORY": {
                // nooooo i violated DRY what now
                ss_current_tab.clearChat();
                for(let msg of json[0]) {
                    if(msg.message) {
                        ss_current_tab.printMsg({sid: msg.sid, _user: msg, content: msg.message, time: msg.time });
                    } else if(msg.joined) {
                        ss_current_tab.printMsg({
                            sid: "system",
                            html: true,
                            time: msg.time,
                            content: printNick(msg).outerHTML + "<em> entered teh trollbox"
                        })
                    } else if(msg.left) {
                        ss_current_tab.printMsg({
                            sid: "system",
                            html: true,
                            time: msg.time,
                            content: printNick(msg).outerHTML + "<em> left teh trollbox"
                        })
                    } else if(msg.newnick) {
                        ss_current_tab.printMsg({
                            sid: "system",
                            html: true,
                            time: msg.time,
                            content: printNick(msg).outerHTML + "<em> is now known as </em>" + printNick({nick:msg.newnick,color:msg.newcolor}).outerHTML
                        })
                    }
                }
                ss_current_tab.scrollDown(true);
            }; break;
			case "ROOM": {
				ss_current_tab = tabs.get(json[0]) || createTab(json[0]);
				focusTab(ss_current_tab, false);
			}; break
        }
    });
    socket.addEventListener("close", e => {
        connectprompt.querySelector(".tbprompt_title").textContent = "Reconnecting...";
        connectprompt.classList.add("show");
        setTimeout(s_connect, 1500);
        mice.textContent = "";
    });
}


let tabs = new Map();
let previous_tab = null;
let current_tab = null;

function closeTab(tab) {
	tab = typeof tab == "string" ? tabs.get(name) : tab;
	let b = tab.onclose?.();
	if(b === false) return false;

	current_tab = null;
	focusTab(previous_tab);

	tab.el.opt.remove();
	tab.el.optlabel.remove();
	tab.el.tabelt.remove();

	tabs.delete(tab.key);
}

function focusTab(tab, ss=true) {
	if(tab == null) {
		current_tab?.el.tabelt.classList.remove("visible");
		tab_placeholder.classList.add("visible");
		return
	}

	tab = typeof tab == "string" ? tabs.get(tab) : tab;
	tab.el.opt.checked = true;
	tab_placeholder.classList.remove("visible");
	current_tab?.el.tabelt.classList.remove("visible");
	tab.el.tabelt.classList.add("visible");
	if(tab != current_tab) previous_tab = current_tab;
	current_tab = tab;
	// tell the setter to update the display
	tab.canSend = null;
	tab.typing = null;
	tab.closable = null;

	if(ss && tab.serverside)
		s_send("ROOM", tab.key);
}

function createTab(name) {
	let re = tabs.get(name);
	if(re) return re;
	let tabelt = document.createElement("div");
	tabelt.className = "tab";
	tabelt.id = "tab_" + name;
	let scroll = document.createElement("div");
	scroll.className = "scroll";
	tabelt.appendChild(scroll);
	let infos = document.createElement("div");
	infos.className = "infos";
	tabelt.appendChild(infos);
	tabctr.appendChild(tabelt);

	let opt = document.createElement("input");
	opt.type = "radio";
	opt.name = "tabsel";
	opt.id = "tsel_" + name;
	let optlabel = document.createElement("label");
	optlabel.setAttribute("for", opt.id);
	optlabel.textContent = name;
	tabbar.appendChild(opt);
	tabbar.appendChild(optlabel);

	opt.addEventListener("change", function() {
		focusTab(re);
	});

	let autoscroll;
	scroll.addEventListener("scroll", function() {
		autoscroll = (scroll.scrollHeight - (scroll.scrollTop + scroll.clientHeight)) < 1;
	});

	let last_type;
	let can_send = true;
	let closable = true;

	let users = {};
	let typing = [];

	re = {
		key: name,
		el: { tabelt, scroll, infos, opt, optlabel },
		scrollDown(force=false) {
			if (force || autoscroll) scroll.scrollTop = scroll.scrollHeight;
		},
		printMsg(data) {
			let q = document.createElement("span");
			q.classList.add("line");
			let user = data._user || (data.sid == "system" ? {
				nick: "<system>",
				color: "lime",
				home: "local",
				sid: "system"
			} : users[data.sid]);
			// time
			let w = document.createElement("span");
			w.classList.add("h");
			w.textContent = (new Date(data.time)).toTimeString().split(" ")[0];
			q.appendChild(w);
			// nick
			q.appendChild(printNick(user, false));
			// message
			w = document.createElement("span");
			w.classList.add("msg");
			w.innerHTML = `<div class="msg_ctx"></div>`;
			w.children[0].innerHTML = data.html ? data.content : formatMsg(data.content);
			q.appendChild(w);
			// twemoji
			twemoji.parse(w, {
				folder: 'svg',
				ext: '.svg',
				base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/', // maxcdn shutdown
				callback(icon, options, variant) {
					switch (icon) {
						case 'a9': // copyright
						case 'ae': // registered trademark
						case '2122': // trademark
						return false;
					}
					return ''.concat(options.base, options.size, '/', icon, options.ext);
				}
			});
			scroll.appendChild(q);
			re.scrollDown();
			for(let a of w.querySelectorAll("img")) a.onload = re.scrollDown;
		},
		sendMsg(t) {
			s_send("MESSAGE", t);
		},
		sendTyping(e) {
			if(last_type == e) return;
			last_type = e;
			s_send("TYPING", e);
		},
		updateUsers(data) {
            infos.innerHTML = "<em>ONLINE - " + data.length + "</em>";
            users = {};
            for (let user of data) {
				users[user.sid] = user;
				let s = printNick(user);
				s.style.display = "block"
				infos.appendChild(s);
			}
		},
		get users() { return structuredClone(users); },
		get typing() { return Array.from(typing); },
		set typing(data) {
			typing = data ?? typing;
			if(this == current_tab) {
				typing_users.textContent = "";
				let tn;
				for(let sid of typing) {
					typing_users.appendChild(printNick(users[sid]));
					typing_users.appendChild(tn = document.createTextNode(", "));
				}
				if(typing.length == 1)
					tn.textContent = " is typing...";
				else if(typing.length > 1)
					tn.textContent = " are typing...";
			}
		},
		get canSend() { return can_send; },
		set canSend(b) {
			can_send = !!(b ?? can_send);
			if(this == current_tab) {
				input.disabled = !can_send;
				send.disabled = !can_send;
			}
		},
		get closable() { return closable; },
		set closable(b) {
			closable = !!(b ?? closable);
			if(this == current_tab) {
				tab_close.disabled = !closable;
			}
		},
		clearChat() {
			scroll.textContent = "";
		},

		onclose: null,
		serverside: true
	};
	tabs.set(name, re);
	return re;
}

let main_tab = createTab("lobby");
focusTab(main_tab, false);
let ss_current_tab = main_tab;
main_tab.closable = false;

getnickname();

tab_close.onclick = () => closeTab(current_tab);
tab_create.onclick = () => {
    let ok_button = roomcreateprompt.querySelector(".tbprompt_button1"),
        cancel_button = roomcreateprompt.querySelector(".tbprompt_button2"),
        inp_name = roomcreateprompt.querySelector(".tbprompt_input");
	cancel_button.onclick = () => roomcreateprompt.classList.remove("show");
	ok_button.disabled = !inp_name.value.trim();
	inp_name.oninput = () => ok_button.disabled = !inp_name.value.trim();
	ok_button.onclick = () => {
		let n = inp_name.value.trim();
		roomcreateprompt.classList.remove("show");
		let t = createTab(n);
		focusTab(t);
	}
	roomcreateprompt.classList.add("show");
};

nick_btn.onclick = getnickname.bind(null, true);

function printNick(data, l) {
    let w = document.createElement("span");
    w.classList.add("nick");
    w.style.color = data.color.split(";")[0];
    w.textContent = data.nick;
    w.setAttribute("sid", data.sid);
    w.setAttribute("hid", data.home);
    //if (blocked.includes(data.home)) w.setAttribute("blocked", "")
    w.setAttribute("badge", data.admin ? "admin" : (data.mod ? "mod" : (data.bot ? "bot" : "")));
    return w;
}

let throttle_mouse = false, throttle_mouse_i;
document.addEventListener("mousemove", e => {
    if(throttle_mouse) return;
    s_send("MOUSE", e.clientX / innerWidth, e.clientY / innerHeight);
    throttle_mouse_i = setTimeout(()=>throttle_mouse=false, 50);
    throttle_mouse = true;
});
document.addEventListener("mouseleave", e => {
    s_send("MOUSE", -1, -1);
});
function formatMsg(a) {
    // he.encode works too, but let's pretend it doesn't exist :P
    function shtml(a) {
        return a
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            // .replace(/>/g, "&gt;")  not really necessary
            .replace(/"/g, "&quot;")
    }
    function unmdhtml(a){
        return a
        .replace(/_/g, "&#95;")
        .replace(/\*/g, "&#42;")
        .replace(/~/g, "&#126;");
    }
    return shtml(a)
        .replace(/(\\)?(!)?\[(.+?)\]\((.+?)\)/gs, function (entire, escape, img, alt, src) {
            if (escape) return entire.slice(1);
            let e;
            try {
                e = new URL(src)
                if (e.protocol != "http:" && e.protocol != "https:" && (img && e.protocol != "data:")) return entire
            } catch (e) {
                return entire
            }
            let bsrc = src.split(" ");
            let ealt = unmdhtml(shtml(alt)),
                esrc = unmdhtml(shtml(src));
			let psrc = unmdhtml("https://external-content.duckduckgo.com/iu/?u="+encodeURIComponent(src));
            return img ? `<img src="${e.protocol=="data:"?esrc:psrc}" alt="${ealt}">` : `<a href="${esrc}">${ealt}</a>`
        })
        .replace(/^(\\)?> (.+)/gm, function (entire, esc, ducks) {
            if (esc) return "> " + ducks;
            return `<span style="border-left: 4px solid #fff4; padding-left: 8px">` + ducks + "</span>";
        })
        .replace(/(\\)?:(\w+?):/g, function (entire, esc, ducks) {
            if (esc) return `:${ducks}:`;
            return emojimap[ducks] || entire;
        })
        .replace(/([^\\]|^)\*\*(.+?[^\\])\*\*/gs, "$1<b>$2</b>")
        .replace(/([^\\]|^)\*(.+?[^\\])\*/gs, "$1<i>$2</i>")
        .replace(/([^\\]|^)__(.+?[^\\])__/gs, "$1<u>$2</u>")
        .replace(/([^\\]|^)_(.+?[^\\])_/gs, "$1<i>$2</i>")
        .replace(/([^\\]|^)~~(.+?[^\\])~~/gs, "$1<s>$2</s>")
        .replace(/\\\*/g, "*")
        .replace(/\\\*\*/g, "**")
        .replace(/\\_/g, "_")
        .replace(/\\__/g, "__")
        .replace(/\\~~/g, "~~")
        .replace(/\\\\/g, "\\")
}


let not_typing, can_sus, too_fast;
function update_disabled() {
    send.disabled = too_fast || !can_sus;
}
input.onkeypress = function (e) {
    if (!e.shiftKey && e.code == "Enter") {
        e.preventDefault();
        if (too_fast || !can_sus) return;
        send.onclick();
    }
}
input.oninput = function(a) {
    clearTimeout(not_typing);
    not_typing = setTimeout(current_tab.sendTyping, 2000, false);
    can_sus = !!(this.value.trim().length);
    current_tab.sendTyping(can_sus);
    update_disabled();
}
send.onclick = function (a) {
    a && a.preventDefault()
    if (!input.value.trim()) return;
    current_tab.sendMsg(input.value);
    input.focus();
    input.value = "";
    can_sus = false;
    too_fast = true;
    update_disabled();
    setTimeout(()=>{too_fast=false; update_disabled()}, 3000);
    return current_tab.sendTyping(false);
}

function getnickname(userchange) {
    let nick = localStorage["user_pseudo"] || "";
    let col = nick ? localStorage["user_color"] || randomcolor() : randomcolor();
    if (!userchange && nick) {
        nick_btn.innerText = pseudo = nick, color = col;
        s_connect()
        return;
    }
    let ok_button = nickchangeprompt.querySelector(".tbprompt_button1"),
        cancel_button = nickchangeprompt.querySelector(".tbprompt_button2"),
        inp_nick = nickchangeprompt.querySelector(".tbprompt_input"),
        inp_col = nickchangeprompt.querySelector(".tbprompt_color_input");
    inp_nick.value = nick;
    inp_col.value = col;
    nickchangeprompt.classList.add("show");
    cancel_button.disabled = !userchange;
    cancel_button.onclick = () => nickchangeprompt.classList.remove("show");
    ok_button.onclick = () => {
        nick_btn.innerText = localStorage.user_pseudo =
            pseudo = nick = inp_nick.value.trim() || "anonymous";
        color = col = localStorage.user_color = inp_col.value;
        if (userchange) {
            s_send("USER_CHANGE_NICK", nick, col)
        } else {
            s_connect()
        }
        nickchangeprompt.classList.remove("show");
        nick_btn.disabled = true;
        setTimeout(()=>{nick_btn.disabled = false}, 8000);
    }
}
function randomcolor() {
    let e = [
        "146789abcdef",
        "aabbccddeeff",
        "113399aaddff"
    ], b = "#";
    for (let i = 0; i < 6; i++) {
        b += e[i / 2 | 0][0 | (Math.random() * 12)]
    }
    return b
}
