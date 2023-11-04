import { nickHTML, formatMsg, validate_string } from "./util.js";
import * as ele from "./ui_elements.js";

import tw from "https://esm.sh/twemoji@14";
const tw_options = {
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
}

export const tabs = new Map();
export class Tab {
	#id = "";
	#name = "";
	#users = {};
	#typing = [];
	#scrollEnd = true;
	#canSend = false;
	#canType = true;
	#canClose = true;
	#el;
	static #focused;
	static #creating = false;
	constructor(id) {
		if(!Tab.#creating)
			throw new Error("bro you can't just call the constructor man use Tab.create()");
		Tab.#creating = false;
		this.#id = id;
		// TODO: ui
		let tabelt = document.createElement("div");
		tabelt.className = "tab";
		tabelt.id = "tab_" + id;
		let scroll = document.createElement("div");
		scroll.className = "scroll";
		tabelt.appendChild(scroll);
		let infos = document.createElement("div");
		infos.className = "infos";
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
		this.#el = { tabelt, scroll, infos, opt, optlabel, mice };
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
	set canType(x) {
		this.#canType = x;
		if(this == Tab.focused) { this.focus() }
	}
	set canSend(x) {
		this.#canSend = x;
		if(this == Tab.focused) { this.focus() }
	}
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
		if(this.closed) return;
		if(Tab.#focused != this) {
			this.#el.opt.checked = true;
			Tab.#focused?.ui_handle_mouse();
			Tab.#focused = this;
			for(let e of document.querySelectorAll(".tab.visible, .mice.visible")) e.classList.remove("visible");
			Tab.#focused.#el.tabelt.classList.add("visible");
			Tab.#focused.#el.mice.classList.add("visible");
		}
		ele.tab_closebtn.disabled = !this.#canClose;
		ele.input.disabled = !this.#canType;
		ele.sendbtn.disabled = !this.#canSend || !validate_string(ele.input.value);
		ele.typing_users.textContent = "";
		let tn;
		for(let sid of this.#typing) {
			if(!this.#users[sid]) continue;
			ele.typing_users.appendChild(nickHTML(this.#users[sid]));
			ele.typing_users.appendChild(tn=document.createTextNode(", "));
		}
		if(tn) tn.textContent = this.#typing.length > 1 ? " are typing…" : " is typing…";
		this.#unreadMsgCount = 0;
		this.name += "";
		this.scrollDown();
	}

	updateTyping(data) {
		this.#typing = [...data];
		if(Tab.focused == this) { this.focus() }
	}
	updateUsers(data) {
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
	}
	printMsg(data, countUnread) {
		let line = document.createElement("span");
		line.className = "line";
		let user = data._user || (data.sid == "system" ? { nick: "<system>",
			color: "#0f0",
			home: "local",
			sid: "system"
		} : this.#users[data.sid]);
		let ltime = document.createElement("span");
		ltime.className = "time";
		ltime.textContent = (new Date(data.time)).toTimeString().split(" ")[0];
		line.appendChild(ltime);
		line.appendChild(nickHTML(user));
		let lcontent = document.createElement("span");
		lcontent.className = "msg";
		lcontent.innerHTML = `<div class="msg_ctx">${data.html ? data.content : formatMsg(data.content)}</div>`;
		tw.parse(lcontent, tw_options);
		line.appendChild(lcontent);
		this.#el.scroll.appendChild(line);
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
			this.#el.mice.appendChild(mouse);
			this.#mice[uid] = mouse;
		}
		mouse.children[0].textContent = this.#users[uid].nick;
		mouse.children[0].style.color = this.#users[uid].color;
		mouse.style.left = x * 100 + "%";
		mouse.style.top = y * 100 + "%";
	}
	clearChat() {
		this.#el.scroll.textContent = "";
	}
	scrollDown(force=false) {
		if(force||this.#scrollEnd) this.#el.scroll.scrollTo(0, this.#el.scroll.scrollHeight);
	}

	#isTyping = false;
	#typeTimer;
	ui_handle_input(i=true) {
		this.focus();
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
		if(this.onMessage(ele.input.value.trim()) == false) return false;
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

	// event handlers
	onMouse = (x, y) => {};
	onMessage = (message) => {};
	onTyping = (is_typing) => {};
	onClose = () => {}
}
