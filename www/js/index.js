// imports
import { nickChangeDialog, roomCreateDialog } from "./dialogs.js";
import { tabs, Tab } from "./tab.js";
import { connections, Connection } from "./connection.js";
import { nickHTML, formatMsg, validate_string } from "./util.js";
import { emojimap, emojientr } from "./emojimap.js";
import * as ele from "./ui_elements.js";

import HighlightJS from "https://esm.sh/highlight.js";
import SimplePeer from "https://esm.sh/simple-peer@9";
import CBOR from "https://esm.sh/cbor-js";

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
		ele.autocomp_bar.hidden = true;
		return;
	};
	ac_is_active = true;
	ele.autocomp_bar.hidden = false;
	ele.autocomp_bar.textContent = "";
	let i = 0;
	for(let [label, value] of ac_items) {
		let b = document.createElement("div");
		b.className = "autocomp_entry";
		b.textContent = label;
		b.addEventListener("click", function(i, e){
			e.preventDefault();
			acComplete(i);
		}.bind(null,i))
		ele.autocomp_bar.appendChild(b);
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

ele.input.addEventListener("blur", ()=>acUpdate([], 0, 0));
ele.input.addEventListener("input", ()=>{
	acTrigger(ele.input.value, ele.input.selectionEnd);
	Tab.focused.ui_handle_input(true);
});
ele.input.addEventListener("keydown", ev=>{
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
ele.sendbtn.addEventListener("click", ()=>{
	ele.input.focus();
	if(Tab.focused.ui_handle_send()) {
		acUpdate([], 0, 0);
	}
});
ele.nickbtn.addEventListener("click", async ()=>{
	let a = await nickChangeDialog(true, username[0], username[1]);
	if(!a) return;
	localStorage.user_pseudo = username[0] = ele.nickbtn.textContent = a[0];
	localStorage.user_color  = username[1] = a[1];
	for(let c of connections.values()) c.updateNickname();
});
ele.tab_closebtn.addEventListener("click", ()=>{
	Tab.focused.close();
});
ele.tab_createbtn.addEventListener("click", async ()=>{
	let a = await roomCreateDialog();
	if(!a) return;
	default_connection.createTab(a).focus();
});

if(localStorage.user_pseudo == null) {
	let [u, c] = await nickChangeDialog(false, "duck", "#4ae329");
	localStorage.user_pseudo = u;
	localStorage.user_color  = c;
}
const username = [localStorage.user_pseudo, localStorage.user_color];
ele.nickbtn.textContent = username[0];

const default_ws_url = localStorage.ws_url ? new URL(localStorage.ws_url) : new URL("/ws",location.href);
const default_connection = new Connection(default_ws_url, "default", username);
default_connection.createTab("lobby").focus();

function duckhash() {
	default_connection.createTab(decodeURIComponent(location.hash.slice(1))).focus();
}
window.addEventListener("hashchange", duckhash);
duckhash();

default_connection.connect();


Object.assign(window, {
	nickChangeDialog, roomCreateDialog, ele,
	HighlightJS, SimplePeer, CBOR,
	acSetActive, acUpdate, acTrigger, ac_triggers,
	tabs, Tab,
	formatMsg, nickHTML, validate_string,
	Connection, connections, default_connection,
	username
});


for(let b of window.ready) try { b() } catch(e) { console.error(e) }
