import { nickHTML, formatMsg, validate_string } from "i_util";
import * as ele from "i_ui_elements";

import tw from "twemoji";
const tw_options = {
	folder: 'svg',
	ext: '.svg',
	base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/', // maxcdn shutdown
	callback(icon, options, variant) {
		switch (icon) {
		case 'a9':   // ⓒ copyright
		case 'ae':   // ⓡ registered trademark
		case '2122': // ™ trademark
			return false;
		}
		return ''.concat(options.base, options.size, '/', icon, options.ext);
	}
}

export const tabs = new Map();
export class Tab {
	#id = "";
	#name = "";
	#users = {};
	#typing = [];
	#scrollEnd = true;
	#canDM = false;
	#canSend = false;
	#canType = true;
	#canClose = true;
	#el;
	static #focused;
	static #creating = false;
	constructor(id) {
		if(!Tab.#creating)
			throw new Error("use Tab.create()");
		Tab.#creating = false;
		this.#id = id;
		// TODO: ui
		let tabelt = document.createElement("div");
		tabelt.className = "tab";
		tabelt.id = "tab_" + id;
		let scroll = document.createElement("div");
		scroll.className = "scroll";
		tabelt.appendChild(scroll);
		let sinner = document.createElement("div");
		sinner.className = "scroll_inner";
		scroll.appendChild(sinner);
		let infos = document.createElement("div");
		infos.className = "infos";
		infos.innerHTML = "<em>ONLINE - 0</em>";
		tabelt.appendChild(infos);
		ele.tabctr.appendChild(tabelt);
		let opt = document.createElement("input");
		opt.type = "radio";
		opt.name = "tabsel";
		opt.id = "tsel_" + id;
		let optlabel = document.createElement("label");
		optlabel.setAttribute("for", opt.id);
		optlabel.textContent = name;
		ele.tabbar.appendChild(opt);
		ele.tabbar.appendChild(optlabel);
		let mice = document.createElement("div");
		mice.className = "mice";
		mice.id = "mice_" + id;
		ele.micectr.appendChild(mice);
		this.#el = { tabelt, scroll, sinner, infos, opt, optlabel, mice };
		scroll.addEventListener("scroll", () => {
			this.#scrollEnd = (scroll.scrollHeight - (scroll.scrollTop + scroll.clientHeight)) < 1;
		});
		opt.addEventListener("change", () => {
			if(!opt.checked) return;
			this.focus();
		});
	}
	static create(id) {
		let tab = tabs.get(id);
		if(!tab) {
			Tab.#creating = true;
			tab = new Tab(id);
			tabs.set(id, tab);
			if(!Tab.focused) tab.focus();
		}
		return tab;
	}
	static get focused() { return this.#focused; }
	get users() { return this.#users; }
	get id() { return this.#id }
	get name() { return this.#name; }
	#unreadMsgCount = 0;
	set name(x) {
		this.#name = x;
		this.#el.optlabel.textContent = this.#unreadMsgCount ? `${x} (${this.#unreadMsgCount})` : x;
	}
	get canDM() { return this.#canDM; }
	set canDM(x) {
		this.#canDM = x;
	}
	get canType() { return this.#canType; }
	set canType(x) {
		this.#canType = x;
		if(this == Tab.focused) { this.focus() }
	}
	get canSend() { return this.#canSend; }
	set canSend(x) {
		this.#canSend = x;
		if(this == Tab.focused) { this.focus() }
	}
	get canClose() { return this.#canClose }
	set canClose(x) {
		this.#canClose = x;
		if(this == Tab.focused) { this.focus() }
	}
	get closed() {
		return tabs.get(this.#id) != this;
	}
	close() {
		this.onClose();
		tabs.delete(this.#id);
		this.#el.tabelt.remove();
		this.#el.mice.remove();
		this.#el.opt.remove();
		this.#el.optlabel.remove();
		let fte = tabs.values().next().value;
		switch(false) {
			case fte?.closed:
				fte.focus(); break
			default:
				ele.tab_placeholder.classList.add("visible");
		}
	}
	focus() {
		if(this.closed || Tab.focused == this) return;
		this.#el.opt.checked = true;
		Tab.focused?.ui_handle_mouse();
		Tab.#focused = this;
		for(let e of document.querySelectorAll(".tab.visible, .mice.visible")) e.classList.remove("visible");
		Tab.focused.#el.tabelt.classList.add("visible");
		Tab.focused.#el.mice.classList.add("visible");
		this.updateUI();
	}
	updateUI() {
		if(Tab.focused != this) return;
		ele.tab_closebtn.disabled = !this.#canClose;
		ele.input.disabled = !this.#canType;
		ele.sendbtn.disabled = !this.#canSend || !validate_string(ele.input.value);
		ele.typing_users.textContent = "";
		let tn, b = 0;
		if(this.#dmTarget) {
			let stop = document.createElement("button");
			stop.id = "stopdm_btn";
			stop.onclick = () => this.ui_handle_stopdm();
			ele.typing_users.appendChild(stop);
			ele.typing_users.appendChild(document.createTextNode("Sending DMs to "));
			ele.typing_users.appendChild(nickHTML(this.#users[this.#dmTarget]));
		}
		for(let sid of this.#typing) {
			if(!this.#users[sid]) continue;
			if(b == 0 && this.#dmTarget)
				ele.typing_users.appendChild(document.createTextNode(" | "));
			b++;
			ele.typing_users.appendChild(nickHTML(this.#users[sid]));
			ele.typing_users.appendChild(tn=document.createTextNode(", "));
		}
		if(tn) tn.textContent = b > 1 ? " are typing…" : " is typing…";
		this.#unreadMsgCount = 0;
		this.name += "";
		this.scrollDown();
	}

	updateTyping(data) {
		this.#typing = [...data];
		this.updateUI();
	}
	userUpdate(data) {
		this.#el.infos.innerHTML = `<em>ONLINE - ${data.length}</em>`;
		this.#users = {};
		for(let user of data) {
			this.#users[user.sid] = user;
			this.#el.infos.appendChild(nickHTML(user));
		}
		for(let [i, sus] of Object.entries(this.#mice)) {
			if(this.#users[i]) continue;
			sus.remove();
			delete this.#mice[i];
		}
		if(!this.#users[this.#dmTarget]) {
			this.#dmTarget = null;
			this.updateUI();
		}
	}
	userAdd(user) {
		this.#users[user.sid] = user;
		let elt = this.#el.infos.querySelector(':scope>[data-sid="'+user.sid+'"]')
		if(elt) {
			this.#el.infos.replaceChild(nickHTML(user), elt);
		} else {
			this.#el.infos.querySelector("em:first-child").innerText = `ONLINE - ${Object.values(this.#users).length}`;
			this.#el.infos.appendChild(nickHTML(user));
		}
	}
	userRemove(sid) {
		if(sid in this.#users) {
			delete this.#users[sid];
		}
		this.#el.infos.querySelector("em:first-child").innerText = `ONLINE - ${Object.values(this.#users).length}`;
		let elt = this.#el.infos.querySelector(':scope>[data-sid="'+sid+'"]');
		if(elt) { this.#el.infos.removeChild(elt); }
		if(sid in this.#mice) {
			this.#mice[sid].remove();
			delete this.#mice[sid];
		}
		if(this.#dmTarget == sid) {
			this.#dmTarget = null;
		}
	}
	printMsg(data, countUnread, dm="") {
		let line = document.createElement("div");
		if(data.id) line.dataset.msgid = data.id;
		line.className = "line";
		let uid = data.sid;
		if(dm=="t") {
			line.classList.add("dm", "dm-send");
			uid = data.sent_to;
		} else if(dm=="r") {
			line.classList.add("dm", "dm-recv");
		}
		let user = data._user || (uid == "system" ? { nick: "<system>",
			color: "#0f0",
			home: "local",
			sid: "system"
		} : this.#users[uid]);
		let ltime = document.createElement("span");
		ltime.className = "time";
		ltime.textContent = (new Date(data.time)).toTimeString().split(" ")[0];
		line.appendChild(ltime);
		line.appendChild(nickHTML(user));
		let lcontent = document.createElement("span");
		lcontent.className = "msg";
		let lcontent_inner = document.createElement("div");
		lcontent_inner.className = "msg_ctx";
		if(countUnread == null) {
			countUnread = ["message"].includes(data.content_type);
		}
		switch(data.content_type || "message") {
			case "message":
				lcontent_inner.innerHTML = formatMsg(data.content);
				tw.parse(lcontent_inner, tw_options);
				break;
			case "user_joined":
				lcontent_inner.appendChild(nickHTML(data.content));
				lcontent_inner.insertAdjacentHTML("beforeend","<em> joined</em>");
				break;
			case "user_left":
				lcontent_inner.appendChild(nickHTML(data.content));
				lcontent_inner.insertAdjacentHTML("beforeend","<em> left</em>");
				break;
			case "user_ch_nick":
				lcontent_inner.appendChild(nickHTML(data.content[0]));
				lcontent_inner.insertAdjacentHTML("beforeend","<em> is now known as </em>");
				lcontent_inner.appendChild(nickHTML(data.content[1]));
				break;
			default:
				lcontent_inner.innerHTML = "<em>Unknown message type: </em>";
				lcontent_inner.insertAdjacentText("beforeend",data.content_type+": "+JSON.stringify(data.content));
		}
		lcontent.appendChild(lcontent_inner);
		line.appendChild(lcontent);
		line.og_content = data;
		this.#el.sinner.appendChild(line);
		this.scrollDown();
		for(let a of line.querySelectorAll("img")) a.addEventListener("load", ()=>this.scrollDown());
		if(countUnread && Tab.focused != this) { this.#unreadMsgCount++; this.name += "" }
	}
	#mice = {};
	moveMouse(uid, x, y) {
		if(!this.#users[uid]) return;
		let mouse = this.#mice[uid];
		if(!mouse) {
			mouse = document.createElement("div");
			mouse.className = "mouse";
			mouse.id = "mouse-"+uid;
			mouse.appendChild(document.createElement("span"));
			mouse.children[0].className = "nick";
			this.#el.mice.appendChild(mouse);
			this.#mice[uid] = mouse;
		}
		mouse.children[0].textContent = this.#users[uid].nick;
		mouse.children[0].style.color = this.#users[uid].color;
		mouse.style.left = x * 100 + "%";
		mouse.style.top = y * 100 + "%";
	}
	clearChat() {
		this.#el.sinner.textContent = "";
	}
	scrollDown(force=false) {
		if(force||this.#scrollEnd) this.#el.scroll.scrollTo(0, this.#el.scroll.scrollHeight);
	}

	#isTyping = false;
	#typeTimer;
	ui_handle_input(i=true) {
		this.updateUI();
		if(i) {
			clearTimeout(this.#typeTimer);
			this.#typeTimer = setTimeout(()=>this.ui_handle_input(false), 2000);
		}
		if(this.#isTyping == i) return;
		this.#isTyping = i;
		this.onTyping(i);
	}
	ui_handle_send() {
		if(ele.sendbtn.disabled) return false;
		if(this.onMessage(ele.input.value, this.#dmTarget) == false) return false;
		ele.input.value="";
		this.focus();
		this.#isTyping = false;
		this.onTyping(false);
		return true;
	}
	#mouseLast = 0;
	ui_handle_mouse(e) {
		if(e && performance.now() - this.#mouseLast < 75) return;
		this.#mouseLast = performance.now();
		if(e == null) return this.onMouse(-1, -1);
		// limit to approximately 13.3 events per second
		this.onMouse(e.clientX / innerWidth, e.clientY / innerHeight);
	}
	#dmTarget = null;
	ui_handle_startdm(uid) {
		if(!this.#users[uid]) return;
		this.#dmTarget = uid;
		this.updateUI();
	}
	ui_handle_stopdm() {
		this.#dmTarget = null;
		this.updateUI();
	}

	// event handlers
	onMouse = (x, y) => {};
	// tuid is either null or a userid
	onMessage = (message, tuid) => {};
	onTyping = (is_typing) => {};
	onClose = () => {}
}
