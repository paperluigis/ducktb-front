// imports
import SimplePeer from "https://esm.sh/simple-peer@9";
import CBOR from "https://esm.sh/cbor-js@0.1.0";
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
const ui_tabctr = document.querySelector("#tabctr");
const ui_tabbar = document.querySelector("#tabbar");
const ui_tab_placeholder = document.querySelector("#tab_placeholder");

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
ui_input.addEventListener("blur", ()=>{ acUpdate([], 0, 0) });
ui_input.addEventListener("input", ()=>{ acTrigger(ui_input.value, ui_input.selectionEnd) });
ui_input.addEventListener("keydown", ev=>{
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

// tabs
const tabs = new Map();
const tab_duck = Symbol("duck key");

class Tab {
	#id = "";
	#name = "";
	#users = {};
	#scrollEnd = true;
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
		scroll.addEventListener("scroll", function() {
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
	get users() { return this.#users; }
	get id() { return this.#id }
	get name() { return this.#name; }
	set name(x) {
		this.#name = x;
		this.#el.optlabel.textContent = x;
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
		this.#el.opt.checked = true;

		Tab.#previous = Tab.#focused;
		Tab.#focused = this;
		(Tab.#previous?.closed === false ? Tab.#previous.#el.tabelt : ui_tab_placeholder).classList.remove("visible");
		Tab.#focused.#el.tabelt.classList.add("visible");
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
		} : users[data.sid]);
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
		if(force||this.#scrollEnd) this.#el.scrollTop = this.#el.scrollHeight;
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
			else if(block) return `<pre>${unmdhtml(block)}</pre>`;
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


class Connection {
	#rate_max;
	#rate_cur = {message:0,typing:0,room:0,mouse:0};
	#rate_reset;
	#uri;
	#name;
	#userid;
	#id;
	#ws;
	#reconn;
	#tabs = [];
	constructor(uri, id, name) {
		this.#uri = new URL(uri);
		this.#id = id;
		this.#name = name==null ? null : ""+name;
		this.#uri.protocol = this.#uri.protocol.replace("http", "ws");
	}
	connect() {
		clearTimeout(this.#reconn);
		this.#ws = new WebSocket(this.#uri, "json-v2");
		this.#ws.addEventListener("open", ()=>{
			this.#rate_reset = setInterval(()=>{
				for(let i in this.#rate_cur) this.#rate_cur[i] = 0;
			}, 5100); // overshoot a little
		});
		this.#ws.addEventListener("close", ()=>{
			this.#reconn = setTimeout(()=>this.connect(), 5000);
			clearInterval(this.#rate_reset);
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
	send_event(name, ...args) {
		this.#ws.send(`${name}\0${JSON.stringify(args)}`);
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
				let nn = { nick: args[3][1], color: args[3][1], sid: b.sid, home: b.home };
				t.printMsg({
					sid: "system", html: true, time: args[4],
					content:nickHTML(on).outerHTML+"<em> now known as </em>"+nickHTML(nn).outerHTML
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
							content:nickHTML(on).outerHTML+"<em> now known as </em>"+nickHTML(nn).outerHTML
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
			case "TYPING": {}; break;
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
			}; break;
			case "RATE_LIMITS": {
				this.#rate_max = args[0];
			}; break;
			case "HELLO": {
				console.log(`connected to ${this.#uri} -- ${args[0]}`);
				this.#userid = args[1];
				this.send_event("USER_JOINED", the_user[0], the_user[1], this.#tabs.map(e=>e.id.slice(this.id.length+1)));
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
		if(this.#tabs.includes(t)) return;
		this.#tabs.push(t);

		t.name = (this.#name ? this.#name+" - #" : "#") + room_name;
		return t;
	}
}

const the_user = ["test", "#7a19ef"];

const default_ws_url = localStorage.ws_url ? new URL(localStorage.ws_url) : new URL("ws",location.href);
const default_connection = new Connection(default_ws_url, "default");
default_connection.createTab("lobby").focus();

function duckhash() {
	default_connection.createTab(location.hash.slice(1)).focus();
}
window.addEventListener("hashchange", duckhash);
duckhash();

default_connection.connect();

Object.assign(window, {
	SimplePeer, tw,
	acSetActive, acUpdate, acTrigger, ac_triggers,
	tabs, Tab,
	formatMsg, nickHTML,
	Connection, default_connection
});
