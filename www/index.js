// imports
import { nickChangeDialog, roomCreateDialog } from "./dialogs.js";

import HighlightJS from "https://esm.sh/highlight.js";
import SimplePeer from "https://esm.sh/simple-peer@9";
import CBOR from "https://esm.sh/cbor-js";
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

// dom elements
const ui_input = document.querySelector("#input");
const ui_sendbtn = document.querySelector("#send");
const ui_nickbtn = document.querySelector("#nick_btn");
const ui_tabctr = document.querySelector("#tabctr");
const ui_tabbar = document.querySelector("#tabbar");
const ui_tab_placeholder = document.querySelector("#tab_placeholder");
const ui_typing_users = document.querySelector("#typing_users");
const ui_tab_closebtn = document.querySelector("#tab_close");
const ui_tab_createbtn = document.querySelector("#tab_create");

// emoji map
let emojimap = {};
let emojientr = {};

async function attemptGetEmojimap() {
	fetch('./emojimap.json')
		.then(x => x.json())
		.then(emap => {
			for(let [k,v] of Object.entries(emap)){
				emojimap[k[0]]??={};
				emojimap[k[0]][k]=v;
			}
			for(let [k,v] of Object.entries(emojimap)) {
				emojientr[k] = Object.entries(v)
					.filter(([k,v])=>!/(?:_tone\d|_(?:medium|dark|light|medium_dark|medium_light)_skin_tone)(?:_|$)/.test(k))
					.sort(([k1,v1],[k2,v2])=>k1.length>k2.length);
			}
		})
		.catch(e=>setTimeout(attempt_get_emojimap, 5000));
}
attemptGetEmojimap();


// autocomplete
// modifiable object (is to be modified by "plugins" (userscripts))
// const ac_triggers: Record<string, (str: string, pos: number) => [[string, string][], number, number]>
const ac_triggers = {
	emoji(str, pos) {
		let sl = str.slice(0,pos).match(/:(\w+)$/d);
		let be = sl?.[1] || "";
		let ss = sl?.indices[1][0];
		let se = pos;
		if(be.length<2 || !emojientr[be[0]]) return [[],ss,se];
		else return [emojientr[be[0]]
			.filter(([k,v])=>k.startsWith(be)).slice(0,30)
			.map(([k,v])=>[`${v} :${k}:`, `${k}:`]), ss, se];
	}
}

let ac_items = [];
let ac_is_active = false;
let ac_active_elt = null;
let ac_select_start = null;
let ac_select_end = null;

function acTrigger(str, pos) {
	for(let [k,f] of Object.entries(ac_triggers)) {
		let [result, sel_start, sel_end] = f(str, pos);
		if(result.length) {
			acUpdate(result, sel_start, sel_end);
			return;
		}
	}
	acUpdate([], 0, 0);
}
function acUpdate(items, sel_start, sel_end) {
	ac_select_start = sel_start;
	ac_select_end = sel_end;
	ac_items = Array.from(items);
	if(ac_items.length == 0) {
		ac_is_active = false;
		ac_select_start = ac_select_end = null;
		autocomp_bar.hidden = true;
		return;
	};
	ac_is_active = true;
	autocomp_bar.hidden = false;
	autocomp_bar.textContent = "";
	let i = 0;
	for(let [label, value] of ac_items) {
		let b = document.createElement("div");
		b.className = "autocomp_entry";
		b.textContent = label;
		b.addEventListener("click", function(i, e){
			e.preventDefault();
			acComplete(i);
		}.bind(null,i))
		autocomp_bar.appendChild(b);
		i++
	}
	acSetActive(0);
}
function acComplete(i=null) {
	if(i!=null) acSetActive(i);
	if(ac_active_elt == null) return;
	input.selectionStart = ac_select_start;
	input.selectionEnd = ac_select_end;
	// yeah yeah
	input.focus();
	document.execCommand("insertText", false, ac_items[ac_active_elt][1]);
}
function acSetActive(n) {
	ac_active_elt = Math.max(0, Math.min(n|0, ac_items.length-1));
	if(isNaN(ac_active_elt) || n == null || !ac_items.length) ac_active_elt = null;
	autocomp_bar.querySelector(".active")?.classList.remove("active")
	autocomp_bar.children[ac_active_elt]?.classList.add("active");
}

function validate_duck(s) {
	return !!s.trim();
}
ui_input.addEventListener("blur", ()=>acUpdate([], 0, 0));
ui_input.addEventListener("input", ()=>{
	acTrigger(ui_input.value, ui_input.selectionEnd);
	Tab.focused.ui_handle_input(true);
});
ui_input.addEventListener("keydown", ev=>{
	if(ev.code == "Enter" && !ev.shiftKey && Tab.focused.ui_handle_send()) {
		acUpdate([], 0, 0);
		ev.preventDefault();
	}
	if(ac_is_active) {
		if(ev.code == "Tab") {
			ev.preventDefault();
			return acComplete();
		}
		let off = 0;
		if(ev.code == "ArrowDown") off = 1;
		if(ev.code == "ArrowUp") off = -1;
		if(off) {
			ev.preventDefault();
			let act = ac_active_elt;
			act += off;
			if(act < 0) act += ac_items.length;
			if(act == ac_items.length) act = 0;
			acSetActive(act);
		}
	}
});
ui_sendbtn.addEventListener("click", ()=>{
	ui_input.focus();
	if(Tab.focused.ui_handle_send()) {
		acUpdate([], 0, 0);
	}
});
ui_nickbtn.addEventListener("click", async ()=>{
	let a = await nickChangeDialog(true, username[0], username[1]);
	if(!a) return;
	localStorage.user_pseudo = username[0] = ui_nickbtn.textContent = a[0];
	localStorage.user_color  = username[1] = a[1];
	for(let c of connections.values()) c.updateNickname();
});
ui_tab_closebtn.addEventListener("click", ()=>{
	Tab.focused.close();
});
ui_tab_createbtn.addEventListener("click", async ()=>{
	let a = await roomCreateDialog();
	if(!a) return;
	default_connection.createTab(a).focus();
});
// tabs
const tabs = new Map();
const tab_duck = Symbol("duck key");

class Tab {
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
		ui_tabctr.appendChild(tabelt);
		let opt = document.createElement("input");
		opt.type = "radio";
		opt.name = "tabsel";
		opt.id = "tsel_" + id;
		let optlabel = document.createElement("label");
		optlabel.setAttribute("for", opt.id);
		optlabel.textContent = name;
		ui_tabbar.appendChild(opt);
		ui_tabbar.appendChild(optlabel);
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
				ui_tab_placeholder.classList.add("visible");
		}
	}
	focus() {
		if(Tab.#focused != this) {
			this.#el.opt.checked = true;
			Tab.#previous = Tab.#focused;
			Tab.#focused = this;
			(Tab.#previous?.closed === false ? Tab.#previous.#el.tabelt : ui_tab_placeholder).classList.remove("visible");
			Tab.#focused.#el.tabelt.classList.add("visible");
		}
		ui_input.disabled = !this.#canType;
		ui_sendbtn.disabled = !this.#canSend || !validate_duck(ui_input.value);
		ui_typing_users.textContent = "";
		let tn;
		for(let sid of this.#typing) {
			if(!this.#users[sid]) continue;
			ui_typing_users.appendChild(nickHTML(this.#users[sid]));
			ui_typing_users.appendChild(tn=document.createTextNode(", "));
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
		twemoji.parse(lcontent, tw_options);
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
		if(ui_sendbtn.disabled) return false;
		if(this.onMessage(ui_input.value.trim()) == false) return false;
		ui_input.value="";
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
function nickHTML(data) {
	let w = document.createElement("span");
	w.className = "nick";
	w.style.color = data.color;
	w.textContent = data.nick;
	w.dataset.sid = data.sid;
	w.dataset.home = data.home;
	return w;
}
function formatMsg(a) {
	function shtml(a) {
		return a
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll('"', "&quot;");
	}
	// undoes replacements done by shtml
	function uhtml(a) {
		return a
			.replaceAll("&amp;", "&")
			.replaceAll("&lt;", "<")
			.replaceAll("&quot;", '"');
	}
	function unmdhtml(a){
		return a
			.replaceAll("_", "&#95;")
			.replaceAll("*", "&#42;")
			.replaceAll("~", "&#126;")
			.replaceAll(":", "&#58;")
			.replaceAll("\\", "&#92;");
	}
	return shtml(a)
		.replace(/(\\)?(!)?\[(.+?)\]\((.+?)\)/gs, function (entire, escape, img, alt, src) {
			if (escape) return entire.slice(1);
			let e;
			try {
				e = new URL(uhtml(src));
				if (e.protocol != "http:" && e.protocol != "https:" && (img && e.protocol != "data:")) return entire
			} catch (e) {
				return entire
			}
			let bsrc = src.split(" ");
			let ealt = unmdhtml(alt),
			esrc = unmdhtml(shtml(src));
			let psrc = unmdhtml("https://external-content.duckduckgo.com/iu/?u="+encodeURIComponent(e));
			return img ? `<img src="${e.protocol=="data:"?esrc:psrc}" alt="${ealt}">` : `<a href="${esrc}" target="_blank">${alt}</a>`
		})
		//.replace(/\b((?:https?:\/\/|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?]))/gi, function(duck) {
		//.replace(/(?:https?:\/\/)(?:[a-z0-9-]+\.)*[a-z0-9]+(?:\/[-a-z0-9+$@#\\/%?=~_()|!:,.;]*(?:[-A-Za-z0-9+$@#\\/%=~_()|](?:&(?:\w+;)?)?)+)?/gi, function(duck) {
		.replace(/(?:https?:\/\/)(?:[a-z0-9-]+\.)*[a-z0-9]+(?:[-a-z0-9+$@#\/%?=~_()|!:,.;]|&amp;)+(?:[-a-z0-9+$@#\/%=~_()|]|&amp;)/gi, function(duck) {
			try {
				let e = new URL(duck);
				if (e.protocol != "http:" && e.protocol != "https:" && (img && e.protocol != "data:"))
					return unmdhtml(duck);
				let be = unmdhtml(""+e);
				return `<a href="${be}" target="_blank">${be}</a>`;
			} catch (e) {
				return unmdhtml(duck)
			}
		})
		.replace(/```(?:(\w+)\n)?(.+?)```|`(.+?)`/gs, function(entire, language, block, inline) {
			if(inline) return `<code>${unmdhtml(inline)}</code>`;
			else if(block) {
				if(language) try {
					let sus = HighlightJS.highlight(uhtml(block), { language }).value
					return `<pre class="hljs">${unmdhtml(sus)}</pre>`;
				} catch {}
				return `<pre>${unmdhtml(block)}</pre>`;
			}
			else return entire;
		})
		.replace(/^(\\)?> (.+)(\n|$)/g, function (entire, esc, ducks) {
			if (esc) return "> " + ducks;
			return `<div style="border-left: .75ch solid #144; padding-left: 1.25ch">${ducks}</div>`;
		})
		.replace(/(\\)?:(\w+?):/g, function (entire, esc, ducks) {
			if (esc) return `:${ducks}:`;
			return emojimap[ducks[0]]?.[ducks] || entire;
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

const connections = new Map();
class Connection {
	#rate_max;
	#rate_cur = {message:0,typing:0,chnick:0,room:0,mouse:0};
	#rate_reset_timer;
	#uri;
	#name;
	#userid;
	#id;
	#ws;
	#reconn;
	#tabs = [];
	#c_nick = "duck";
	#c_color = "#a3e130";
	constructor(uri, id, name) {
		if(connections.has(id)) throw new Error("There is already a connection by that ID.");
		this.#uri = new URL(uri);
		this.#id = id;
		this.#name = name==null ? null : ""+name;
		this.#uri.protocol = this.#uri.protocol.replace("http", "ws");
		connections.set(id, this);
		for(let a of JSON.parse(localStorage["rooms-"+id] || "[]")) this.createTab(a);
	}
	connect() {
		clearTimeout(this.#reconn);
		this.#ws = new WebSocket(this.#uri, "json-v2");
		this.#ws.addEventListener("open", ()=>{
			this.#rate_reset_timer = setInterval(()=>this.#rate_reset(), 5100); // overshoot a little
		});
		this.#ws.addEventListener("close", ()=>{
			this.#reconn = setTimeout(()=>this.connect(), 5000);
			clearInterval(this.#rate_reset_timer);
		});
		this.#ws.addEventListener("message", (b)=>{
			if(typeof b.data == "string") {
				let x = b.data.search("\0");
				let a = b.data.slice(0,x);
				let j = JSON.parse(b.data.slice(x+1));
				this.#handle_event(a, j);
			}
		});
		return new Promise((r,j)=>{
			this.#ws.addEventListener("open",()=>r());
			this.#ws.addEventListener("close",()=>j());
		});
	}
	disconnect() {
		this.#ws.close();
		clearTimeout(this.#reconn);
	}
	#map_ratelimit_buckets(name) {
		let qe = null;
		switch(name) {
			case "TYPING": qe = "typing"; break
			case "MOUSE": qe = "mouse"; break;
			case "USER_CHANGE_NICK": qe = "chnick"; break;
			case "MESSAGE": qe = "message"; break;
			case "ROOM_JOIN": case "ROOM_LEAVE": qe = "room"; break;
		}
		return qe;
	}
	rate_remaining(name, sub=0) {
		let qe = this.#map_ratelimit_buckets(name);
		if(!qe) return -1;
		let pc = this.#rate_cur[qe];
		this.#rate_cur[qe] = Math.min(this.#rate_max[qe], this.#rate_cur[qe] + sub);
		if(this.#rate_max[qe] - this.#rate_cur[qe] == 0) switch(qe) {
			case "message": for(let t of this.#tabs) t.canSend = false; break;
		}
		return this.#rate_max[qe] - pc;
	}
	#rate_reset() {
		for(let i of Object.keys(this.#rate_cur)) this.#rate_cur[i] = 0;
		for(let t of this.#tabs) t.canSend = true;
		for(let [b,e] of Object.entries(this.#event_queue)) {
			console.log(b, ...e);
			while(e.length && this.send_event(...e.shift()));
			if(!e.length) delete this.#event_queue[b];
		}
	}
	#event_queue = {};
	send_event_queue(name, ...args) {
		if(!this.#ws || this.#ws.readyState != 1) return false;
		if(this.send_event(name, ...args)) return true;
		let qe = this.#map_ratelimit_buckets(name);
		this.#event_queue[qe] ||= [];
		this.#event_queue[qe].push([name, ...args]);
		return false;
	}
	send_event(name, ...args) {
		if(!this.#ws || this.#ws.readyState != 1) return false;
		if(!this.rate_remaining(name, 1)) return false;
		this.#ws.send(`${name}\0${JSON.stringify(args)}`);
		return true;
	}
	#handle_event(name, args) {
		switch(name) {
			case "USER_JOINED": {
				let t = this.#tabs[args[0]];
				t.printMsg({
					sid: "system", html: true, time: args[2],
					content: nickHTML(args[1]).outerHTML+"<em> joined"
				});
			}; break;
			case "USER_LEFT": {
				let t = this.#tabs[args[0]];
				t.printMsg({
					sid: "system", html: true, time: args[2],
					content: nickHTML(t.users[args[1]]).outerHTML+"<em> left"
				});
			}; break;
			case "USER_CHANGE_NICK": {
				let t = this.#tabs[args[0]];
				let b = t.users[args[1]];
				let on = { nick: args[2][0], color: args[2][1], sid: b.sid, home: b.home };
				let nn = { nick: args[3][0], color: args[3][1], sid: b.sid, home: b.home };
				t.printMsg({
					sid: "system", html: true, time: args[4],
					content:nickHTML(on).outerHTML+"<em> is now known as </em>"+nickHTML(nn).outerHTML
				});
			}
			case "USER_UPDATE": {
				let t = this.#tabs[args[0]];
				t.updateUsers(args[1]);
			}; break;
			case "HISTORY": {
				let t = this.#tabs[args[0]];
				t.clearChat();
				for(let b of args[1]) switch(b.type) {
					case "join": {
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content: nickHTML(b).outerHTML+"<em> joined"
						});
					}; break
					case "leave": {
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content:nickHTML(b).outerHTML+"<em> left"
						});
					}; break
					case "chnick": {
						let on = { nick: b.old_nick, color: b.old_color, sid: b.sid, home: b.home };
						let nn = { nick: b.new_nick, color: b.new_color, sid: b.sid, home: b.home };
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content:nickHTML(on).outerHTML+"<em> is now known as </em>"+nickHTML(nn).outerHTML
						});
					}; break
					case "message": {
						t.printMsg({ sid: b.sid, _user: b, time: b.ts, content: b.content });
					}; break
				}
			}; break;
			case "MESSAGE": {
				let t = this.#tabs[args[0]];
				t.printMsg(args[1])
			}; break;
			case "TYPING": {
				let t = this.#tabs[args[0]];
				t.updateTyping(args[1])
			}; break;
			case "MOUSE": {}; break;
			case "ROOM": {
				let pt = this.#tabs;
				this.#tabs = args[0].map(e=>{
					let b = Tab.create(this.#id+"-"+e);
					b.name = (this.#name ? this.#name+" - #" : "#") + e;
					return b;
				});
				for(let i of pt) if(this.#tabs.find(e=>e.id==i.id) == null) {
					console.log(this.#tabs, i.id);
					i.close();
				}
				localStorage["rooms-"+this.#id] = JSON.stringify(this.#tabs.map(e=>e.id.slice(this.id.length+1)));
			}; break;
			case "RATE_LIMITS": {
				this.#rate_max = args[0];
			}; break;
			case "HELLO": {
				console.log(`connected to ${this.#uri} -- ${args[0]}`);
				this.#userid = args[1];
				this.send_event("USER_JOINED", username[0], username[1], this.#tabs.map(e=>e.id.slice(this.id.length+1)));
			}; break;
		}
	}
	get name() { return this.#name; }
	get uri() { return this.#uri; }
	get id() { return this.#id; }
	get uid() { return this.#userid; }
	createTab(room_name) {
		room_name = room_name.trim();
		let t = Tab.create(this.#id+"-"+room_name);
		if(this.#tabs.includes(t)) return t;
		this.#tabs.push(t);

		t.name = (this.#name ? this.#name+" - #" : "#") + room_name;
		t.canSend = true;
		t.onMessage = (str) => {
			let r = this.#tabs.findIndex(e=>e==t);
			return this.send_event("MESSAGE", r, str);
		}
		t.onTyping = (b) => {
			let r = this.#tabs.findIndex(e=>e==t);
			this.send_event("TYPING", r, b);
		}
		t.onClose = () => {
			let r = this.#tabs.findIndex(e=>e==t);
			if(r != -1) this.send_event_queue("ROOM_LEAVE", r);
		}
		this.send_event_queue("ROOM_JOIN", room_name, false);
		return t;
	}
	updateNickname() {
		this.send_event_queue("USER_CHANGE_NICK", username[0], username[1])
	}
}

const username = [localStorage.user_pseudo, localStorage.user_color];

const default_ws_url = localStorage.ws_url ? new URL(localStorage.ws_url) : new URL("/ws",location.href);
const default_connection = new Connection(default_ws_url, "default");
default_connection.createTab("lobby").focus();

function duckhash() {
	default_connection.createTab(decodeURIComponent(location.hash.slice(1))).focus();
}
window.addEventListener("hashchange", duckhash);
duckhash();

Object.assign(window, {
	nickChangeDialog, roomCreateDialog,
	HighlightJS, SimplePeer, CBOR, tw,
	acSetActive, acUpdate, acTrigger, ac_triggers,
	tabs, Tab,
	formatMsg, nickHTML,
	Connection, connections, default_connection,
	username
});


if(localStorage.user_pseudo == null) {
	let [u, c] = await nickChangeDialog(false, "duck", "#4ae329");
	localStorage.user_pseudo = username[0] = u;
	localStorage.user_color  = username[1] = c;
}
ui_nickbtn.textContent = username[0];

default_connection.connect();

