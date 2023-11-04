// imports
import { nickChangeDialog, roomCreateDialog } from "./dialogs.js";
import { tabs, Tab } from "./tab.js";
//import { commandPrompt }
import { ac_triggers, acClear } from "./autocomplete.js";
import { connections, Connection } from "./connection.js";
import { nickHTML, formatMsg, validate_string } from "./util.js";
import * as ele from "./ui_elements.js";

import HighlightJS from "https://esm.sh/highlight.js";
//import SimplePeer from "https://esm.sh/simple-peer@9";
import CBOR from "https://esm.sh/cbor-js";

document.body.addEventListener("mouseleave", ()=>{
	Tab.focused.ui_handle_mouse();
});
document.body.addEventListener("mousemove", e=>{
	Tab.focused.ui_handle_mouse(e);
});
ele.input.addEventListener("input", ()=>{
	Tab.focused.ui_handle_input(true);
});
ele.input.addEventListener("keydown", ev=>{
	if(ev.code == "Enter" && !ev.shiftKey && Tab.focused.ui_handle_send()) {
		acClear();
		ev.preventDefault();
	}
});
ele.sendbtn.addEventListener("click", ()=>{
	ele.input.focus();
	if(Tab.focused.ui_handle_send()) {
		acClear();
	}
});
ele.nickbtn.addEventListener("click", async ()=>{
	let a = await nickChangeDialog(true, username[0], username[1]);
	if(!a) return;
	localStorage.user_pseudo = username[0] = ele.nickbtn.textContent = a[0];
	localStorage.user_color  = username[1] = a[1];
	for(let c of connections.values()) c.updateNickname(username);
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
	if(location.hash.slice(1).trim())
		default_connection.createTab(decodeURIComponent(location.hash.slice(1))).focus();
}
window.addEventListener("hashchange", duckhash);
duckhash();

default_connection.connect();


Object.assign(window, {
	nickChangeDialog, roomCreateDialog, ele,
	HighlightJS, CBOR,
	ac_triggers,
	tabs, Tab,
	formatMsg, nickHTML, validate_string,
	Connection, connections, default_connection,
	username
});


for(let b of window.ready) try { b() } catch(e) { console.error(e) }
