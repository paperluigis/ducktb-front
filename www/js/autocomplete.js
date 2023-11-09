import { emojimap, emojientr } from "i_emojimap";
import * as ele from "i_ui_elements";

// modifiable object (is to be modified by "plugins" (userscripts))
// const ac_triggers: Record<string, (str: string, pos: number) => [[string, string][], number, number]>
export const ac_triggers = {
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

export function acClear() {
	acUpdate([], 0, 0);
}

function acTrigger(str, pos) {
	for(let [k,f] of Object.entries(ac_triggers)) {
		let [result, sel_start, sel_end] = f(str, pos);
		if(result.length) {
			acUpdate(result, sel_start, sel_end);
			return;
		}
	}
	acClear();
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


ele.input.addEventListener("input", ()=>{
	acTrigger(ele.input.value, ele.input.selectionEnd);
});
ele.input.addEventListener("keydown", ev=>{
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
