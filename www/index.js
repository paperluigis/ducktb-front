// imports
import SimplePeer from "https://esm.sh/simple-peer@9";
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
const ui_tab_container = document.querySelector("#tabctr");

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

class Tab {
	constructor(name) {
		
	}
	get duck() {
		return Math.random()
	}
}


Object.assign(window, {
	SimplePeer, tw,
	acSetActive, acUpdate, acTrigger, ac_triggers,
	tabs, Tab
});
