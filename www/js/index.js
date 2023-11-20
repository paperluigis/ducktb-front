// imports
import { nickChangeDialog, roomCreateDialog, settingsChangeDialog, contextMenu } from "i_dialogs";
import { tabs, Tab } from "i_tab";
//import { commandPrompt }
import { ac_triggers, acClear } from "i_autocomplete";
import { connections, Connection } from "i_connection";
import { copyText, nickHTML, formatMsg, validate_string } from "i_util";
import * as ele from "i_ui_elements";

import HighlightJS from "https://esm.sh/highlight.js";
//import SimplePeer from "simple-peer";
import CBOR from "cbor-js";

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
ele.settingsbtn.addEventListener("click", async ()=>{
	settingsChangeDialog();
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
localStorage["rooms-default"] ??= `["lobby"]`;
const default_connection = new Connection(default_ws_url, "default", username);
function duckhash() {
	if(location.hash.slice(1).trim())
		default_connection.createTab(decodeURIComponent(location.hash.slice(1))).focus();
}
window.addEventListener("hashchange", duckhash);
duckhash();

window.addEventListener("keydown", e=>{
	if(!e.altKey && !e.ctrlKey) ele.input.focus();
	if(!e.altKey) return;
	let sw=0;
	switch(e.code) {
		case "KeyW": ele.tab_closebtn.click(); break;
		case "KeyT": ele.tab_createbtn.click(); break;
		case "KeyZ": ele.nickbtn.click(); break;
		case "ArrowLeft": sw=-1; break;
		case "ArrowRight": sw=1; break;
		default: return;
	}
	e.preventDefault();
	if(!sw) return;
	let sa = [...document.querySelectorAll("[name=tabsel]")];
	let si = sa.findIndex(a=>a.checked) + sw;
	if(si<0) si=sa.length-1;
	if(si==sa.length) si=0;
	sa[si].click();
});
ele.input.addEventListener("keydown", e=>{
	switch(e.code) {
		case "Escape": Tab.focused.ui_handle_stopdm(); break;
		default: return;
	}
	e.preventDefault();
});

window.addEventListener("contextmenu", e=>{
	let el = e.target;
	for(;el!=document;el=el.parentNode) {
		// default context menu for
		if(el.matches("img, a")) return;
		if(el.matches(".nick")) {
			nickCtx(el, e); break
		} else if(el.matches(".line")) {
			msgCtx(el, e); break
		} else if(el.matches("input[name=tabsel] + label")) {
			roomCtx(el, e); break
		}
	}
	if(el!=document)
		e.preventDefault();
});

async function nickCtx(elt, ev) {
	console.log("nick element", elt);
	let m = Tab.focused;
	let it = [];
	if(elt.dataset.sid == elt.dataset.home && elt.dataset.sid) {
		it.push({ cont: `id: ${elt.dataset.sid}`, disabled: true })
	} else {
		if(elt.dataset.sid) it.push({ cont: `sid: ${elt.dataset.sid}`, disabled: true });
		if(elt.dataset.home) it.push({ cont: `home: ${elt.dataset.home}`, disabled: true });
	}
	it.push(
		{ separator: true },
		{ cont: "Copy", inner: [
			{ cont: "Copy nick", value: "copy_nick" },
			{ cont: "Copy home", value: "copy_home", disabled: !elt.dataset.home },
			{ cont: "Copy sid", value: "copy_sid", disabled: !elt.dataset.sid },
		] }
	);
	if(m.users[elt.dataset.sid]) {
		it.push(
			{ cont: "DM", value: "dm", disabled: !m.canDM },
			{ cont: "Mention", disabled: true }
		);
	}
	let b = await contextMenu(it, ev.clientX, ev.clientY);
	switch(b) {
		case "dm": m.ui_handle_startdm(elt.dataset.sid); break;
		case "copy_nick": copyText(elt.textContent); break;
		case "copy_home": copyText(elt.dataset.home); break;
		case "copy_sid": copyText(elt.dataset.sid); break;
	}
}
function msgCtx(elt, ev) {
	console.log("message element", elt);
}
function roomCtx(elt, ev) {
	console.log("room tab element", elt);
}

default_connection.connect();


Object.assign(window, {
	nickChangeDialog, roomCreateDialog, contextMenu, ele,
	HighlightJS, CBOR,
	ac_triggers,
	tabs, Tab,
	formatMsg, nickHTML, validate_string, copyText,
	Connection, connections, default_connection,
	username
});


window.ready ??= [];
for(let b of window.ready) try { b() } catch(e) { console.error(e) }
