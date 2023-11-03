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
	#el;
	static #previous;
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
		this.#el = { tabelt, scroll, infos, opt, optlabel };
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
	set name(x) {
		this.#name = x;
		this.#el.optlabel.textContent = x;
	}
	set canType(x) {
		this.#canType = x;
		if(this == Tab.focused) { this.focus() }
	}
	set canSend(x) {
		this.#canSend = x;
		if(this == Tab.focused) { this.focus() }
	}

	get closed() {
		return tabs.get(this.#id) != this;
	}
	close() {
		this.onClose();
		tabs.delete(this.#id);
		this.#el.tabelt.remove();
		this.#el.opt.remove();
		this.#el.optlabel.remove();
		let fte = tabs.values().next().value;
		switch(false) {
			case Tab.#previous?.closed:
				Tab.#previous.focus(); break
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
			Tab.#previous = Tab.#focused;
			Tab.#focused = this;
			(Tab.#previous?.closed === false ? Tab.#previous.#el.tabelt : ele.tab_placeholder).classList.remove("visible");
			Tab.#focused.#el.tabelt.classList.add("visible");
		}
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
	}
	printMsg(data) {
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
	}
	clearChat() {
		this.#el.scroll.textContent = "";
	}
	scrollDown(force=false) {
		if(force||this.#scrollEnd) this.#el.scroll.scrollTop = this.#el.scroll.scrollHeight;
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

	// event handlers
	onMessage = (message) => {};
	onTyping = (is_typing) => {};
	onClose = () => {}
}
